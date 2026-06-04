-- Migration: 014_quality_defects_by_shift
-- Agrega columnas de fuente de datos a quality_inspections para modelo híbrido
-- (visión artificial + captura manual por operador de calidad)
--
-- Dependencias: public.quality_inspections (migración 010)
--
-- Nota de diseño:
--   data_source permite rastrear si el registro provino de visión artificial (vision),
--   captura manual del operador de calidad (manual), o ambos (hybrid) cuando el
--   sistema consolida datos de ambas fuentes.
--
--   inspector_type es una columna GENERADA que clasifica automáticamente el inspector
--   basándose en el patrón del código: 'vision_edge_%' → IA, cualquier otro → humano.
--   Esto evita desincronización entre la lógica de negocio y los datos almacenados.

-- ============================================================
-- Columnas nuevas en quality_inspections
-- ============================================================

ALTER TABLE public.quality_inspections
  ADD COLUMN IF NOT EXISTS data_source VARCHAR(20) NOT NULL DEFAULT 'manual'
    CHECK (data_source IN ('vision', 'manual', 'hybrid'));

ALTER TABLE public.quality_inspections
  ADD COLUMN IF NOT EXISTS inspector_type VARCHAR(10)
    GENERATED ALWAYS AS (
      CASE WHEN inspector_id LIKE 'vision_edge_%' THEN 'ai' ELSE 'human' END
    ) STORED;

-- ============================================================
-- Comentarios
-- ============================================================

COMMENT ON COLUMN public.quality_inspections.data_source IS
  'Fuente del dato: vision (visión artificial), manual (operador calidad), hybrid (ambos)';

COMMENT ON COLUMN public.quality_inspections.inspector_type IS
  'Tipo de inspector: ai (visión_edge) o human (código de operador) — columna generada';
