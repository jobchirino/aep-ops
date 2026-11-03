-- Índices trigram para búsquedas rápidas con contains (LIKE '%texto%').
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Client_normalizedName_trgm_idx"
  ON "Client" USING gin ("normalizedName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Client_phoneNormalized_trgm_idx"
  ON "Client" USING gin ("phoneNormalized" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Client_cellNormalized_trgm_idx"
  ON "Client" USING gin ("cellNormalized" gin_trgm_ops);
