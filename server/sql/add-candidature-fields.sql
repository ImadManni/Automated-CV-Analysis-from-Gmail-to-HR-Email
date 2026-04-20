-- Champs candidat (extraction CV) : école, type école, téléphone, expérience
-- Exécuter en tant que propriétaire de la table (postgres) si besoin : psql -U postgres -d pca -f server/sql/add-candidature-fields.sql

ALTER TABLE candidatures ADD COLUMN IF NOT EXISTS school TEXT;
ALTER TABLE candidatures ADD COLUMN IF NOT EXISTS school_type VARCHAR(20); -- 'PUBLIC' | 'PRIVE' | null
ALTER TABLE candidatures ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE candidatures ADD COLUMN IF NOT EXISTS experience_count INTEGER; -- nombre de postes/expériences
ALTER TABLE candidatures ADD COLUMN IF NOT EXISTS experience_duration TEXT; -- ex: "5 ans", "2 ans 3 mois"
ALTER TABLE candidatures ADD COLUMN IF NOT EXISTS experience_years_avg DECIMAL(5,2); -- moyenne années d'expérience (optionnel)
ALTER TABLE candidatures ADD COLUMN IF NOT EXISTS last_employer TEXT;
