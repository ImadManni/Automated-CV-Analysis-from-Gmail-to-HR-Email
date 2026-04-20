# Modèle de base de données — Automated CV Analysis (PCA)

Document de conception pour la base de données du projet. Les colonnes marquées **« À valider »** seront confirmées lors de la conception complète de la base.

---

## 1. Vue d’ensemble

- **Candidatures** : reçues par email (n8n), stockées avec décision, score, CV (MinIO).
- **Utilisateurs** : authentification (email/mot de passe + OAuth Google/GitHub), accès au dashboard.

---

## 2. Entités et tables

### 2.1 Table `candidatures`

Stocke les candidatures envoyées par le workflow n8n (Gmail → API → MinIO).

| Colonne         | Type         | Contraintes        | Description |
|-----------------|-------------|--------------------|-------------|
| `id`            | INTEGER     | PK, AUTO INCREMENT | Identifiant interne unique |
| `candidate_id`  | UUID        | UNIQUE, NOT NULL   | Identifiant public (ex. pour chemin CV MinIO `/cvs/{candidate_id}`) |
| `candidate_name`| VARCHAR(255)| NOT NULL           | Nom du candidat |
| `email`         | VARCHAR(255)| NOT NULL           | Email du candidat |
| `subject`       | VARCHAR(500)|                    | Objet de l’email / offre |
| `date`          | TIMESTAMP   | NOT NULL           | Date de réception ou de traitement |
| `decision`      | VARCHAR(50) | NOT NULL           | `ACCEPTÉE` \| `REFUSÉE` \| `À REVOIR` \| `NON_LISIBLE` |
| `score`         | DECIMAL(5,2)|                    | Score d’analyse (ex. 0–100) — **à valider** |
| `skills`        | TEXT        |                    | Compétences extraites — **à valider** |
| `experience`    | TEXT        |                    | Résumé expérience — **à valider** |
| `raw_summary`   | TEXT        |                    | Synthèse brute / texte extrait — **à valider** |
| `source`        | VARCHAR(50)|                    | Origine : `email`, `upload`, etc. — **à valider** |
| `cv_path`       | VARCHAR(500)|                    | Chemin stockage CV (ex. `/cvs/{candidate_id}`) — **à valider** |
| `created_at`    | TIMESTAMP   | DEFAULT NOW()      | Création — **à valider** |
| `updated_at`    | TIMESTAMP   |                    | Dernière mise à jour — **à valider** |
| *(autres)*      | —           |                    | Autres colonnes à définir en conception complète |

**Index suggérés :** `(decision)`, `(date)`, `(email)`.

---

### 2.2 Table `users`

Utilisateurs du dashboard (auth locale + OAuth).

| Colonne        | Type         | Contraintes        | Description |
|----------------|--------------|--------------------|-------------|
| `id`           | INTEGER      | PK, AUTO INCREMENT | Identifiant interne |
| `email`        | VARCHAR(255) | UNIQUE, NOT NULL    | Email de connexion |
| `name`         | VARCHAR(255) |                    | Nom affiché |
| `password_hash`| VARCHAR(255) |                    | Hash bcrypt (null si uniquement OAuth) |
| `provider`     | VARCHAR(50)  |                    | `local`, `google`, `github` — **à valider** |
| `provider_id`  | VARCHAR(255) |                    | ID externe OAuth — **à valider** |
| `created_at`   | TIMESTAMP    | DEFAULT NOW()       | **À valider** |
| `updated_at`   | TIMESTAMP    |                     | **À valider** |

**Contrainte d’unicité** : `(provider, provider_id)` pour OAuth.

---

### 2.3 Tables à valider en conception complète

- **Offres / postes** : si on lie une candidature à une offre (ex. `offer_id` dans `candidatures`).
- **Commentaires / notes** : notes RH sur une candidature.
- **Pièces jointes** : plusieurs fichiers par candidature (au-delà du CV unique).
- **Historique des décisions** : audit des changements de statut.

---

## 3. Schéma relationnel (simplifié)

```
┌─────────────────────┐
│      users          │
├─────────────────────┤
│ id (PK)             │
│ email (UNIQUE)      │
│ name                │
│ password_hash       │
│ provider            │
│ provider_id         │
└─────────────────────┘

┌─────────────────────────────────────────┐
│            candidatures                  │
├─────────────────────────────────────────┤
│ id (PK, AUTO INCREMENT)                  │
│ candidate_id (UUID, UNIQUE)              │
│ candidate_name                           │
│ email                                    │
│ subject                                  │
│ date                                     │
│ decision                                 │
│ score                                    │
│ skills         — à valider               │
│ experience     — à valider               │
│ raw_summary    — à valider               │
│ source         — à valider               │
│ cv_path        — à valider               │
│ created_at     — à valider               │
│ updated_at     — à valider               │
└─────────────────────────────────────────┘
```

Pour une phase ultérieure : clé étrangère `created_by_user_id` → `users.id` si on trace qui a créé/modifié la fiche.

---

## 4. Exemple SQL (PostgreSQL)

```sql
-- Candidatures
CREATE TABLE candidatures (
  id             SERIAL PRIMARY KEY,
  candidate_id   UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  candidate_name VARCHAR(255) NOT NULL,
  email          VARCHAR(255) NOT NULL,
  subject        VARCHAR(500),
  date           TIMESTAMP NOT NULL DEFAULT NOW(),
  decision       VARCHAR(50) NOT NULL DEFAULT 'À REVOIR'
    CHECK (decision IN ('ACCEPTÉE', 'REFUSÉE', 'À REVOIR', 'NON_LISIBLE')),
  score          DECIMAL(5,2),
  skills         TEXT,
  experience     TEXT,
  raw_summary    TEXT,
  source         VARCHAR(50),
  cv_path        VARCHAR(500),
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_candidatures_decision ON candidatures(decision);
CREATE INDEX idx_candidatures_date ON candidatures(date);
CREATE INDEX idx_candidatures_email ON candidatures(email);

-- Users (existant en JSON, à migrer)
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  name          VARCHAR(255),
  password_hash VARCHAR(255),
  provider      VARCHAR(50),
  provider_id   VARCHAR(255),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW(),
  UNIQUE(provider, provider_id)
);
```

---

## 5. Correspondance avec l’existant (API / JSON)

| Fichier / API        | Équivalent en BDD        |
|----------------------|---------------------------|
| `candidatures.json`   | Table `candidatures`      |
| `users.json`          | Table `users`             |
| `id` (number)        | `candidatures.id`         |
| `candidateId` (UUID)  | `candidatures.candidate_id` |
| `uploadUrl` / chemin  | `candidatures.cv_path`   |

Les autres colonnes (skills, experience, raw_summary, source, created_at, updated_at, etc.) sont à valider et à figer lors de la conception complète de la base.
