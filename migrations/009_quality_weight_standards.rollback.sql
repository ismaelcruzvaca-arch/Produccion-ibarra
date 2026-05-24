-- Rollback: 009_quality_weight_standards
-- Elimina la tabla product_weight_standards y sus objetos asociados

DROP TRIGGER IF EXISTS trg_weight_standards_updated_at ON public.product_weight_standards;
DROP FUNCTION IF EXISTS public.update_weight_standards_timestamp();
DROP TABLE IF EXISTS public.product_weight_standards;
