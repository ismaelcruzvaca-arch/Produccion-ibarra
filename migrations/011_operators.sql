-- Migration: 011_operators
-- Catálogo maestro de operadores (PK = código de nómina Epicor)
--
-- Nota de diseño:
--   PK es VARCHAR (código de nómina) y NO UUID porque la integración con Epicor
--   es directa. El número de empleado es el identificador natural del operador
--   en el ERP y evita tablas de mapeo innecesarias.

CREATE TABLE IF NOT EXISTS public.operators (
    id              VARCHAR(50)     PRIMARY KEY,
    full_name       VARCHAR(150)    NOT NULL,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.operators IS
    'Catálogo maestro de operadores — PK es código de nómina Epicor';
COMMENT ON COLUMN public.operators.id IS
    'Código de nómina Epicor (PK natural, ej: OP-1045)';
COMMENT ON COLUMN public.operators.full_name IS
    'Nombre completo del operador';
COMMENT ON COLUMN public.operators.is_active IS
    'Indica si el operador está activo en el sistema';

-- Trigger function: auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_operators_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_operators_updated_at ON public.operators;
CREATE TRIGGER trg_operators_updated_at
    BEFORE UPDATE ON public.operators
    FOR EACH ROW
    EXECUTE FUNCTION public.update_operators_timestamp();

-- Seed data: operadores de prueba
INSERT INTO public.operators (id, full_name) VALUES
    ('OP-001', 'Juan Pérez'),
    ('OP-002', 'María García')
ON CONFLICT (id) DO NOTHING;
