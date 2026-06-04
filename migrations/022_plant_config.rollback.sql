-- Rollback: 022_plant_config
-- Revierte tabla plant_config y su trigger

DROP TRIGGER IF EXISTS trg_plant_config_updated_at ON public.plant_config;
DROP FUNCTION IF EXISTS public.update_plant_config_timestamp();
DROP TABLE IF EXISTS public.plant_config;
