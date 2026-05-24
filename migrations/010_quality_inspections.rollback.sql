-- Rollback: 010_quality_inspections
-- Elimina las 3 tablas transaccionales en orden inverso (respetando FKs)

DROP INDEX IF EXISTS idx_weight_logs_inspection_id;
DROP INDEX IF EXISTS idx_defect_logs_severity;
DROP INDEX IF EXISTS idx_defect_logs_inspection_id;
DROP INDEX IF EXISTS idx_quality_inspections_disposition;
DROP INDEX IF EXISTS idx_quality_inspections_created_at;
DROP INDEX IF EXISTS idx_quality_inspections_machine_id;

DROP TRIGGER IF EXISTS trg_quality_inspections_updated_at ON public.quality_inspections;
DROP FUNCTION IF EXISTS public.update_quality_inspections_timestamp();

DROP TABLE IF EXISTS public.weight_logs;
DROP TABLE IF EXISTS public.defect_logs;
DROP TABLE IF EXISTS public.quality_inspections;
