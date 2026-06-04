-- Rollback: 015_mezclado_tables
-- Elimina las 3 tablas del módulo de mezclado en orden inverso a las dependencias
-- (ingredientes depende de batches via FK)
--
-- Orden:
--   1. mezclado_ingredients (depende de mezclado_batches via FK)
--   2. mezclado_shift_totals (independiente)
--   3. mezclado_batches (cabecera)
--   4. Funciones trigger (no se eliminan automáticamente con DROP TABLE)
--
-- Nota: CASCADE asegura que índices, triggers y constraints dependientes
-- se eliminen automáticamente al dropear cada tabla.

DROP TABLE IF EXISTS public.mezclado_ingredients CASCADE;
DROP TABLE IF EXISTS public.mezclado_shift_totals CASCADE;
DROP TABLE IF EXISTS public.mezclado_batches CASCADE;

-- Funciones trigger (ya no referenciadas después de DROP TABLE)
DROP FUNCTION IF EXISTS public.update_mezclado_batches_timestamp();
DROP FUNCTION IF EXISTS public.update_mezclado_shift_totals_timestamp();
