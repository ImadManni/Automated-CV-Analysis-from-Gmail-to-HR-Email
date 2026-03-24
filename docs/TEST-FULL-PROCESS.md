# Test du process complet — Step by step

Guide pour tester de A à Z : API, candidature test, analyse CV (OpenAI), vérification en base.

---

## Prérequis

- **Node.js** installé
- **PostgreSQL** démarré, base `pca` + tables créées (`server/sql/create-db-kamla.sql`)
- **OPENAI_API_KEY** dans `.env` (pour l’analyse CV)
- **MinIO** (optionnel pour ce test : on utilise `body.text` pour l’analyse, pas le PDF)

---

## Étape 1 — Démarrer l’API

```powershell
cd "C:\Users\DELL\Desktop\Automated CV Analysis from Gmail to HR Email"
npm run server
```

Tu dois voir :
- `PCA API (Express) running at http://localhost:3005`
- `Database: PostgreSQL (DATABASE_URL)` ou `Database: JSON files`
- `POST http://localhost:3005/api/test/analyze`

Laisse cette fenêtre ouverte.

---

## Étape 2 — Ouvrir Swagger (interface de test)

Dans le navigateur :

**http://localhost:3005/docs**

Tu verras la liste des endpoints (Auth, Candidatures, RAG).

---

## Étape 3 — Créer une candidature test

1. Dans Swagger, trouve **POST /api/test/candidatures**.
2. Clique sur **Try it out**.
3. Body (déjà pré-rempli, tu peux modifier) :

```json
{
  "email": "test@example.com",
  "fullName": "Marie Martin",
  "subject": "Candidature Data Engineer PCA 2025",
  "source": "email"
}
```

4. Clique **Execute**.

5. Dans la réponse (201), note :
   - **`id`** (ex : `1`, `2`, …)
   - **`candidateId`** (UUID)
   - **`uploadUrl`** (ex : `/cvs/xxx-xxx-xxx`)

Tu en auras besoin pour l’étape suivante.

---

## Étape 4 — Lancer l’analyse CV (avec le texte du CV)

Deux possibilités.

### Option A — Un seul appel : POST /api/test/analyze (recommandé)

Crée une candidature **et** lance l’analyse en une fois.

1. Dans Swagger : **POST /api/test/analyze** → **Try it out**.
2. Body (obligatoire : **`text`** = contenu du CV, min 50 caractères) :

```json
{
  "text": "Marie Martin. Ingénieure données, 4 ans d'expérience. Compétences : Python, SQL, Spark, AWS. Expérience : Data Engineer chez DataCorp (2021-2024), Analyste chez FinTech (2019-2021). Diplôme : Master informatique, ENSAE. Langues : français, anglais. Recherche poste Data Engineer ou ML Engineer.",
  "email": "marie.martin@email.com",
  "fullName": "Marie Martin",
  "subject": "Candidature Data Engineer PCA 2025"
}
```

3. **Execute**.

4. Réponse 201 : tu reçois **candidature** (id, candidateId, …) + **analysis** (summary, skills, experience, strengths, risks, score, decision).

---

### Option B — Deux appels : d’abord candidature, puis analyse

Si tu as déjà créé une candidature à l’étape 3 :

1. Dans Swagger : **POST /api/candidatures/{id}/analyze**.
2. Clique **Try it out**.
3. Dans **id** (path), mets l’`id` noté à l’étape 3 (ex : `1`).
4. Body :

```json
{
  "text": "Marie Martin. Ingénieure données, 4 ans d'expérience. Compétences : Python, SQL, Spark, AWS. Expérience : Data Engineer chez DataCorp (2021-2024). Diplôme : Master informatique. Langues : français, anglais."
}
```

5. **Execute**.

Réponse 200 : **analysis** (summary, skills, score, decision, etc.) et la candidature en base est mise à jour.

---

## Étape 5 — Vérifier les données en base

1. Dans Swagger : **GET /api/test/candidatures**.
2. **Try it out** → **Execute**.

Tu dois voir la liste des candidatures avec :
- Les candidatures créées (étape 3 et/ou 4)
- Pour celles analysées : **decision**, **score**, **rawSummary**, **skills**, **experience** remplis.

---

## Étape 6 — Vérifier dans PostgreSQL (optionnel)

Si tu utilises PostgreSQL :

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U pca_user -h 127.0.0.1 -d pca -c "SELECT id, candidate_name, email, decision, score, left(raw_summary, 80) as résumé FROM candidatures ORDER BY id DESC LIMIT 5;"
```

Mot de passe : celui de `pca_user` (défini dans ton `.env` / script SQL).

Tu dois voir les dernières candidatures avec **decision** et **score** mis à jour après analyse.

---

## Récap du flux test

| Étape | Action | Endpoint |
|-------|--------|----------|
| 1 | Démarrer l’API | `npm run server` |
| 2 | Ouvrir l’interface | http://localhost:3005/docs |
| 3 | Créer une candidature test | POST /api/test/candidatures |
| 4a | Créer + analyser en 1 coup | POST /api/test/analyze (body.text) |
| 4b | Ou analyser une candidature existante | POST /api/candidatures/:id/analyze (body.text) |
| 5 | Voir la liste + champs analysés | GET /api/test/candidatures |
| 6 | Voir en base (optionnel) | psql SELECT sur `candidatures` |

---

## Test du workflow n8n (optionnel)

1. Démarrer **MinIO** (port 9000), bucket **cvs** créé et accessible.
2. Importer le workflow **n8n-workflow-full.json** dans n8n.
3. Configurer le **Gmail Trigger** (credentials).
4. Envoyer un **email test** avec une pièce jointe **PDF (CV)** vers la boîte Gmail utilisée par le trigger.
5. Attendre le polling (ex : 1 min) ou exécuter le workflow à la main.
6. Vérifier : **GET /api/test/candidatures** → nouvelle candidature + après quelques secondes, **decision** / **score** / **rawSummary** remplis (si le node « 4 - Analyze CV » a réussi).

Si MinIO ou le PDF n’est pas dispo, le node « 4 - Analyze CV » peut échouer ; dans ce cas le test Swagger (étapes 1–5) suffit pour valider l’analyse OpenAI.
