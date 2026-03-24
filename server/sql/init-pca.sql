-- PCA — Schéma initial PostgreSQL (Automated CV Analysis)
-- Exécuter après avoir créé la base : psql -U postgres -d pca -f server/sql/init-pca.sql

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

-- Unicité OAuth (provider + provider_id) ; les NULL sont exclus pour éviter doublons local
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_provider_id
  ON users(provider, provider_id) WHERE provider IS NOT NULL AND provider_id IS NOT NULL;
