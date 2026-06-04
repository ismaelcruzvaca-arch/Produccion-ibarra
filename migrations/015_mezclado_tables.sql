-- Migration: 015_mezclado_tables
-- Tablas transaccionales del Módulo de Mezclado (F-PD-17)
-- Batch de mezclado de pasta para Chocolate de Mesa
--
-- Dependencias: public.machines, public.operators
--
-- Jerarquía:
--   mezclado_batches (1) ──→ mezclado_ingredients (N)
--   mezclado_batches se relaciona con mezclado_shift_totals por machine/shift/fecha
--
-- Nota de diseño:
--   mezclado_batches almacena cabecera de batch con parámetros de proceso.
--   mezclado_ingredients detalla ingredientes usados por batch.
--   mezclado_shift_totals almacena totales agregados por turno.
--   data_source clasifica si los parámetros provienen de IoT, manual o ambos.
--   Status sigue FSM: pending → in_progress → completed → rejected.
--
--   batch_number es el número secuencial de batch dentro del turno (lo asigna
--   la app, no es auto-increment). mezcladora_id identifica cuál de las 2
--   mezcladoras se usó (1 o 2).
--
--   Los CHECK constraints garantizan integridad a nivel DB: total_kg > 0,
--   ingredient kg > 0, status en FSM, data_source en valores válidos.

