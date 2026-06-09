-- ============================================================
-- PCA — Création complète de la base (utilisateur + DB + tables)
-- Exécuter UNE FOIS avec l'utilisateur postgres :
--   psql -U postgres -h localhost -f server/sql/create-db-kamla.sql
--
-- Remplace PCA_PASSWORD ci-dessous par ton mot de passe pour pca_user.
-- ============================================================

-- 1) Créer l'utilisateur (si déjà existant, erreur ignorable)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pca_user') THEN
    CREATE USER pca_user WITH PASSWORD 'PCA_PASSWORD';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- 2) Créer la base (si tu la relances et que pca existe déjà, tu auras une erreur "already exists" → tu peux ignorer)
CREATE DATABASE pca OWNER pca_user;

-- 3) Se connecter à la base pca (obligatoire pour la suite)
\c pca

-- 4) Droits sur le schéma public
GRANT ALL ON SCHEMA public TO pca_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO pca_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO pca_user;

-- ========== Table candidatures ==========
CREATE TABLE IF NOT EXISTS candidatures (
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

CREATE INDEX IF NOT EXISTS idx_candidatures_decision ON candidatures(decision);
CREATE INDEX IF NOT EXISTS idx_candidatures_date ON candidatures(date);
CREATE INDEX IF NOT EXISTS idx_candidatures_email ON candidatures(email);

-- ========== Table users ==========
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  name          VARCHAR(255),
  password_hash VARCHAR(255),
  provider      VARCHAR(50),
  provider_id   VARCHAR(255),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_provider_id
  ON users(provider, provider_id) WHERE provider IS NOT NULL AND provider_id IS NOT NULL;

-- ========== Table campaigns ==========
CREATE TABLE IF NOT EXISTS campaigns (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  code        VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  start_date  TIMESTAMP,
  end_date    TIMESTAMP,
  status      VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'CLOSED')),
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_campaigns_code ON campaigns(code);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- ========== Table offers ==========
CREATE TABLE IF NOT EXISTS offers (
  id           SERIAL PRIMARY KEY,
  campaign_id  INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  title        VARCHAR(255) NOT NULL,
  reference    VARCHAR(100) NOT NULL,
  description  TEXT,
  location     VARCHAR(255),
  salary_min   DECIMAL(12,2),
  salary_max   DECIMAL(12,2),
  status       VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'CLOSED')),
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW(),
  UNIQUE(campaign_id, reference)
);
CREATE INDEX IF NOT EXISTS idx_offers_campaign_id ON offers(campaign_id);
CREATE INDEX IF NOT EXISTS idx_offers_reference ON offers(reference);
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);

-- ========== Table candidature_offer ==========
CREATE TABLE IF NOT EXISTS candidature_offer (
  id              SERIAL PRIMARY KEY,
  candidature_id  INTEGER NOT NULL REFERENCES candidatures(id) ON DELETE CASCADE,
  offer_id        INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  status          VARCHAR(50) NOT NULL DEFAULT 'A REVOIR'
    CHECK (status IN ('ACCEPTEE', 'REFUSEE', 'A REVOIR', 'NON_LISIBLE')),
  score           DECIMAL(5,2) CHECK (score >= 0 AND score <= 100),
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(candidature_id, offer_id)
);
CREATE INDEX IF NOT EXISTS idx_candidature_offer_candidature ON candidature_offer(candidature_id);
CREATE INDEX IF NOT EXISTS idx_candidature_offer_offer ON candidature_offer(offer_id);
CREATE INDEX IF NOT EXISTS idx_candidature_offer_status ON candidature_offer(status);

-- 5) Donner les droits à pca_user sur les tables et séquences
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pca_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pca_user;
