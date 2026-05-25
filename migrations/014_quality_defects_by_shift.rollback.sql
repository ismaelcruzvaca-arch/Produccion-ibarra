-- Rollback: 014_quality_defects_by_shift
-- Elimina las columnas agregadas a quality_inspections
--
-- Orden: inspector_type primero (depende de inspector_id), luego data_source

ALTER TABLE public.quality_inspections DROP COLUMN IF EXISTS inspector_type;
ALTER TABLE public.quality_inspections DROP COLUMN IF EXISTS data_source;
