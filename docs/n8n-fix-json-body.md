# Fix : « JSON parameter needs to be valid JSON » (POST to Dashboard API)

## Deux causes possibles

### 1. Double `=` (typo)

Si le champ contient **`=={{`** (deux signes =), n8n ne reconnaît pas l’expression.  
Il faut **un seul** `=` : **`={{`**.

### 2. Mode « Using JSON » + `JSON.stringify($json)`

En **Specify Body = Using JSON**, n8n attend en général **un objet** (il fait la conversion en JSON lui‑même).  
Si tu mets **`={{ JSON.stringify($json) }}`**, tu envoies une **chaîne**. Selon les versions, n8n peut refuser ou mal gérer ça et afficher « JSON parameter needs to be valid JSON ».

---

## Solution à appliquer (dans l’ordre)

### Étape 1 : Passer l’objet sans stringify

1. Ouvre le nœud **POST to Dashboard API**.
2. **Parameters** → champ **JSON** (Body Content).
3. Remplace tout le contenu par **exactement** (un seul `=`) :
   ```text
   ={{ $json }}
   ```
   Pas de `JSON.stringify`, pas de `==`.
4. Enregistre le workflow et exécute.

Si l’erreur disparaît, ne rien changer d’autre.

---

### Étape 2 : Si l’erreur reste avec `={{ $json }}`

Essaie d’envoyer le body en **chaîne JSON** :

1. Garde **Body Content Type** = JSON.
2. Dans le champ **JSON**, mets :
   ```text
   ={{ JSON.stringify($json) }}
   ```
   (un seul `=` devant `{{`).
3. Si ta version de n8n propose **Specify Body** = **« Raw »** ou **« String »**, utilise ce mode et mets la même expression :  
   `={{ JSON.stringify($json) }}`.

---

## Récap

| Ce que tu as peut‑être | À mettre en premier |
|-------------------------|----------------------|
| `=={{ JSON.stringify($json) }}` | `={{ $json }}` |
| `={{ JSON.stringify($json) }}` (et erreur) | `={{ $json }}` |

Tester d’abord **`={{ $json }}`** seul. Si l’erreur est toujours là, enchaîner avec l’étape 2.
