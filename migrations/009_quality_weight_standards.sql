-- Migration: 009_quality_weight_standards
-- Tabla maestra de estándares de peso por SKU (F-AC-18/19/20)
-- Almacena los rangos de tolerancia por producto leídos del plan de control de calidad
--
-- Dependencias: products (via sku, no FK para independencia del catálogo de Epicor)
--
-- Nota de diseño:
--   La PK es VARCHAR (sku) y no UUID porque el SKU es el identificador natural
--   que viene de Epicor. Esto evita joins innecesarios y refleja el origen
--   del dato (código de producto en el ERP).
--
--   requires_tare = true para la mayoría de productos (empaques que se pesan
--   con el envase). false para productos en polvo que se dosifican por peso neto
--   directo según el instructivo IT-AC-09.

CREATE TABLE IF NOT EXISTS public.product_weight_standards (
    sku             VARCHAR(50)     PRIMARY KEY,
    name            TEXT            NOT NULL,
    lower_limit     NUMERIC(6,2)    NOT NULL CHECK (lower_limit > 0),
    upper_limit     NUMERIC(6,2)    NOT NULL CHECK (upper_limit > lower_limit),
    requires_tare   BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.product_weight_standards IS
    'Estándares de peso por SKU — rangos de tolerancia del plan de control de calidad (F-AC-18/19/20)';
COMMENT ON COLUMN public.product_weight_standards.sku IS
    'Código del producto en Epicor (PK natural, ej: CHOC-250)';
COMMENT ON COLUMN public.product_weight_standards.name IS
    'Descripción comercial del producto (ej: Chocolate 250g)';
COMMENT ON COLUMN public.product_weight_standards.lower_limit IS
    'Peso mínimo aceptable en gramos';
COMMENT ON COLUMN public.product_weight_standards.upper_limit IS
    'Peso máximo aceptable en gramos';
COMMENT ON COLUMN public.product_weight_standards.requires_tare IS
    'Indica si el pesaje incluye tara del empaque (true=default, false=polvos según IT-AC-09)';

-- Trigger function: auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION public.update_weight_standards_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_weight_standards_updated_at ON public.product_weight_standards;
CREATE TRIGGER trg_weight_standards_updated_at
    BEFORE UPDATE ON public.product_weight_standards
    FOR EACH ROW
    EXECUTE FUNCTION public.update_weight_standards_timestamp();

-- Seed data: pesos estándar para los productos existentes en el catálogo
INSERT INTO public.product_weight_standards (sku, name, lower_limit, upper_limit, requires_tare)
VALUES
    ('CHOC-500', 'Chocolate 500g', 490.00, 510.00, TRUE),
    ('CHOC-250', 'Chocolate 250g', 245.00, 255.00, TRUE)
ON CONFLICT (sku) DO NOTHING;
