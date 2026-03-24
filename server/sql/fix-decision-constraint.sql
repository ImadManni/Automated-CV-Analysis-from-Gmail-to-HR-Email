y-- À exécuter une fois : autorise les valeurs decision sans accent (évite erreur encodage)
-- psql -U pca_user -h 127.0.0.1 -d pca -f server/sql/fix-decision-constraint.sql

ALTER TABLE candidatures DROP CONSTRAINT IF EXISTS candidatures_decision_check;
ALTER TABLE candidatures ADD CONSTRAINT candidatures_decision_check
  CHECK (decision IN ('ACCEPTEE', 'REFUSEE', 'A REVOIR', 'NON_LISIBLE'));
