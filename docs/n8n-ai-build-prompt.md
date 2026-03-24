# Prompt pour N8N AI Build — Automated CV (Gmail → HR → Dashboard)

Copiez-collez le bloc ci-dessous dans N8N AI Build pour générer ou adapter le workflow.

---

## Prompt

```
Workflow en 3 parties pour "Automated CV Analysis from Gmail to HR Email to Dashboard".

**Part 1 — SMTP/IMAP Trigger**
- Un nœud "Email Trigger" (IMAP ou SMTP) qui :
  - lit les e-mails entrants
  - télécharge les pièces jointes (downloadAttachments: true)
  - nomme la pièce jointe "attachment_0" (dataPropertyAttachmentsPrefixName: "attachment_0")

**Part 2 — Init candidat (API backend)**
- Un nœud "If" qui vérifie : la pièce jointe existe (ex. $binary.attachment_0 !== undefined).
  - Sortie TRUE : enchaîner vers l’appel API.
  - Sortie FALSE : enchaîner vers un nœud "No Attachment" qui met status: "no_attachment" et email (expéditeur) pour traçabilité.
- Un nœud HTTP Request POST vers l’API backend (ex. http://localhost:3005/api/candidatures) avec body JSON :
  - email (depuis l’e-mail reçu, ex. $json.from)
  - fullName (depuis sujet ou corps)
  - source: "email"
- L’API doit renvoyer dans la réponse : candidateId (UUID), uploadUrl (URL pré-signée MinIO pour PUT).
- Gérer l’erreur API (onError: continueErrorOutput) et brancher vers un nœud "Log API Error" (status: "api_error", error, email).

**Part 3 — Upload CV vers MinIO**
- Un nœud HTTP Request PUT :
  - URL : ={{ $json.uploadUrl }} (celle renvoyée par l’API en Part 2)
  - Body : binaire de la pièce jointe (ex. inputDataFieldName: "attachment_0", contentType: "binaryData")
- En cas de succès : nœud "Format Success Response" (status: "uploaded", candidateId).
- En cas d’erreur upload (onError: continueErrorOutput) : nœud "Log Upload Error" (status: "upload_error", error, candidateId).

Résumé des connexions :
- Trigger → If (Check Attachment Present)
- If TRUE → Initialize Candidate API
- If FALSE → No Attachment (Set: status "no_attachment", email)
- Initialize Candidate API Success → Upload CV to MinIO
- Initialize Candidate API Error → Log API Error
- Upload CV Success → Format Success Response
- Upload CV Error → Log Upload Error
```

---

## Backend attendu (Part 2)

L’endpoint (ex. `POST /api/candidatures` ou `POST /api/candidates/init`) doit :

1. Générer un UUID pour le candidat.
2. Enregistrer en base PostgreSQL (candidat, statut « pending_upload »).
3. Générer une URL pré-signée MinIO (PUT, expiration courte).
4. Répondre en JSON : `{ "candidateId": "...", "uploadUrl": "https://..." }`.

Sans ce backend, le workflow Part 2 peut être simulé avec un nœud "Set" qui renvoie un `uploadUrl` de test pour développer Part 3.
