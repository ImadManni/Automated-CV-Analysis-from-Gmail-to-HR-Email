# Fix: Invalid URL (=http... / -http...) et Code node "Cannot find name 'items'"

## 1. Node "Code in JavaScript" / "Build full upload URL"

**Problème :** "Cannot find name 'items'" → dans ta version n8n la variable `items` n'existe pas, il faut utiliser `$input.all()`.

**À faire :** Remplace tout le code du node par ceci :

```javascript
const items = $input.all();
const baseUrl = 'http://localhost:9000';

return items.map((item) => {
  const uploadUrl = String(item.json.uploadUrl || '').trim();
  let fullUploadUrl = baseUrl + uploadUrl;
  fullUploadUrl = fullUploadUrl.replace(/^[=]+/, '').replace(/^-+/, '');
  if (!fullUploadUrl.startsWith('http')) fullUploadUrl = baseUrl + uploadUrl;

  return {
    json: { ...item.json, fullUploadUrl },
    binary: item.binary,
  };
});
```

- Mode : **Run Once for All Items**
- Sauvegarde le node.

---

## 2. Node "3 - Upload CV to MinIO" – URL avec "=" devant

**Problème :** L'erreur dit `Invalid URL: =http://...` → le **`=`** de l'expression est envoyé dans l'URL. En n8n, il faut que le champ URL soit en **mode Expression** et que tu n'entres **que** l'expression, sans `={{` ni `}}`.

**À faire :**
1. Ouvre le node **"3 - Upload CV to MinIO"**.
2. Clique sur le champ **URL**.
3. À droite du champ (ou dans le menu du champ), passe en **mode Expression** (icône `fx` ou "Expression").
4. Dans le champ, écris **uniquement** :  
   `$json.fullUploadUrl`  
   (sans `={{`, sans `}}`, sans `=` devant).
5. **Input Data Field Name** : `attachment_0`.
6. Sauvegarde.

---

## 3. Vérifications

- Connexions : Merge → Code → Upload.
- Après correction, l'URL envoyée doit être exactement `http://localhost:9000/cvs/<uuid>` (sans `=`, sans `-` au début).
