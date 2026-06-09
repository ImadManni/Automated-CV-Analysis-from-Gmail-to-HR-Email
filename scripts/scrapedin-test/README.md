# Test [scrapedin](https://github.com/linkedtales/scrapedin)

## Ce que fait scrapedin (réalité)

| Oui | Non |
|-----|-----|
| Nom, titre, localisation, expériences, compétences (HTML profil) | PDF CV uploadé sur LinkedIn |
| Login Puppeteer avec email/mot de passe | Scraping massif fiable en 2026 |
| 1 URL `/in/...` à la fois | API officielle LinkedIn |

Pour le PFE : le texte profil peut alimenter **le même pipeline OpenAI** que l’email, via `POST /api/test/analyze`.

## Prérequis

- Node.js 16 ou 18 (si erreur Puppeteer, essayer Node 16)
- Compte LinkedIn **perso** (risque captcha)
- API PCA démarrée : `npm run dev:server` (port 3005)
- MinIO + PostgreSQL si analyse complète

## Étapes

### 1. Installer

```powershell
cd scripts\scrapedin-test
copy .env.example .env
# Éditer .env : LINKEDIN_EMAIL, LINKEDIN_PASSWORD, TEST_PROFILE_URL
npm install
```

### 2. Tester 1 profil

```powershell
npm run test:one
```

- `isHeadless: false` → une fenêtre Chrome s’ouvre (login manuel possible)
- Résultat : `output/profile.json` + `output/profile-as-cv-text.txt`

### 3. Envoyer vers PCA

```powershell
npm run send:pca
```

Vérifie le dashboard et la fiche candidat (`source: linkedin`).

## Lier avec n8n (après test local OK)

1. **Execute Command** ou petit service Node qui appelle `test-one-profile.js`
2. **HTTP Request** → `POST /api/test/analyze` avec `body.text` = contenu txt
3. Ou réutiliser les nodes 8–12 du workflow IMAP en passant `text` directement (sans MinIO si pas de PDF)

## Problèmes fréquents

| Erreur | Solution |
|--------|----------|
| Puppeteer / Chromium | `npm install` dans ce dossier ; Node 16 |
| Login failed / captcha | Connexion manuelle fenêtre ; cookies (wiki scrapedin) |
| Texte < 50 car. | Profil privé ou login incomplet |
| 507 MinIO | Vider bucket `cvs` (voir `cleanup-minio-cvs.bat`) |

## Légal / encadrant

Mentionner au rapport : **preuve de concept**, données profil uniquement, pas de production RH sans accord LinkedIn / DPO.
