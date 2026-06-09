# Process : comment l’OpenAI agent analyse le CV et poste les données (test/candidature)

Explication du flux de A à Z : appel API → analyse OpenAI → enregistrement en base (ou JSON).

---

## Vue d’ensemble

```
[Toi / n8n]  →  POST body (email, fullName, text CV…)
       ↓
[API Express]  →  Crée ou récupère la candidature
       ↓
[OpenAI]  →  Reçoit le texte du CV + prompt "expert RH"  →  Retourne JSON (summary, score, decision…)
       ↓
[API]  →  Met à jour la candidature en DB (PostgreSQL) ou fichier JSON
       ↓
[Response]  →  Tu reçois { candidature, analysis }
```

---

## 1. Qui envoie les données ?

- **Toi** : via Swagger (POST /api/test/analyze ou POST /api/test/candidatures + POST …/analyze).
- **n8n** : le workflow appelle d’abord POST /api/test/candidatures (email, fullName, subject depuis Gmail), puis après upload du CV vers MinIO il appelle POST /api/candidatures/:id/analyze (sans body : l’API va chercher le PDF dans MinIO).

Dans les deux cas, à un moment on a **du texte de CV** et un **id de candidature**.

---

## 2. Les deux façons de “poster” et lancer l’analyse

### A) Un seul appel : POST /api/test/analyze

Tu envoies **tout dans le body** :

- **`text`** (obligatoire) : le contenu du CV en texte (min 50 caractères).
- Optionnel : `email`, `fullName`, `subject`, `source`.

**Ce que fait l’API (dans l’ordre) :**

1. **Vérifications**  
   - `text` présent et ≥ 50 caractères.  
   - `OPENAI_API_KEY` défini.

2. **Création de la candidature** (comme test/candidatures)  
   - Génère un `candidateId` (UUID).  
   - Si **PostgreSQL** (`useDb`) : `insertCandidatureIntoDb()` → une ligne dans la table `candidatures` (nom, email, subject, decision = "À REVOIR", source, etc.). Pas encore de summary/score.  
   - Si **JSON** : ajout dans le tableau `candidatures` en mémoire + `saveData()`.

3. **Appel OpenAI (analyse)**  
   - `analyzeCVWithOpenAI(cvText)` :
     - Envoie à l’API OpenAI un **message système** (prompt “expert RH”) + un **message utilisateur** = le texte du CV (tronqué à 12 000 caractères).
     - Demande une réponse en **JSON** (`response_format: { type: 'json_object' }`).
     - Le modèle (ex. gpt-4o-mini) retourne un JSON avec :  
       `summary`, `skills`, `experience`, `strengths`, `risks`, `score` (0–100), `decision` (ACCEPTEE / REFUSEE / A REVOIR / NON_LISIBLE).

4. **Sauvegarde du résultat de l’analyse**  
   - Si **PostgreSQL** : `updateCandidatureAnalysisInDb(id, analysis)` → `UPDATE candidatures SET raw_summary = …, skills = …, experience = …, score = …, decision = … WHERE id = ?`.  
   - Si **JSON** : on trouve la candidature dans le tableau par `id`, on met à jour `rawSummary`, `skills`, `experience`, `score`, `decision`, puis `saveData()`.

5. **Réponse HTTP**  
   - Status 201, body : `{ candidature: { id, candidateId, … }, analysis: { summary, skills, experience, strengths, risks, score, decision } }`.

Donc : **tu postes les données (dont le texte CV) dans test/analyze → l’agent OpenAI analyse ce texte → l’API poste/met à jour les données (candidature + analyse) en base (ou JSON).**

---

### B) Deux appels : POST /api/test/candidatures puis POST /api/candidatures/:id/analyze

**Premier appel : POST /api/test/candidatures**

- Body : `email`, `fullName`, `subject`, `source` (pas de texte de CV ici).
- L’API crée une candidature (DB ou JSON) et retourne `id`, `candidateId`, `uploadUrl`.
- À ce stade, en base tu as une ligne candidature **sans** analyse (pas de summary, score, etc.).

**Deuxième appel : POST /api/candidatures/:id/analyze**

- **URL** : `id` = l’id reçu au premier appel.
- **Body** (optionnel) : `{ "text": "contenu du CV..." }`.
  - Si tu mets **`text`** : l’API utilise ce texte pour l’analyse (comme en A).
  - Si tu **ne mets pas** `text` : l’API va chercher le CV dans MinIO (`cv_path` / `uploadUrl` de la candidature), télécharge le PDF, extrait le texte (pdf-parse), puis envoie ce texte à OpenAI.

**Ce que fait l’API pour /analyze :**

1. Récupère la candidature par `id` (`getCandidatureById`).
2. Récupère le **texte du CV** : soit depuis `body.text`, soit depuis MinIO + extraction PDF.
3. Appelle **OpenAI** : `analyzeCVWithOpenAI(cvText)` (même prompt, même format JSON).
4. Met à jour la candidature en DB (ou JSON) avec le résultat (`updateCandidatureAnalysisInDb` ou mise à jour du tableau + `saveData()`).
5. Retourne `{ id, candidateId, analysis: { summary, skills, … } }`.

Donc : **tu “postes” d’abord la fiche candidature (test/candidatures), puis tu “postes” l’analyse en déclenchant /analyze (avec ou sans body.text) ; l’agent OpenAI fait l’analyse, et l’API poste les résultats dans la table (ou le fichier) candidature.**

---

## 3. Détail de l’“agent” OpenAI (analyse)

- **Fichier** : `server/openai.js` → fonction **`analyzeCVWithOpenAI(cvText)`**.

- **Envoi à OpenAI** :  
  - **System** : “Tu es un expert RH. Analyse le CV et réponds en JSON avec : summary, skills, experience, strengths, risks, score (0–100), decision (ACCEPTEE / REFUSEE / A REVOIR / NON_LISIBLE).”  
  - **User** : le texte du CV.

- **Réponse** : un seul bloc JSON. L’API le parse et s’assure que `decision` est une des 4 valeurs autorisées, et que `score` est entre 0 et 100.

- **Retour de la fonction** :  
  `{ summary, skills, experience, strengths, risks, score, decision }`.  
  C’est ce bloc qui est ensuite “posté” dans la candidature (DB ou JSON).

---

## 4. Où les données sont “postées” (sauvegardées)

- **Si PostgreSQL** (`useDb = true`, `DATABASE_URL` défini) :  
  - Création : table **`candidatures`** via `insertCandidatureIntoDb`.  
  - Mise à jour après analyse : **`UPDATE candidatures`** via `updateCandidatureAnalysisInDb` (raw_summary, skills, experience, score, decision).

- **Si JSON** :  
  - Fichier **`server/data/candidatures.json`** (et tableau `candidatures` en mémoire).  
  - Création : push dans le tableau + `saveData()`.  
  - Après analyse : modification de l’élément correspondant dans le tableau + `saveData()`.

Donc “post data fl test candidature” = soit une **INSERT** + plus tard **UPDATE** en base, soit **écriture dans le fichier candidatures.json**.

---

## 5. Résumé en une phrase

Tu envoies le texte du CV (et éventuellement email, nom, sujet) à l’API → l’API crée ou récupère une candidature → elle envoie le texte à l’**agent OpenAI** qui analyse et renvoie un JSON (résumé, compétences, score, décision) → l’API **poste** ce résultat dans la candidature (PostgreSQL ou JSON) et te renvoie la candidature + l’analyse.
