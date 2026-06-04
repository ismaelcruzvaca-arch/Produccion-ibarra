-- Migration: 017_vitaminas_tables
-- Tablas transaccionales del Módulo de Mezclado de Vitaminas (F-PD-06)
-- Control de micro-ingredientes por batch con trazabilidad de lotes,
-- doble verificación calidad-producción, e inventario de kits.
--
-- Dependencias: public.machines, public.operators
--
-- Jerarquía:
--   vitaminas_batches (1) ──→ vitaminas_ingredients (N)
--   vitaminas_batches se relaciona con vitaminas_kit_inventory por machine/shift/fecha/product
--
-- Nota de diseño:
--   vitaminas_batches almacena cabecera de batch con pesos, fórmula, doble firma.
--   vitaminas_ingredients detalla micro-ingredientes usados por batch con lotes.
--   vitaminas_kit_inventory almacena inventario de kits por máquina/turno/día/producto.
--   data_source clasifica si peso_bascula proviene de IoT (báscula conectada) o manual.
--   Status sigue FSM: pending → in_progress → completed → rejected.
--   Doble firma: verificador_produccion y verificador_calidad son VARCHAR
--   (sin FK a users por ahora, se integrará con módulo de auth en el futuro).
--
--   batch_number es el número secuencial de batch dentro del turno (1-20).
--   product_formula identifica la fórmula usada (R1, R2, Aurrera, Canelate, Chedraui, etc).
--   kit_numero es la concatenación de # Orden + # Kit.
--
--   Los CHECK constraints garantizan integridad a nivel DB.

