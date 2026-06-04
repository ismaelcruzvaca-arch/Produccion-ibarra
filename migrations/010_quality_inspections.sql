-- Migration: 010_quality_inspections
-- Tablas transaccionales del Módulo de Calidad
-- Cabecera de inspección (F-AC-33/34/35) + detalle de defectos (defect_logs) + detalle de pesos (weight_logs)
--
-- Dependencias: public.machines, public.quality_inspections (self)
--
-- Jerarquía:
--   quality_inspections (1) ──→ defect_logs (N)
--   quality_inspections (1) ──→ weight_logs (N)
--
-- Nota de diseño:
--   Se usa ON DELETE CASCADE en ambas tablas de detalle para que al eliminar
--   una inspección se purguen automáticamente sus registros hijos.
--   La disposition sigue el flujo del formato F-AC-46 (liberado/rechazado/reproceso).

-- 1. Cabecera de inspección
CREATE TABLE IF NOT EXISTS public.quality_inspections (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id      UUID            NOT NULL REFERENCES public.machines(id),
    inspector_id    VARCHAR(100)    NOT NULL,
    shift_type      VARCHAR(20)     NOT NULL CHECK (shift_type IN ('matutino', 'vespertino', 'nocturno')),
    disposition     VARCHAR(20)     NOT NULL DEFAULT 'pending' CHECK (disposition IN ('pending', 'liberado', 'rechazado', 'reproceso')),
    notes           TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.quality_inspections IS
    'Cabecera de inspección de calidad — equivalente a los formatos F-AC-33/34/35';
COMMENT ON COLUMN public.quality_inspections.machine_id IS
    'Máquina donde se tomó la muestra';
COMMENT ON COLUMN public.quality_inspections.inspector_id IS
    'Código del analista de calidad que realizó la inspección';
COMMENT ON COLUMN public.quality_inspections.shift_type IS
    'Turno en que se realizó la inspección: matutino, vespertino, nocturno';
COMMENT ON COLUMN public.quality_inspections.disposition IS
    'Disposición final de la inspección según F-AC-46: pending → liberado | rechazado | reproceso';
COMMENT ON COLUMN public.quality_inspections.notes IS
    'Observaciones del inspector (opcional)';

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_quality_inspections_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quality_inspections_updated_at ON public.quality_inspections;
CREATE TRIGGER trg_quality_inspections_updated_at
    BEFORE UPDATE ON public.quality_inspections
    FOR EACH ROW
    EXECUTE FUNCTION public.update_quality_inspections_timestamp();

-- 2. Detalle de defectos encontrados
CREATE TABLE IF NOT EXISTS public.defect_logs (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id   UUID            NOT NULL REFERENCES public.quality_inspections(id) ON DELETE CASCADE,
    severity        VARCHAR(15)     NOT NULL CHECK (severity IN ('critical', 'major', 'minor')),
    defect_type     VARCHAR(100)    NOT NULL,
    defect_count    INT             NOT NULL CHECK (defect_count > 0),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.defect_logs IS
    'Detalle de defectos encontrados en una inspección (N por inspección)';
COMMENT ON COLUMN public.defect_logs.severity IS
    'Severidad del defecto según IT-AC-09: critical, major, minor';
COMMENT ON COLUMN public.defect_logs.defect_type IS
    'Tipo de defecto (ej: materia_extraña, empaque_abierto, codificacion_incorrecta)';
COMMENT ON COLUMN public.defect_logs.defect_count IS
    'Cantidad de unidades con este defecto (>0)';

-- 3. Detalle de pesos medidos
CREATE TABLE IF NOT EXISTS public.weight_logs (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id   UUID            NOT NULL REFERENCES public.quality_inspections(id) ON DELETE CASCADE,
    measured_weight NUMERIC(6,2)    NOT NULL CHECK (measured_weight > 0),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.weight_logs IS
    'Detalle de pesos registrados en una inspección (N muestras por inspección)';
COMMENT ON COLUMN public.weight_logs.measured_weight IS
    'Peso medido en gramos';

-- 4. Índices analíticos para Power BI
CREATE INDEX IF NOT EXISTS idx_quality_inspections_machine_id
    ON public.quality_inspections(machine_id);

CREATE INDEX IF NOT EXISTS idx_quality_inspections_created_at
    ON public.quality_inspections(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quality_inspections_disposition
    ON public.quality_inspections(disposition);

CREATE INDEX IF NOT EXISTS idx_defect_logs_inspection_id
    ON public.defect_logs(inspection_id);

CREATE INDEX IF NOT EXISTS idx_defect_logs_severity
    ON public.defect_logs(severity);

CREATE INDEX IF NOT EXISTS idx_weight_logs_inspection_id
    ON public.weight_logs(inspection_id);