-- ============================================================
-- 1. mezclado_batches — Cabecera de batch de mezclado
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mezclado_batches (
    id                   UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id           UUID            NOT NULL REFERENCES public.machines(id),
    operator_id          VARCHAR(50)     REFERENCES public.operators(id),
    shift_type           VARCHAR(20)     NOT NULL CHECK (shift_type IN ('matutino', 'vespertino', 'nocturno')),
    batch_number         INT             NOT NULL,
    mezcladora_id        INT             NOT NULL CHECK (mezcladora_id IN (1, 2)),
    total_kg             NUMERIC(10,3)   NOT NULL CHECK (total_kg > 0),
    viscosidad_cps       NUMERIC(10,2),
    temp_descarga        NUMERIC(5,2),
    temp_deposito        NUMERIC(5,2),
    tiempo_mezclado_min  INT             CHECK (tiempo_mezclado_min > 0),
    status               VARCHAR(20)     NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
    data_source          VARCHAR(10)     NOT NULL DEFAULT 'manual'
        CHECK (data_source IN ('manual', 'iot', 'hybrid')),
    hora_entrada         TIMESTAMPTZ     NOT NULL DEFAULT now(),
    hora_salida          TIMESTAMPTZ,
    notes                TEXT,
    created_at           TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mezclado_batches IS
    'Cabecera de batch de mezclado — equivalente al formato F-PD-17 (Chocolate de Mesa)';

COMMENT ON COLUMN public.mezclado_batches.machine_id IS
    'Máquina donde se realizó el mezclado';

COMMENT ON COLUMN public.mezclado_batches.operator_id IS
    'Operador responsable del batch (código de nómina Epicor)';

COMMENT ON COLUMN public.mezclado_batches.shift_type IS
    'Tipo de turno: matutino, vespertino, nocturno';

COMMENT ON COLUMN public.mezclado_batches.batch_number IS
    'Número secuencial de batch dentro del turno (asignado por la app)';

COMMENT ON COLUMN public.mezclado_batches.mezcladora_id IS
    'Identificador de la mezcladora utilizada (1 o 2)';

COMMENT ON COLUMN public.mezclado_batches.total_kg IS
    'Peso total del batch en kg';

COMMENT ON COLUMN public.mezclado_batches.viscosidad_cps IS
    'Viscosidad medida en cps (NULL si no disponible) — IoT preferido, manual como fallback';

COMMENT ON COLUMN public.mezclado_batches.temp_descarga IS
    'Temperatura de descarga en °C (NULL si no disponible) — IoT preferido, manual como fallback';

COMMENT ON COLUMN public.mezclado_batches.temp_deposito IS
    'Temperatura de depósito en °C (NULL si no disponible) — IoT preferido, manual como fallback';

COMMENT ON COLUMN public.mezclado_batches.tiempo_mezclado_min IS
    'Tiempo total de mezclado en minutos';

COMMENT ON COLUMN public.mezclado_batches.status IS
    'Estado del batch: pending → in_progress → completed → rejected';

COMMENT ON COLUMN public.mezclado_batches.data_source IS
    'Fuente de los parámetros de proceso: manual, iot, hybrid';

COMMENT ON COLUMN public.mezclado_batches.hora_entrada IS
    'Momento en que inició el batch';

COMMENT ON COLUMN public.mezclado_batches.hora_salida IS
    'Momento en que finalizó el batch (NULL si en curso)';

COMMENT ON COLUMN public.mezclado_batches.notes IS
    'Observaciones del operador (opcional)';

-- ============================================================
-- 2. mezclado_ingredients — Detalle de ingredientes por batch
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mezclado_ingredients (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id            UUID            NOT NULL REFERENCES public.mezclado_batches(id) ON DELETE CASCADE,
    ingredient_type     VARCHAR(30)     NOT NULL
        CHECK (ingredient_type IN ('azucar', 'licor', 'cocoa', 'grasa_vegetal', 'formula', 'lecitina', 'reproceso')),
    kg                  NUMERIC(10,3)   NOT NULL CHECK (kg > 0),
    lot_number          VARCHAR(100),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mezclado_ingredients IS
    'Detalle de ingredientes usados en un batch de mezclado (N registros por batch)';

COMMENT ON COLUMN public.mezclado_ingredients.batch_id IS
    'Batch al que pertenece este ingrediente (FK con CASCADE)';

COMMENT ON COLUMN public.mezclado_ingredients.ingredient_type IS
    'Tipo de ingrediente: azucar, licor, cocoa, grasa_vegetal, formula, lecitina, reproceso';

COMMENT ON COLUMN public.mezclado_ingredients.kg IS
    'Cantidad del ingrediente en kilogramos (>0)';

COMMENT ON COLUMN public.mezclado_ingredients.lot_number IS
    'Número de lote del ingrediente (opcional, para trazabilidad Epicor)';

-- ============================================================
-- 3. mezclado_shift_totals — Totales agregados por turno
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mezclado_shift_totals (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id              UUID            NOT NULL REFERENCES public.machines(id),
    shift_type              VARCHAR(20)     NOT NULL CHECK (shift_type IN ('matutino', 'vespertino', 'nocturno')),
    fecha                   DATE            NOT NULL,
    total_mezcladas         INT             NOT NULL DEFAULT 0 CHECK (total_mezcladas >= 0),
    total_molidas           INT             NOT NULL DEFAULT 0 CHECK (total_molidas >= 0),
    desperdicio_licor_kg    NUMERIC(10,3)   NOT NULL DEFAULT 0 CHECK (desperdicio_licor_kg >= 0),
    desperdicio_azucar_kg   NUMERIC(10,3)   NOT NULL DEFAULT 0 CHECK (desperdicio_azucar_kg >= 0),
    barreduras_kg           NUMERIC(10,3)   NOT NULL DEFAULT 0 CHECK (barreduras_kg >= 0),
    reproceso_total_kg      NUMERIC(10,3)   NOT NULL DEFAULT 0 CHECK (reproceso_total_kg >= 0),
    notes                   TEXT,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    UNIQUE (machine_id, shift_type, fecha)
);

COMMENT ON TABLE public.mezclado_shift_totals IS
    'Totales agregados por turno para mezclado — una fila por máquina×turno×día';

COMMENT ON COLUMN public.mezclado_shift_totals.machine_id IS
    'Máquina del turno';

COMMENT ON COLUMN public.mezclado_shift_totals.shift_type IS
    'Tipo de turno: matutino, vespertino, nocturno';

COMMENT ON COLUMN public.mezclado_shift_totals.fecha IS
    'Fecha del turno (día natural en CDMX)';

COMMENT ON COLUMN public.mezclado_shift_totals.total_mezcladas IS
    'Número total de mezcladas realizadas en el turno';

COMMENT ON COLUMN public.mezclado_shift_totals.total_molidas IS
    'Número total de molidas realizadas en el turno';

COMMENT ON COLUMN public.mezclado_shift_totals.desperdicio_licor_kg IS
    'Desperdicio de licor en kilogramos';

COMMENT ON COLUMN public.mezclado_shift_totals.desperdicio_azucar_kg IS
    'Desperdicio de azúcar en kilogramos';

COMMENT ON COLUMN public.mezclado_shift_totals.barreduras_kg IS
    'Barreduras generadas en kilogramos';

COMMENT ON COLUMN public.mezclado_shift_totals.reproceso_total_kg IS
    'Total de reproceso en kilogramos';

-- ============================================================
-- Índices analíticos
-- ============================================================

-- mezclado_batches: joins y filtros comunes
CREATE INDEX IF NOT EXISTS idx_mezclado_batches_machine_id
    ON public.mezclado_batches(machine_id);

CREATE INDEX IF NOT EXISTS idx_mezclado_batches_shift_type
    ON public.mezclado_batches(shift_type);

CREATE INDEX IF NOT EXISTS idx_mezclado_batches_hora_entrada
    ON public.mezclado_batches(hora_entrada DESC);

CREATE INDEX IF NOT EXISTS idx_mezclado_batches_status
    ON public.mezclado_batches(status);

CREATE INDEX IF NOT EXISTS idx_mezclado_batches_operator_id
    ON public.mezclado_batches(operator_id);

-- mezclado_ingredients: join por batch y filtro por tipo
CREATE INDEX IF NOT EXISTS idx_mezclado_ingredients_batch_id
    ON public.mezclado_ingredients(batch_id);

CREATE INDEX IF NOT EXISTS idx_mezclado_ingredients_ingredient_type
    ON public.mezclado_ingredients(ingredient_type);

-- mezclado_shift_totals: consulta por máquina y fecha
CREATE INDEX IF NOT EXISTS idx_mezclado_shift_totals_machine_id
    ON public.mezclado_shift_totals(machine_id);

CREATE INDEX IF NOT EXISTS idx_mezclado_shift_totals_fecha
    ON public.mezclado_shift_totals(fecha);

-- ============================================================
-- Trigger: auto-update updated_at para mezclado_batches
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_mezclado_batches_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mezclado_batches_updated_at ON public.mezclado_batches;
CREATE TRIGGER trg_mezclado_batches_updated_at
    BEFORE UPDATE ON public.mezclado_batches
    FOR EACH ROW
    EXECUTE FUNCTION public.update_mezclado_batches_timestamp();

-- ============================================================
-- Trigger: auto-update updated_at para mezclado_shift_totals
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_mezclado_shift_totals_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mezclado_shift_totals_updated_at ON public.mezclado_shift_totals;
CREATE TRIGGER trg_mezclado_shift_totals_updated_at
    BEFORE UPDATE ON public.mezclado_shift_totals
    FOR EACH ROW
    EXECUTE FUNCTION public.update_mezclado_shift_totals_timestamp();
