-- Rollback: 017_vitaminas_tables
-- Elimina las 3 tablas del módulo de mezclado de vitaminas en orden inverso
-- a las dependencias (ingredientes depende de batches via FK)
--
-- Orden:
--   1. vitaminas_ingredients (depende de vitaminas_batches via FK)
--   2. vitaminas_kit_inventory (independiente)
--   3. vitaminas_batches (cabecera)
--   4. Funciones trigger (no se eliminan automáticamente con DROP TABLE)
--
-- Nota: CASCADE asegura que índices, triggers y constraints dependientes
-- se eliminen automáticamente al dropear cada tabla.

DROP TABLE IF EXISTS public.vitaminas_ingredients CASCADE;
DROP TABLE IF EXISTS public.vitaminas_kit_inventory CASCADE;
DROP TABLE IF EXISTS public.vitaminas_batches CASCADE;

-- Funciones trigger (ya no referenciadas después de DROP TABLE)
DROP FUNCTION IF EXISTS public.update_vitaminas_batches_timestamp();
DROP FUNCTION IF EXISTS public.update_vitaminas_kit_inventory_timestamp();
