-- Backfill de teléfonos normalizados para la búsqueda.
UPDATE "Client"
SET "phoneNormalized" = NULLIF(regexp_replace(COALESCE("phone", ''), '[^0-9]', '', 'g'), ''),
    "cellNormalized"  = NULLIF(regexp_replace(COALESCE("cell", ''), '[^0-9]', '', 'g'), '');
