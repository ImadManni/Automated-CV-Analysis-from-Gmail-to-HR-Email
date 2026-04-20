-- ============================================================
-- PCA — Campagnes, offres et lien candidature ↔ offre
-- Exécuter sur la base existante (après create-db-kamla.sql) :
--   psql -U pca_user -h 127.0.0.1 -d pca -f server/sql/add-campaigns-offers.sql
-- ============================================================

-- ========== Table campaigns ==========
-- Une campagne regroupe des offres (ex: "PCA 2025", "Recrutement Q1")
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
-- Une offre appartient à une campagne (ex: "Data Engineer", "Full-Stack JS")
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
-- Lien N-N : une candidature peut être associée à une ou plusieurs offres.
-- Score et décision par offre (pour analyse "par offre").
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

-- ========== Droits ==========
GRANT ALL PRIVILEGES ON TABLE campaigns TO pca_user;
GRANT ALL PRIVILEGES ON TABLE offers TO pca_user;
GRANT ALL PRIVILEGES ON TABLE candidature_offer TO pca_user;
GRANT USAGE, SELECT ON SEQUENCE campaigns_id_seq TO pca_user;
GRANT USAGE, SELECT ON SEQUENCE offers_id_seq TO pca_user;
GRANT USAGE, SELECT ON SEQUENCE candidature_offer_id_seq TO pca_user;
