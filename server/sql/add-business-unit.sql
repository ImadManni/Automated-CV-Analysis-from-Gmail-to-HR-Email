-- BU RH (Payment Center Africa, etc.) — filtre matrice dashboard
ALTER TABLE candidatures
  ADD COLUMN IF NOT EXISTS business_unit VARCHAR(120);

COMMENT ON COLUMN candidatures.business_unit IS 'Code BU PCA (ex. PROCESSING_MONETIQUE) ; null = non renseigné';
