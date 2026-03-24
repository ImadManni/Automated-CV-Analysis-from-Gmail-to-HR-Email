# Test du process de A à Z : Email → RH + résultat sur le dashboard

Oui, **c’est bien ce workflow**. Voici comment le tester de bout en bout (envoi mail → résultat sur la plateforme → test dans Swagger).

---

## 1. Corriger l’URL dans n8n (important)

Dans ton workflow, le nœud **"POST to Dashboard API"** pointe encore vers le port **3001**. L’API tourne sur **3005**.

- Ouvre le nœud **POST to Dashboard API**.
- Remplace l’URL par :  
  **`http://localhost:3005/api/candidatures`**  
  (au lieu de `http://localhost:3001/api/candidatures`).

Sauvegarde le workflow.

---

## 2. Démarrer l’API et le front

- **Terminal 1** :
  ```bash
  npm run server
  ```
  Tu dois voir : `PCA API (Express) running at http://localhost:3005`

- **Terminal 2** :
  ```bash
  npm run dev
  ```
  Le site tourne sur **http://localhost:3002**

---

## 3. Tester le process depuis zéro

1. **Envoie un email** vers la boîte Gmail utilisée par le **Gmail Trigger** (ex. hydragaming595@gmail.com) :
   - Depuis n’importe quelle adresse (ex. imadmanni@gmail.com),
   - Avec **une pièce jointe PDF ou DOCX** (un CV),
   - Sujet au choix (ex. "Test candidature").

2. **Lance le workflow** :
   - Soit attends le polling (toutes les minutes),
   - Soit dans n8n : **Execute Workflow** pour forcer une exécution.

3. **Vérifie l’email RH** :  
   Un résumé doit arriver sur **imadmanni@gmail.com** (synthèse du CV).

4. **Vérifie le dashboard** :
   - Ouvre **http://localhost:3002/dashboard**
   - Clique sur **« Rafraîchir »**
   - La candidature doit apparaître dans la liste (nom, décision, score, etc.).

5. **Teste dans Swagger** :
   - Ouvre **http://localhost:3002/docs**
   - **GET /api/candidatures** → **Try it out** → **Execute**  
   Tu dois voir la même candidature dans la réponse JSON.

Tu as donc : **envoi mail → workflow → email RH + résultat sur la plateforme → vérification dans Swagger**.

---

## Résumé du workflow (pour vérifier)

| Étape | Nœud | Rôle |
|-------|------|------|
| 1 | Gmail Trigger | Détecte un email avec pièce jointe |
| 2 | Check File Type | PDF ou DOCX |
| 3 | Extract from PDF / DOCX | Extraction du texte |
| 4 | Check Text Length + Set Fallback Text | Texte trop court → "CV non lisible" |
| 5 | Merge | Réunit les flux |
| 6 | Prepare Text for AI | Prépare le texte pour l’IA |
| 7 | Analyze CV | GPT-4o-mini : score, décision, synthèse |
| 8a | Prepare Email Content → Send Email to RH | Envoi de l’email à la RH |
| 8b | Build Payload for Dashboard → POST to Dashboard API | Envoi du résultat vers l’API (dashboard + Swagger) |

Une fois l’URL du nœud **POST to Dashboard API** passée à **3005**, le process est bon de A à Z.
