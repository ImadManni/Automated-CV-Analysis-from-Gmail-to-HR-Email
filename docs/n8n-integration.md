# Intégration n8n → Dashboard PCA (données réelles)

Pour que les candidatures analysées par le workflow n8n apparaissent dans le dashboard :

1. **Démarrer l’API** (sur ta machine ou un serveur accessible par n8n) :
   ```bash
   npm run server
   ```
   L’API écoute sur `http://localhost:3005` (ou la variable d’environnement `PORT`).

2. **Dans n8n**, ajoute deux nœuds **après** le nœud **"Analyze CV"** (en parallèle de "Prepare Email Content") :

   - **Nœud 1 — Code** (nom : `Build Payload for Dashboard`)  
     Colle le code ci-dessous dans le champ "JavaScript Code".
   - **Nœud 2 — HTTP Request** (nom : `POST to Dashboard API`)  
     - Method: **POST**  
     - URL: `http://localhost:3005/api/candidatures` (ou l’URL de ton API si déployée)  
     - Body Content Type: **JSON**  
     - Specify Body: **Using JSON**  
     - Body: `={{ $json }}` (tout le JSON produit par le Code ci-dessus)

   Connecte : **Analyze CV** → **Build Payload for Dashboard** → **POST to Dashboard API**.

   (Tu peux laisser **Analyze CV** → **Prepare Email Content** → **Send Email to RH** comme aujourd’hui.)

3. **URL de l’API**  
   - En local : n8n et l’API doivent pouvoir se joindre. Si n8n est sur la même machine, `http://localhost:3005` suffit.  
   - Si n8n est sur un autre serveur (ou cloud), utilise l’URL publique de l’API (ex. `https://ton-api.example.com`) et configure CORS si besoin (le serveur autorise déjà tout avec `cors()`).

4. **Frontend**  
   Le dashboard React charge les candidatures depuis `GET /api/candidatures`. Configure `VITE_API_URL` (ex. dans `.env`) vers la même base URL que l’API (ex. `http://localhost:3005`) pour que le front appelle le bon serveur.

---

## Code du nœud "Build Payload for Dashboard" (n8n — Code node)

À coller dans le nœud **Code** (JavaScript) :

```javascript
const item = $input.first();
const json = item.json;

// Texte de l'analyse IA (format du prompt PCA)
let text = '';
if (json.output && json.output[0] && json.output[0].content && json.output[0].content[0]) {
  text = (json.output[0].content[0].text || '').trim();
} else if (json.message) {
  text = String(json.message).trim();
} else if (json.text) {
  text = String(json.text).trim();
}

// Données Gmail (référence au nœud "Gmail Trigger")
const gmail = $('Gmail Trigger').first().json;
const fromAddr = (gmail.from && gmail.from.value && gmail.from.value[0] && gmail.from.value[0].address) 
  ? gmail.from.value[0].address 
  : (gmail.from && gmail.from.text ? gmail.from.text.replace(/^.*<([^>]+)>.*$/, '$1').trim() : '');
const subject = (gmail.subject != null) ? String(gmail.subject).trim() : 'Sans objet';
const date = (gmail.date != null) ? (typeof gmail.date === 'string' ? gmail.date : new Date(gmail.date).toISOString()) : new Date().toISOString();

// Parsing du texte IA (Candidat :, Compétences :, Expérience :, Score :, Décision :)
const candidatMatch = text.match(/\bCandidat\s*:\s*(.+?)(?=\n|$)/i);
const competencesMatch = text.match(/\bCompétences?\s*:\s*(.+?)(?=\n|$)/i);
const experienceMatch = text.match(/\bExpérience\s*:\s*(.+?)(?=\n|$)/i);
const scoreMatch = text.match(/\bScore\s*:\s*(\d+)\s*%?/i);
const decisionMatch = text.match(/\bDécision\s*:\s*(ACCEPTÉE|REFUSÉE|À REVOIR|NON_LISIBLE)[^\n]*/i);

let decision = (decisionMatch && decisionMatch[1]) ? decisionMatch[1].trim() : 'À REVOIR';
const score = scoreMatch ? parseInt(scoreMatch[1], 10) : undefined;
const candidateName = (candidatMatch && candidatMatch[1]) ? candidatMatch[1].trim() : 'Candidat';
const skills = (competencesMatch && competencesMatch[1]) ? competencesMatch[1].trim() : undefined;
const experience = (experienceMatch && experienceMatch[1]) ? experienceMatch[1].trim() : undefined;

if (text.includes('non lisible') || text.includes('NON_LISIBLE') || text.includes('CV non lisible')) {
  decision = 'NON_LISIBLE';
}

return [{
  json: {
    candidateName,
    email: fromAddr || 'inconnu@email.com',
    subject,
    date,
    decision,
    score,
    skills,
    experience,
    rawSummary: text.slice(0, 500),
  },
}];
```

Après exécution, le nœud **HTTP Request** envoie ce JSON en **POST** vers ton API ; le dashboard affichera la nouvelle candidature après un clic sur **« Rafraîchir »** (ou au prochain chargement de la page).

---

## Comment tester de bout en bout

1. **Démarrer l’API** : dans le projet, `npm run server` (écoute sur le port 3005).
2. **Démarrer le frontend** : `npm run dev` (port 3000, proxy `/api` → 3005).
3. **Dans n8n** : ajouter les deux nœuds (Code + HTTP Request) après **Analyze CV** comme indiqué ci-dessus.  
   - URL du HTTP Request : `http://localhost:3005/api/candidatures` (si n8n est sur la même machine).  
   - Si n8n est sur un autre PC/serveur, utiliser l’IP ou l’URL publique de la machine qui héberge l’API (ex. `http://192.168.1.10:3005/api/candidatures`).
4. **Envoyer un email** depuis la boîte Gmail configurée dans le trigger (ou une autre) vers l’adresse surveillée par le trigger, avec une pièce jointe **PDF** ou **DOCX** (un CV).
5. Attendre l’exécution du workflow (trigger toutes les minutes, ou exécution manuelle).
6. Vérifier que l’email de synthèse est bien reçu à l’adresse RH (imadmanni@gmail.com).
7. Ouvrir le **dashboard** (http://localhost:3000/dashboard), cliquer sur **« Rafraîchir »** : la candidature doit apparaître dans la liste avec les données réelles (nom, décision, score, etc.).