-- ============================================================
-- 1. vitaminas_batches — Cabecera de batch de mezclado de vitaminas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vitaminas_batches (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id              UUID            NOT NULL REFERENCES public.machines(id),
    operator_id             VARCHAR(50)     REFERENCES public.operators(id),
    shift_type              VARCHAR(20)     NOT NULL CHECK (shift_type IN ('matutino', 'vespertino', 'nocturno')),
    batch_number            INT             NOT NULL CHECK (batch_number BETWEEN 1 AND 20),
    product_name            VARCHAR(100),
    product_formula         VARCHAR(50),

    -- Pesos
    peso_bascula            NUMERIC(10,2),
    peso_fisico             NUMERIC(10,2),

    -- Kit
    kit_numero              VARCHAR(50),
    kit_kg                  NUMERIC(10,2),
    semi_terminado_kg       NUMERIC(10,2),

    -- Verificación (doble firma)
    verificador_produccion  VARCHAR(100),
    verificador_calidad     VARCHAR(100),

    -- Metadatos
    status                  VARCHAR(20)     NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
    data_source             VARCHAR(10)     NOT NULL DEFAULT 'manual'
        CHECK (data_source IN ('manual', 'iot', 'hybrid')),
    notes                   TEXT,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.vitaminas_batches IS
    'Cabecera de batch de mezclado de vitaminas — equivalente al formato F-PD-06';

COMMENT ON COLUMN public.vitaminas_batches.machine_id IS
    'Máquina donde se realizó el mezclado';

COMMENT ON COLUMN public.vitaminas_batches.operator_id IS
    'Operador responsable del batch (código de nómina Epicor)';

COMMENT ON COLUMN public.vitaminas_batches.shift_type IS
    'Tipo de turno: matutino, vespertino, nocturno';

COMMENT ON COLUMN public.vitaminas_batches.batch_number IS
    'Número secuencial de batch dentro del turno (1-20, asignado por la app)';

COMMENT ON COLUMN public.vitaminas_batches.product_name IS
    'Nombre del producto (ej. Choco choco, Aurrera, Canelate, Chedraui)';

COMMENT ON COLUMN public.vitaminas_batches.product_formula IS
    'Fórmula del producto: R1, R2, Aurrera, Canelate, Chedraui, etc.';

COMMENT ON COLUMN public.vitaminas_batches.peso_bascula IS
    'Peso registrado por la báscula (IoT si está conectada, manual como fallback)';

COMMENT ON COLUMN public.vitaminas_batches.peso_fisico IS
    'Peso físico verificado manualmente';

COMMENT ON COLUMN public.vitaminas_batches.kit_numero IS
    'Número de kit: concatenación de # Orden + # Kit';

COMMENT ON COLUMN public.vitaminas_batches.kit_kg IS
    'Kilogramos del kit';

COMMENT ON COLUMN public.vitaminas_batches.semi_terminado_kg IS
    'Kilogramos de semi-terminado generados';

COMMENT ON COLUMN public.vitaminas_batches.verificador_produccion IS
    'Nombre del verificador de producción (doble firma)';

COMMENT ON COLUMN public.vitaminas_batches.verificador_calidad IS
    'Nombre del verificador de calidad (doble firma)';

COMMENT ON COLUMN public.vitaminas_batches.status IS
    'Estado del batch: pending → in_progress → completed → rejected';

COMMENT ON COLUMN public.vitaminas_batches.data_source IS
    'Fuente del peso_bascula: manual (captura), iot (báscula conectada), hybrid (ambos)';

COMMENT ON COLUMN public.vitaminas_batches.notes IS
    'Observaciones del operador (opcional)';

-- ============================================================
-- 2. vitaminas_ingredients — Detalle de micro-ingredientes por batch
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vitaminas_ingredients (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id            UUID            NOT NULL REFERENCES public.vitaminas_batches(id) ON DELETE CASCADE,
    ingredient_type     VARCHAR(20)     NOT NULL
        CHECK (ingredient_type IN ('azucar', 'cocoa', 'lecitina', 'fecula', 'maltodextrina', 'reproceso')),
    kg                  NUMERIC(10,2)   NOT NULL CHECK (kg > 0),
    lot_number          VARCHAR(50),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.vitaminas_ingredients IS
    'Detalle de micro-ingredientes usados en un batch de vitaminas (N registros por batch)';

COMMENT ON COLUMN public.vitaminas_ingredients.batch_id IS
    'Batch al que pertenece este ingrediente (FK con CASCADE)';

COMMENT ON COLUMN public.vitaminas_ingredients.ingredient_type IS
    'Tipo de micro-ingrediente: azucar, cocoa, lecitina, fecula, maltodextrina, reproceso';

COMMENT ON COLUMN public.vitaminas_ingredients.kg IS
    'Cantidad del ingrediente en kilogramos (>0)';

COMMENT ON COLUMN public.vitaminas_ingredients.lot_number IS
    'Número de lote del ingrediente (opcional, para trazabilidad Epicor)';

-- ============================================================
-- 3. vitaminas_kit_inventory — Inventario de kits por turno
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vitaminas_kit_inventory (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id      UUID            NOT NULL REFERENCES public.machines(id),
    shift_type      VARCHAR(20)     NOT NULL CHECK (shift_type IN ('matutino', 'vespertino', 'nocturno')),
    fecha           DATE            NOT NULL,
    product_name    VARCHAR(100)    NOT NULL,
    inv_inicial     INT             NOT NULL DEFAULT 0 CHECK (inv_inicial >= 0),
    recibidos       INT             NOT NULL DEFAULT 0 CHECK (recibidos >= 0),
    consumo         INT             NOT NULL DEFAULT 0 CHECK (consumo >= 0),
    inv_final       INT             NOT NULL DEFAULT 0 CHECK (inv_final >= 0),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    UNIQUE (machine_id, shift_type, fecha, product_name)
);

COMMENT ON TABLE public.vitaminas_kit_inventory IS
    'Inventario de kits por máquina/turno/día/producto — control de consumo de kits';

COMMENT ON COLUMN public.vitaminas_kit_inventory.machine_id IS
    'Máquina del turno';

COMMENT ON COLUMN public.vitaminas_kit_inventory.shift_type IS
    'Tipo de turno: matutino, vespertino, nocturno';

COMMENT ON COLUMN public.vitaminas_kit_inventory.fecha IS
    'Fecha del inventario (día natural en CDMX)';

COMMENT ON COLUMN public.vitaminas_kit_inventory.product_name IS
    'Nombre del producto asociado al kit';

COMMENT ON COLUMN public.vitaminas_kit_inventory.inv_inicial IS
    'Inventario inicial de kits al inicio del turno';

COMMENT ON COLUMN public.vitaminas_kit_inventory.recibidos IS
    'Kits recibidos durante el turno';

COMMENT ON COLUMN public.vitaminas_kit_inventory.consumo IS
    'Kits consumidos durante el turno';

COMMENT ON COLUMN public.vitaminas_kit_inventory.inv_final IS
    'Inventario final de kits al cierre del turno';

-- ============================================================
-- Índices analíticos
-- ============================================================

-- vitaminas_batches: joins y filtros comunes
CREATE INDEX IF NOT EXISTS idx_vitaminas_batches_machine_id
    ON public.vitaminas_batches(machine_id);

CREATE INDEX IF NOT EXISTS idx_vitaminas_batches_shift_type
    ON public.vitaminas_batches(shift_type);

CREATE INDEX IF NOT EXISTS idx_vitaminas_batches_created_at
    ON public.vitaminas_batches(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vitaminas_batches_status
    ON public.vitaminas_batches(status);

CREATE INDEX IF NOT EXISTS idx_vitaminas_batches_operator_id
    ON public.vitaminas_batches(operator_id);

CREATE INDEX IF NOT EXISTS idx_vitaminas_batches_product_formula
    ON public.vitaminas_batches(product_formula);

-- vitaminas_ingredients: join por batch y filtro por tipo
CREATE INDEX IF NOT EXISTS idx_vitaminas_ingredients_batch_id
    ON public.vitaminas_ingredients(batch_id);

CREATE INDEX IF NOT EXISTS idx_vitaminas_ingredients_ingredient_type
    ON public.vitaminas_ingredients(ingredient_type);

-- vitaminas_kit_inventory: consulta por máquina y fecha
CREATE INDEX IF NOT EXISTS idx_vitaminas_kit_inventory_machine_id
    ON public.vitaminas_kit_inventory(machine_id);

CREATE INDEX IF NOT EXISTS idx_vitaminas_kit_inventory_fecha
    ON public.vitaminas_kit_inventory(fecha);

-- ============================================================
-- Trigger: auto-update updated_at para vitaminas_batches
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_vitaminas_batches_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vitaminas_batches_updated_at ON public.vitaminas_batches;
CREATE TRIGGER trg_vitaminas_batches_updated_at
    BEFORE UPDATE ON public.vitaminas_batches
    FOR EACH ROW
    EXECUTE FUNCTION public.update_vitaminas_batches_timestamp();

-- ============================================================
-- Trigger: auto-update updated_at para vitaminas_kit_inventory
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_vitaminas_kit_inventory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vitaminas_kit_inventory_updated_at ON public.vitaminas_kit_inventory;
CREATE TRIGGER trg_vitaminas_kit_inventory_updated_at
    BEFORE UPDATE ON public.vitaminas_kit_inventory
    FOR EACH ROW
    EXECUTE FUNCTION public.update_vitaminas_kit_inventory_timestamp();
