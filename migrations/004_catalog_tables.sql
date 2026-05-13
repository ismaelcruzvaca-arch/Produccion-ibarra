-- Migration: 004_catalog_tables
-- Catalog tables for stop reasons, products, shifts, lines, machines

-- Stop reasons (F-PD-21 compliant)
CREATE TABLE IF NOT EXISTS public.stop_reasons (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code        text NOT NULL UNIQUE,
    label       text NOT NULL,
    category    text NOT NULL,
    macro       text NOT NULL,
    stops_line  boolean NOT NULL DEFAULT true,
    sort_order  integer DEFAULT 0,
    is_active   boolean NOT NULL DEFAULT true
);

-- Products (Epicor catalog)
CREATE TABLE IF NOT EXISTS public.products (
    id              text PRIMARY KEY,
    code            text NOT NULL UNIQUE,
    name            text NOT NULL,
    theoretical_ppm numeric(6,2) NOT NULL DEFAULT 1.0,
    is_active       boolean NOT NULL DEFAULT true
);

-- Shifts (turnos)
CREATE TABLE IF NOT EXISTS public.shifts (
    id         text PRIMARY KEY,
    label      text NOT NULL,
    start_hour integer NOT NULL CHECK (start_hour BETWEEN 0 AND 23),
    end_hour   integer NOT NULL CHECK (end_hour BETWEEN 0 AND 23),
    is_active  boolean NOT NULL DEFAULT true
);

-- Production lines
CREATE TABLE IF NOT EXISTS public.lines (
    id          text PRIMARY KEY,
    name        text NOT NULL,
    description text,
    is_active   boolean NOT NULL DEFAULT true
);

-- Machines per line
CREATE TABLE IF NOT EXISTS public.machines (
    id          text PRIMARY KEY,
    line_id     text NOT NULL REFERENCES public.lines(id),
    name        text NOT NULL,
    description text,
    is_active   boolean NOT NULL DEFAULT true
);

COMMENT ON TABLE public.stop_reasons IS 'Downtime reasons per F-PD-21';
COMMENT ON TABLE public.products IS 'Product catalog with theoretical PPM';
COMMENT ON TABLE public.shifts IS 'Production shifts';
COMMENT ON TABLE public.lines IS 'Production lines';
COMMENT ON TABLE public.machines IS 'Machines assigned to production lines';
