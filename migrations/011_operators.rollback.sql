-- Rollback: 011_operators
-- Elimina la tabla operators y sus objetos asociados
-- NOTA: Si shift_sessions existe, esta ejecución fallará por FK.
--       Ejecutar 012.rollback.sql PRIMERO.

DROP TRIGGER IF EXISTS trg_operators_updated_at ON public.operators;
DROP FUNCTION IF EXISTS public.update_operators_timestamp();
DROP TABLE IF EXISTS public.operators;
