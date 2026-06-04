-- Migration: 016_tostado_tables
-- Tablas transaccionales del Módulo de Tostado (F-PD-16)
-- Control de tostado de cacao por hora con parámetros de proceso
--
-- Dependencias: public.machines, public.operators
--
-- Jerarquía:
--   tostado_hourly (N) ──→ machines (1)
--   tostado_hourly       ──→ operators (1)
--   tostado_shift_totals tiene UNIQUE(machine_id, shift_type, fecha)
--
-- Nota de diseño:
--   tostado_hourly almacena una fila por máquina×hora×turno con parámetros
--   de proceso del tostado (temperaturas, RPM, presión, humedad).
--   tostado_shift_totals almacena totales agregados por turno (kg tostados,
--   subproductos, porcentajes de eficiencia de separación).
--   data_source clasifica si los parámetros provienen de IoT, manual o ambos.
--
--   Los CHECK constraints garantizan rangos de proceso según especificación:
--   temperaturas 90-130°C, RPM 1.5-3.0, presión > 6 kgf/cm²,
--   humedad crudo ≤ 7.5%, humedad tostado 0.5-1.5%.

-- ============================================================
-- 1. tostado_hourly — Lectura horaria por tostador
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tostado_hourly (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id              UUID            NOT NULL REFERENCES public.machines(id),
    operator_id             VARCHAR(50)     REFERENCES public.operators(id),
    shift_type              VARCHAR(20)     NOT NULL
        CHECK (shift_type IN ('matutino', 'vespertino', 'nocturno')),
    hora                    TIMESTAMPTZ     NOT NULL,
    pesada_kg               NUMERIC(10,2)   CHECK (pesada_kg > 0),
    temp_superior           NUMERIC(5,2)    CHECK (temp_superior IS NULL OR (temp_superior >= 90 AND temp_superior <= 130)),
    temp_media              NUMERIC(5,2)    CHECK (temp_media IS NULL OR (temp_media >= 90 AND temp_media <= 130)),
    temp_inferior           NUMERIC(5,2)    CHECK (temp_inferior IS NULL OR (temp_inferior >= 90 AND temp_inferior <= 130)),
    rpm                     NUMERIC(5,2)    CHECK (rpm IS NULL OR (rpm >= 1.5 AND rpm <= 3.0)),
    presion_vapor           NUMERIC(5,2)    CHECK (presion_vapor IS NULL OR presion_vapor > 6),
    humedad_crudo_pct       NUMERIC(5,2)    CHECK (humedad_crudo_pct IS NULL OR humedad_crudo_pct <= 7.5),
    humedad_tostado_pct     NUMERIC(5,2)    CHECK (humedad_tostado_pct IS NULL OR (humedad_tostado_pct >= 0.5 AND humedad_tostado_pct <= 1.5)),
    tiempo_muerto_min       INT             NOT NULL DEFAULT 0 CHECK (tiempo_muerto_min >= 0),
    causa_paro              VARCHAR(100),
    data_source             VARCHAR(20)     NOT NULL DEFAULT 'manual'
        CHECK (data_source IN ('manual', 'iot', 'hybrid')),
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tostado_hourly IS
    'Lectura horaria por tostador — equivalente al formato F-PD-16 (Reporte de Tostadores)';

COMMENT ON COLUMN public.tostado_hourly.machine_id IS
    'Tostador (máquina) donde se realizó la lectura';

COMMENT ON COLUMN public.tostado_hourly.operator_id IS
    'Operador responsable del turno (código de nómina Epicor)';

COMMENT ON COLUMN public.tostado_hourly.shift_type IS
    'Tipo de turno: matutino, vespertino, nocturno';

COMMENT ON COLUMN public.tostado_hourly.hora IS
    'Marca de tiempo de la lectura horaria';

COMMENT ON COLUMN public.tostado_hourly.pesada_kg IS
    'Kilogramos de cacao pesados en esta hora';

COMMENT ON COLUMN public.tostado_hourly.temp_superior IS
    'Temperatura superior del tostador en °C (rango: 90-130) — IoT preferido, manual como fallback';

COMMENT ON COLUMN public.tostado_hourly.temp_media IS
    'Temperatura media del tostador en °C (rango: 90-130) — IoT preferido, manual como fallback';

COMMENT ON COLUMN public.tostado_hourly.temp_inferior IS
    'Temperatura inferior del tostador en °C (rango: 90-130) — IoT preferido, manual como fallback';

COMMENT ON COLUMN public.tostado_hourly.rpm IS
    'Revoluciones por minuto del tambor (rango: 1.5-3.0) — IoT preferido, manual como fallback';

COMMENT ON COLUMN public.tostado_hourly.presion_vapor IS
    'Presión de vapor en kgf/cm² (> 6) — IoT preferido, manual como fallback';

COMMENT ON COLUMN public.tostado_hourly.humedad_crudo_pct IS
    'Porcentaje de humedad del cacao crudo (≤ 7.5%)';

COMMENT ON COLUMN public.tostado_hourly.humedad_tostado_pct IS
    'Porcentaje de humedad del cacao tostado (rango: 0.5-1.5%)';

COMMENT ON COLUMN public.tostado_hourly.tiempo_muerto_min IS
    'Minutos de tiempo muerto o paro en esta hora';

COMMENT ON COLUMN public.tostado_hourly.causa_paro IS
    'Causa del paro (código según catálogo de paros) — NULL si no hubo paro';

COMMENT ON COLUMN public.tostado_hourly.data_source IS
    'Fuente de los parámetros de proceso: manual, iot, hybrid';

-- ============================================================
-- 2. tostado_shift_totals — Totales agregados por turno
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tostado_shift_totals (
    id                              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id                      UUID            NOT NULL REFERENCES public.machines(id),
    shift_type                      VARCHAR(20)     NOT NULL
        CHECK (shift_type IN ('matutino', 'vespertino', 'nocturno')),
    operator_id                     VARCHAR(50)     REFERENCES public.operators(id),
    fecha                           DATE            NOT NULL,
    total_kg_tostados               NUMERIC(10,2)   NOT NULL DEFAULT 0 CHECK (total_kg_tostados >= 0),
    cascarilla_kg                   NUMERIC(10,2)   NOT NULL DEFAULT 0 CHECK (cascarilla_kg >= 0),
    polvillo_kg                     NUMERIC(10,2)   NOT NULL DEFAULT 0 CHECK (polvillo_kg >= 0),
    granilla_kg                     NUMERIC(10,2)   NOT NULL DEFAULT 0 CHECK (granilla_kg >= 0),
    pct_cascarilla_en_granilla      NUMERIC(5,2)    CHECK (pct_cascarilla_en_granilla IS NULL OR (pct_cascarilla_en_granilla >= 0 AND pct_cascarilla_en_granilla <= 100)),
    pct_granilla_en_cascarilla      NUMERIC(5,2)    CHECK (pct_granilla_en_cascarilla IS NULL OR (pct_granilla_en_cascarilla >= 0 AND pct_granilla_en_cascarilla <= 100)),
    silo_origen                     VARCHAR(50),
    horas_trabajadas                NUMERIC(4,1)    CHECK (horas_trabajadas IS NULL OR horas_trabajadas >= 0),
    extractores_funcionando         INT             NOT NULL DEFAULT 0 CHECK (extractores_funcionando >= 0),
    extractores_totales             INT             NOT NULL DEFAULT 8 CHECK (extractores_totales > 0),
    created_at                      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at                      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    UNIQUE (machine_id, shift_type, fecha)
);

COMMENT ON TABLE public.tostado_shift_totals IS
    'Totales agregados por turno para tostado — una fila por máquina×turno×día';

COMMENT ON COLUMN public.tostado_shift_totals.machine_id IS
    'Tostador del turno';

COMMENT ON COLUMN public.tostado_shift_totals.shift_type IS
    'Tipo de turno: matutino, vespertino, nocturno';

COMMENT ON COLUMN public.tostado_shift_totals.operator_id IS
    'Operador responsable del turno (código de nómina Epicor)';

COMMENT ON COLUMN public.tostado_shift_totals.fecha IS
    'Fecha del turno (día natural en CDMX)';

COMMENT ON COLUMN public.tostado_shift_totals.total_kg_tostados IS
    'Total de kilogramos tostados en el turno';

COMMENT ON COLUMN public.tostado_shift_totals.cascarilla_kg IS
    'Kilogramos de cascarilla producida';

COMMENT ON COLUMN public.tostado_shift_totals.polvillo_kg IS
    'Kilogramos de polvillo producido';

COMMENT ON COLUMN public.tostado_shift_totals.granilla_kg IS
    'Kilogramos de granilla producida';

COMMENT ON COLUMN public.tostado_shift_totals.pct_cascarilla_en_granilla IS
    'Porcentaje de cascarilla presente en la granilla (0-100%)';

COMMENT ON COLUMN public.tostado_shift_totals.pct_granilla_en_cascarilla IS
    'Porcentaje de granilla presente en la cascarilla (0-100%)';

COMMENT ON COLUMN public.tostado_shift_totals.silo_origen IS
    'Silo de origen del cacao utilizado en el turno';

COMMENT ON COLUMN public.tostado_shift_totals.horas_trabajadas IS
    'Horas totales trabajadas en el turno';

COMMENT ON COLUMN public.tostado_shift_totals.extractores_funcionando IS
    'Número de extractores funcionando durante el turno';

COMMENT ON COLUMN public.tostado_shift_totals.extractores_totales IS
    'Número total de extractores disponibles (default: 8)';

-- ============================================================
-- Índices analíticos
-- ============================================================

-- tostado_hourly: joins y filtros comunes
CREATE INDEX IF NOT EXISTS idx_tostado_hourly_machine_id
    ON public.tostado_hourly(machine_id);

CREATE INDEX IF NOT EXISTS idx_tostado_hourly_shift_type
    ON public.tostado_hourly(shift_type);

CREATE INDEX IF NOT EXISTS idx_tostado_hourly_hora
    ON public.tostado_hourly(hora DESC);

CREATE INDEX IF NOT EXISTS idx_tostado_hourly_operator_id
    ON public.tostado_hourly(operator_id);

CREATE INDEX IF NOT EXISTS idx_tostado_hourly_machine_hora
    ON public.tostado_hourly(machine_id, hora);

-- tostado_shift_totals: consulta por máquina y fecha
CREATE INDEX IF NOT EXISTS idx_tostado_shift_totals_machine_id
    ON public.tostado_shift_totals(machine_id);

CREATE INDEX IF NOT EXISTS idx_tostado_shift_totals_fecha
    ON public.tostado_shift_totals(fecha);

-- ============================================================
-- Trigger: auto-update updated_at para tostado_hourly
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_tostado_hourly_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tostado_hourly_updated_at ON public.tostado_hourly;
CREATE TRIGGER trg_tostado_hourly_updated_at
    BEFORE UPDATE ON public.tostado_hourly
    FOR EACH ROW
    EXECUTE FUNCTION public.update_tostado_hourly_timestamp();

-- ============================================================
-- Trigger: auto-update updated_at para tostado_shift_totals
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_tostado_shift_totals_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tostado_shift_totals_updated_at ON public.tostado_shift_totals;
CREATE TRIGGER trg_tostado_shift_totals_updated_at
    BEFORE UPDATE ON public.tostado_shift_totals
    FOR EACH ROW
    EXECUTE FUNCTION public.update_tostado_shift_totals_timestamp();
