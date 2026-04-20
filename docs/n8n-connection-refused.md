# "The service refused the connection" — n8n → API

L’erreur **"The service refused the connection - perhaps it is offline"** sur le nœud **POST to Dashboard API** signifie que n8n n’arrive pas à joindre `http://localhost:3005/api/candidatures`.

---

## 1. n8n et le projet sur la **même machine**

- **Démarre l’API** dans un terminal (dossier du projet) :
  ```bash
  npm run server
  ```
  Tu dois voir : `PCA API (Express) running at http://localhost:3005`.

- **Vérifie** dans le navigateur : ouvre **http://localhost:3005/api/candidatures** → tu dois avoir du JSON (ex. `{"candidatures":[]}`). Si ça marche, n8n peut utiliser la même URL.

- **Relance le workflow** dans n8n après avoir démarré l’API.

---

## 2. n8n dans **Docker** ou sur **une autre machine**

Depuis n8n, **localhost** = la machine (ou le conteneur) où n8n tourne, pas ton PC où tu lances `npm run server`.

- **Option A — n8n en Docker sur ton PC**  
  Remplace dans le nœud HTTP Request :
  - **URL :** `http://host.docker.internal:3005/api/candidatures`  
  (sous Windows/Mac, `host.docker.internal` = la machine hôte.)

- **Option B — n8n sur le même PC mais pas en Docker**  
  Utilise l’IP locale de ta machine au lieu de `localhost` :
  - Exemple : `http://192.168.1.10:3005/api/candidatures`  
  (remplace par ton IP : `ipconfig` sous Windows, `ifconfig` / `ip a` sous Mac/Linux.)

- **Option C — n8n en cloud / autre serveur**  
  L’API doit être accessible depuis Internet (tunnel type ngrok, ou déploiement). Exemple avec ngrok sur ton PC :
  ```bash
  ngrok http 3005
  ```
  Puis dans n8n, URL du type : `https://xxxx.ngrok.io/api/candidatures`.

---

## 3. Récap

| Où tourne n8n ? | URL à mettre dans "POST to Dashboard API" |
|-----------------|------------------------------------------|
| Même PC, pas Docker | `http://localhost:3005/api/candidatures` (et l’API doit être lancée avec `npm run server`) |
| Docker sur ton PC | `http://host.docker.internal:3005/api/candidatures` |
| Autre machine / réseau | `http://IP_DE_LA_MACHINE_OU_TOURNE_L_API:3005/api/candidatures` |
| Cloud + API exposée | `https://ton-url-ngrok-ou-domaine/api/candidatures` |

L’API accepte déjà le champ **email** envoyé comme objet (ex. `email.value[0].address`) ; pas besoin de modifier le payload pour l’email.
