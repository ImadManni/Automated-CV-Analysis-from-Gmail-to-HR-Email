# Paramétrage du nœud HTTP Request (POST to Dashboard API)

## Erreur « JSON parameter needs to be valid JSON »

Deux causes possibles :

1. **Typo :** `=={{ $json }}` (deux `=`) → mettre **`={{ $json }}`** (un seul `=`).
2. **Objet non accepté :** avec `={{ $json }}`, n8n peut afficher `[object Object]` et refuser. Dans ce cas, **envoie une chaîne JSON** :
   - **Valeur à mettre dans le champ JSON (Body) :**  
     `={{ JSON.stringify($json) }}`  
   Ainsi le body est une chaîne JSON valide (`{"candidateName":"...", ...}`) et l’erreur disparaît.

---

## Paramétrage

Pour envoyer tout l’objet du nœud **Build Payload for Dashboard** en corps de la requête, configure le nœud comme suit.

---

## 1. Méthode et URL

- **Method:** `POST`
- **URL:** `http://localhost:3005/api/candidatures`

---

## 2. Corps de la requête (Body)

Tu as **Send Body** activé et **Body Content Type** = JSON. C’est bon.

Au lieu de **"Using Fields Below"** (où il faut ajouter chaque champ à la main) :

1. Dans **Specify Body**, choisis **"Using JSON"** (ou **"JSON"** / **"Define body with JSON"** selon la version de n8n).
2. Dans le champ **JSON** (ou **Body**), mets exactement :

   ```text
   {{ $json }}
   ```

   Ou en expression n8n :

   ```text
   ={{ $json }}
   ```

Cela envoie tout l’objet du nœud précédent (Build Payload for Dashboard) comme corps JSON. L’API reçoit donc `candidateName`, `email`, `subject`, `date`, `decision`, `score`, `skills`, `experience`, `rawSummary`, etc.

---

## 3. Si tu restes en "Using Fields Below"

Tu peux aussi laisser **Specify Body** = **Using Fields Below** et ajouter un seul paramètre :

- **Name:** (vide ou un nom quelconque, ex. `body`)
- **Value:** `={{ $json }}`  
  (ou en mode expression : le bloc d’expression et tu choisis "JSON" / tout l’objet)

Certaines versions de n8n n’acceptent qu’un champ "body" ou "json" avec l’objet entier. Dans ce cas, un seul champ dont la valeur est `={{ $json }}` suffit.

---

## 4. Récap

| Paramètre        | Valeur |
|------------------|--------|
| Method           | POST   |
| URL              | `http://localhost:3005/api/candidatures` |
| Send Body        | Oui    |
| Body Content Type| JSON   |
| Specify Body     | **Using JSON** |
| JSON (corps)     | `={{ JSON.stringify($json) }}` (recommandé si erreur "valid JSON") ou `={{ $json }}` |

Pas besoin d’Authentication, Send Query Parameters ou Send Headers pour cette API.

Enregistre le nœud, exécute le workflow (avec l’API lancée sur 3005) : le POST enverra tout le payload et la candidature sera enregistrée.
