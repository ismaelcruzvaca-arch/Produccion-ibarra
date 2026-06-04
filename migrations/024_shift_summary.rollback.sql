-- Rollback: 024_shift_summary
-- Revierte tabla shift_summary y su trigger

DROP TRIGGER IF EXISTS trg_shift_summary_updated_at ON public.shift_summary;
DROP FUNCTION IF EXISTS public.update_shift_summary_timestamp();
DROP TABLE IF EXISTS public.shift_summary;
