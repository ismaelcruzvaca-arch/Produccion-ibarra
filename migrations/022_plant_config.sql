-- Migration: 022_plant_config
-- Plant Config — key-value table for plant-level configuration parameters.
--
-- Dependencias: ninguna (tabla independiente)
--
-- Propósito:
--   Almacena parámetros de configuración de planta como pares key-value.
--   El primer parámetro es micro_stop_threshold_min (umbral de micro-paro en minutos).
--   Se lee al inicio de la app y se puede modificar desde Settings sin redeploy.
--
-- Seed inicial:
--   micro_stop_threshold_min = '5' — duración mínima (en minutos) para considerar
--   un paro como conciliable. Paros con duración menor se clasifican como micro-paros
--   y no generan conciliación ni OT.
--
-- ================================================================
-- SECTION 1: CREATE TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS public.plant_config (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    description TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.plant_config IS
  'Configuración de planta — pares key-value para parámetros operativos';

COMMENT ON COLUMN public.plant_config.key IS
  'Clave de configuración (e.g., micro_stop_threshold_min)';
COMMENT ON COLUMN public.plant_config.value IS
  'Valor almacenado como texto — el consumidor parsea al tipo esperado';
COMMENT ON COLUMN public.plant_config.description IS
  'Descripción legible de qué controla este parámetro';
COMMENT ON COLUMN public.plant_config.updated_at IS
  'Última modificación — se actualiza automáticamente vía trigger';

-- ================================================================
-- SECTION 2: Trigger function para auto-update updated_at
-- ================================================================

CREATE OR REPLACE FUNCTION public.update_plant_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_plant_config_updated_at ON public.plant_config;
CREATE TRIGGER trg_plant_config_updated_at
    BEFORE UPDATE ON public.plant_config
    FOR EACH ROW
    EXECUTE FUNCTION public.update_plant_config_timestamp();

-- ================================================================
-- SECTION 3: Seed — valor por defecto
-- ================================================================

INSERT INTO public.plant_config (key, value, description)
VALUES (
    'micro_stop_threshold_min',
    '5',
    'Umbral de micro-paro en minutos — paros con duración menor se excluyen de conciliación'
)
ON CONFLICT (key) DO NOTHING;

-- ================================================================
-- SECTION 4: Notificación
-- ================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 022_plant_config aplicada:';
    RAISE NOTICE '   - Tabla plant_config creada (key PK, value, description, updated_at)';
    RAISE NOTICE '   - Trigger auto-update updated_at instalado';
    RAISE NOTICE '   - Seed: micro_stop_threshold_min = 5';
    RAISE NOTICE '';
    RAISE NOTICE '⚠ Agregar en Hasura: trackear tabla plant_config con RLS';
    RAISE NOTICE '  - Rol supervisor/admin: ALL';
    RAISE NOTICE '  - Rol operator: SELECT';
END;
$$;
