-- n8n sans droit CREATEDB : tables n8n isolées dans le schéma « n8n » (base pca).
-- Automatisé par npm run n8n:ensure-db si N8N_PG_SCHEMA=n8n dans .env.
CREATE SCHEMA IF NOT EXISTS n8n AUTHORIZATION CURRENT_USER;
