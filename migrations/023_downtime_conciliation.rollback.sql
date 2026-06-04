-- Rollback: 023_downtime_conciliation
-- Revierte tabla downtime_conciliation, triggers y función

-- 1. Eliminar triggers
DROP TRIGGER IF EXISTS trg_dt_conciliation_reconciled_mtto ON public.downtime_conciliation;
DROP TRIGGER IF EXISTS trg_dt_conciliation_insert_mtto ON public.downtime_conciliation;
DROP TRIGGER IF EXISTS trg_dt_conciliation_updated_at ON public.downtime_conciliation;

-- 2. Eliminar función
DROP FUNCTION IF EXISTS public.enqueue_oee_mtto_trigger();

-- 3. Eliminar índices
DROP INDEX IF EXISTS idx_dt_conciliation_updated_at;
DROP INDEX IF EXISTS idx_dt_conciliation_oee_event;
DROP INDEX IF EXISTS idx_dt_conciliation_shift;
DROP INDEX IF EXISTS idx_dt_conciliation_machine;
DROP INDEX IF EXISTS idx_dt_conciliation_status;

-- 4. Eliminar tabla
DROP TABLE IF EXISTS public.downtime_conciliation;
