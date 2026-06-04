-- Rollback: 016_tostado_tables
-- Elimina las 2 tablas del módulo de tostado
--
-- Orden:
--   1. tostado_hourly (depende de machines y operators via FK)
--   2. tostado_shift_totals (depende de machines y operators via FK)
--   3. Funciones trigger (no se eliminan automáticamente con DROP TABLE)
--
-- Nota: CASCADE asegura que índices, triggers y constraints dependientes
-- se eliminen automáticamente al dropear cada tabla.

DROP TABLE IF EXISTS public.tostado_hourly CASCADE;
DROP TABLE IF EXISTS public.tostado_shift_totals CASCADE;

-- Funciones trigger (ya no referenciadas después de DROP TABLE)
DROP FUNCTION IF EXISTS public.update_tostado_hourly_timestamp();
DROP FUNCTION IF EXISTS public.update_tostado_shift_totals_timestamp();
