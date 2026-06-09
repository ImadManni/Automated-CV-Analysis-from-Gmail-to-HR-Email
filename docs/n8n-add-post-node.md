# Ajouter le nœud "POST to Dashboard API" (manquant dans ton workflow)

Dans ton workflow, **"Build Payload for Dashboard"** n’est connecté à aucun nœud et le nœud **POST to Dashboard API** n’apparaît pas. Il faut l’ajouter et le brancher.

---

## 1. Ajouter le nœud HTTP Request

1. Dans n8n, clique sur **+** (ajouter un nœud) après **Build Payload for Dashboard**.
2. Cherche **HTTP Request**.
3. Ajoute-le et nomme-le **POST to Dashboard API**.

---

## 2. Configurer le nœud

- **Method:** `POST`
- **URL:** `http://localhost:3005/api/candidatures`
- **Send Body:** Oui
- **Body Content Type:** `JSON`
- **Specify Body:** Using JSON
- **JSON Body:** `={{ $json }}`

(Sinon « Using fields below » et un seul champ avec le JSON du nœud précédent.)

---

## 3. Connecter les nœuds

- Fais partir une flèche de **Build Payload for Dashboard** vers **POST to Dashboard API**.

Tu dois avoir : **Analyze CV** → **Build Payload for Dashboard** → **POST to Dashboard API**.

---

## 4. Vérifier que l’API tourne

Avant d’exécuter le workflow :

```bash
npm run server
```

Tu dois voir : `PCA API (Express) running at http://localhost:3005`.

Tant que cette fenêtre reste ouverte, l’URL `http://localhost:3005/api/candidatures` est joignable depuis n8n (sans Docker).

---

## Résumé

| Problème | Solution |
|----------|----------|
| Nœud POST manquant | Ajouter un nœud **HTTP Request** nommé "POST to Dashboard API". |
| Build Payload non connecté | Connecter **Build Payload for Dashboard** → **POST to Dashboard API**. |
| "The service refused the connection" | Lancer **npm run server** et garder le terminal ouvert. |

Après ça, exécute le workflow : le POST doit atteindre l’API et la candidature apparaîtra dans le dashboard après un clic sur « Rafraîchir ».
