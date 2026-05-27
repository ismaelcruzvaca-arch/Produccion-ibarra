-- Rollback: 020_quality_rls
-- Revierte RLS, políticas, funciones, triggers, índices y columnas

-- 1. Eliminar políticas RLS
DROP POLICY IF EXISTS quality_inspections_operator_select ON public.quality_inspections;
DROP POLICY IF EXISTS quality_inspections_operator_insert ON public.quality_inspections;
DROP POLICY IF EXISTS quality_inspections_operator_update ON public.quality_inspections;
DROP POLICY IF EXISTS quality_inspections_supervisor_select ON public.quality_inspections;

DROP POLICY IF EXISTS defect_logs_operator_select ON public.defect_logs;
DROP POLICY IF EXISTS defect_logs_operator_insert ON public.defect_logs;
DROP POLICY IF EXISTS defect_logs_supervisor_select ON public.defect_logs;

DROP POLICY IF EXISTS weight_logs_operator_select ON public.weight_logs;
DROP POLICY IF EXISTS weight_logs_operator_insert ON public.weight_logs;
DROP POLICY IF EXISTS weight_logs_supervisor_select ON public.weight_logs;

-- 2. Deshabilitar RLS
ALTER TABLE public.weight_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.defect_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_inspections DISABLE ROW LEVEL SECURITY;

-- 3. Eliminar funciones helper
DROP FUNCTION IF EXISTS public.user_has_inspection_access(UUID);
DROP FUNCTION IF EXISTS public.user_has_line_access(UUID);

-- 4. Eliminar triggers y funciones de sync (orden inverso)
DROP TRIGGER IF EXISTS trg_weight_logs_sync_line_id ON public.weight_logs;
DROP FUNCTION IF EXISTS public.sync_weight_logs_line_id();

DROP TRIGGER IF EXISTS trg_defect_logs_sync_line_id ON public.defect_logs;
DROP FUNCTION IF EXISTS public.sync_defect_logs_line_id();

DROP TRIGGER IF EXISTS trg_quality_inspections_sync_line_id ON public.quality_inspections;
DROP FUNCTION IF EXISTS public.sync_quality_inspections_line_id();

-- 5. Eliminar índices
DROP INDEX IF EXISTS idx_weight_logs_line_id;
DROP INDEX IF EXISTS idx_defect_logs_line_id;
DROP INDEX IF EXISTS idx_quality_inspections_line_id;

-- 6. Eliminar columnas line_id (orden inverso por FKs)
ALTER TABLE public.weight_logs  DROP COLUMN IF EXISTS line_id;
ALTER TABLE public.defect_logs  DROP COLUMN IF EXISTS line_id;
ALTER TABLE public.quality_inspections DROP COLUMN IF EXISTS line_id;
