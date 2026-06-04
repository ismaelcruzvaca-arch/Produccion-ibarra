-- Rollback: 021_catalog_audit_columns
-- Revierte columnas de auditoría y triggers de tablas de catálogo

-- 1. Eliminar triggers
DROP TRIGGER IF EXISTS trg_stop_reasons_updated_at   ON public.stop_reasons;
DROP TRIGGER IF EXISTS trg_lines_updated_at           ON public.lines;
DROP TRIGGER IF EXISTS trg_machines_updated_at        ON public.machines;
DROP TRIGGER IF EXISTS trg_products_updated_at        ON public.products;
DROP TRIGGER IF EXISTS trg_shifts_updated_at          ON public.shifts;

-- 2. Eliminar función
DROP FUNCTION IF EXISTS public.update_catalog_timestamp();

-- 3. Eliminar columnas de auditoría
ALTER TABLE public.shifts       DROP COLUMN IF EXISTS updated_by;
ALTER TABLE public.products     DROP COLUMN IF EXISTS updated_by;
ALTER TABLE public.machines     DROP COLUMN IF EXISTS updated_by;
ALTER TABLE public.lines        DROP COLUMN IF EXISTS updated_by;
ALTER TABLE public.stop_reasons DROP COLUMN IF EXISTS updated_by;

ALTER TABLE public.shifts       DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.products     DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.machines     DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.lines        DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.stop_reasons DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.shifts       DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.products     DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.machines     DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.lines        DROP COLUMN IF EXISTS created_at;
ALTER TABLE public.stop_reasons DROP COLUMN IF EXISTS created_at;
