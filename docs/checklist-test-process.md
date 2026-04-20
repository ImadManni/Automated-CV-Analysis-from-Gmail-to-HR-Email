# Checklist — Tester le process complet du projet

## DB / Stockage

Il n’y a **pas de base de données externe** (PostgreSQL, etc.).  
Les candidatures sont stockées dans **`server/data/candidatures.json`** par l’API (Express sur le port 3005). Donc « DB » = ce fichier + l’API qui le lit/écrit.

---

## Ordre pour que tout soit bon (kolchi mzn)

### 1. Démarrer l’API (obligatoire)

- Dans un terminal : **`npm run server`** (ou la fenêtre "PCA API" si tu as utilisé `npm run start`).
- Tu dois voir : **`PCA API (Express) running at http://localhost:3005`**.
- Test rapide : ouvre **http://localhost:3005/api/candidatures** dans le navigateur → tu dois avoir du JSON (ex. `{"candidatures":[]}`).

Sans API sur 3005, le dashboard et n8n ne peuvent pas envoyer/récupérer les candidatures.

### 2. Démarrer le front

- Dans un autre terminal : **`npm run dev`**.
- Le front peut être sur **3002** ou **3003** si 3002 est pris.
- Ouvre l’URL affichée (ex. **http://localhost:3002** ou **http://localhost:3003**) pour le site et le dashboard.

### 3. Fichier `.env`

- **`VITE_API_URL`** doit rester **vide** (ou non défini) pour que le front appelle `/api` sur la même origine ; Vite redirige alors vers l’API (3005).  
- Ne mets pas l’URL du front (3002/3003) dans `VITE_API_URL`.

### 4. n8n — POST to Dashboard API

- **Erreur "The service refused the connection"** = n8n n’atteint pas l’API.
- **n8n sur la même machine** : garde **`http://localhost:3005/api/candidatures`** et assure-toi que l’API tourne bien (étape 1).
- **n8n dans Docker** (sur le même PC) : mets **`http://host.docker.internal:3005/api/candidatures`** dans le nœud HTTP Request.

---

## Tester le process de A à Z

1. API sur 3005 + front sur 3002/3003 (étapes 1 et 2).
2. Dans n8n : exécuter le workflow (ex. envoi d’un email avec CV en pièce jointe vers la boîte du Gmail Trigger).
3. Vérifier l’email reçu à **imadmanni@gmail.com** (synthèse CV).
4. Dashboard : ouvre **http://localhost:3002** (ou 3003) → **Tableau de bord** → **Rafraîchir** → la candidature doit apparaître.
5. Swagger : **http://localhost:3002/docs** (ou 3003/docs) → **GET /api/candidatures** → Execute → tu dois voir la même candidature en JSON.

Quand l’API tourne sur 3005 et que n8n peut l’atteindre (localhost ou host.docker.internal), tout le process est bon pour les tests.
