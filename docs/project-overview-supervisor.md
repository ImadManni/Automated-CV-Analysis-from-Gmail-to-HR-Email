# Projet : Automated CV Analysis from Gmail to HR Email to Dashboard

## Document pour l’encadrant — Vue d’ensemble détaillée

---

## 1. Objectif du projet

Automatiser le traitement des candidatures reçues par e-mail : dès qu’un CV est envoyé à une adresse dédiée (ex. RH), le système le récupère, enregistre le candidat, stocke le CV (MinIO), et met à jour le tableau de bord (dashboard) pour les équipes RH.

**Enchaînement global :**  
**Gmail (e-mail avec CV)** → **Trigger** → **Backend (candidat + URL MinIO)** → **Stockage CV (MinIO)** → **Dashboard (consultation des candidatures).**

---

## 2. Architecture globale

| Couche | Rôle |
|--------|------|
| **N8N** | Orchestration des workflows : réception e-mail, vérification pièce jointe, appels API, upload MinIO. |
| **Backend (Node/Express ou Spring)** | API REST : création candidat (UUID), persistance PostgreSQL, génération d’URL pré-signée MinIO. |
| **PostgreSQL** | Base de données : candidats, métadonnées, statuts. |
| **MinIO** | Stockage objet (S3-compatible) : fichiers CV (PDF, DOCX, etc.). |
| **Frontend (React)** | Dashboard : liste des candidatures, détail, statistiques. |

---

## 3. Workflow N8N — Découpage en 3 parties

### Partie 1 : SMTP / IMAP Trigger (réception des e-mails)

- **Rôle :** Détecter les nouveaux e-mails (ex. via IMAP) contenant éventuellement des pièces jointes (CV).
- **Configuration :** Compte e-mail (IMAP), option « download attachments » activée, préfixe des pièces jointes (ex. `attachment_0`).
- **Sortie :** Un item par e-mail, avec métadonnées (expéditeur, sujet, date) et binaires des pièces jointes (`attachment_0`, etc.).

---

### Partie 2 : Appel API backend — Init candidat + persistance + URL MinIO

- **Rôle :**
  1. Créer le candidat côté backend (génération UUID, enregistrement en base PostgreSQL).
  2. Obtenir une **URL pré-signée (presigned URL)** vers MinIO pour uploader le CV.
- **Méthode :** `POST` vers l’API backend (ex. `http://localhost:3005/api/candidatures` ou endpoint dédié « init candidat »).
- **Corps typique :** `email`, `fullName`, `source: "email"` (et autres champs métier si besoin).
- **Réponse attendue du backend :**  
  - `candidateId` (UUID),  
  - `uploadUrl` (URL pré-signée MinIO pour PUT du fichier).
- **Persistance :** Le backend enregistre en PostgreSQL (candidat, statut « pending_upload » ou équivalent).

---

### Partie 3 : Upload du CV vers MinIO (URL pré-signée)

- **Rôle :** Envoyer le fichier CV (binaire) vers MinIO en utilisant l’URL fournie par le backend.
- **Méthode :** `PUT` vers `uploadUrl` (valeur renvoyée par l’API en Partie 2).
- **Corps :** Binaire de la pièce jointe (ex. `attachment_0`).
- **Après succès :** Le backend peut être notifié (webhook ou autre) pour passer le statut à « uploaded » ; le dashboard affiche la candidature avec le CV stocké.

---

## 4. Gestion des cas « false » (pas de pièce jointe)

- **Condition actuelle :** « Check Attachment Present » = vrai si `$binary.attachment_0 !== undefined`.
- **Branche false :** Quand l’e-mail n’a **pas** de pièce jointe, l’item part sur la sortie « false ». Si rien n’est connecté, le flux s’arrête sans trace.
- **Correction :** Connecter la sortie **false** à un nœud dédié, par exemple :
  - **« No Attachment — Skip »** : Set `status: "no_attachment"`, optionnellement `email`, `reason`, pour log / suivi ou envoi d’un e-mail automatique « Merci d’envoyer votre CV en pièce jointe ».

Cela évite que le flux « false » ne soit ignoré et permet de tracer ou réagir aux e-mails sans CV.

---

## 5. Synthèse pour l’encadrant

- **Part 1** : Trigger e-mail (SMTP/IMAP) + téléchargement des pièces jointes.
- **Part 2** : API backend (init candidat, UUID, PostgreSQL, génération URL MinIO).
- **Part 3** : Upload du CV vers MinIO via l’URL pré-signée.

Le projet couvre donc : **réception → enregistrement candidat → stockage fichier → visibilité dans le dashboard**, avec une séparation claire entre orchestration (N8N), logique métier et persistance (backend + PostgreSQL), et stockage fichier (MinIO).

---

## 6. Fixes n8n (dépannage)

### « Unauthorized / Token required » dans le navigateur
- En ouvrant `http://localhost:3005/api/candidatures` dans le navigateur, c’est un **GET** → le backend exige un token (normal).
- Le workflow n8n fait un **POST** vers la même URL → **aucun token n’est requis** côté backend. Il faut juste que le serveur tourne.

### « Log API Error » : champ `email` = null
- Le champ `email` utilise une expression qui pointe vers le mauvais nœud ou le mauvais chemin.
- **À faire dans n8n** : dans le nœud « Log API Error », pour le champ **email** :
  - Si ton trigger s’appelle **« SMTP Trigger »** :  
    `{{ $('SMTP Trigger').item.json.from }}`
  - Si ton trigger s’appelle **« Gmail Trigger »** : l’expéditeur peut être dans les headers. Utilise par exemple :  
    `{{ $('Gmail Trigger').item.json.from || $('Gmail Trigger').item.json.attributes?.from || $json.from || $json.attributes?.from || 'unknown' }}`
- Vérifie le **nom exact** du premier nœud (trigger) dans ton workflow et utilise-le dans l’expression.

### « Initialize Candidate API » en Error Branch / ECONNREFUSED
- **ECONNREFUSED** = le backend (Node sur le port 3005) ne tourne pas au moment où n8n exécute le workflow.
- **À faire** : lancer le serveur avant d’exécuter le workflow :  
  `npm run server` (ou la commande utilisée pour le backend), et vérifier qu’il écoute sur le port **3005**.

### « Upload CV to MinIO » : « No items were sent on this branch »
- Cela arrive quand « Initialize Candidate API » a échoué (Error Branch) → rien ne part sur la branche Success.
- Une fois le backend démarré et le POST qui réussit, des items seront envoyés sur la branche Success vers « Upload CV to MinIO ». Le backend renvoie déjà `candidateId` et `uploadUrl` dans la réponse du POST.
