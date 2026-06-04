-- Migration: 021_catalog_audit_columns
-- Agrega columnas de auditoría a tablas de catálogo
--
-- Dependencias: public.stop_reasons (001), public.products (001),
--               public.shifts (001), public.lines (001), public.machines (001),
--               auth.users (Nhost)
--
-- Propósito:
--   Las tablas de catálogo no tenían created_at / updated_at / updated_by.
--   Desde que el Settings screen permite CRUD, necesitamos saber quién
--   modificó cada registro y cuándo.
--
--   updated_by se puebla desde el cliente (mutation en la app) con el
--   ID del usuario autenticado (X-Hasura-User-Id).
--
-- ================================================================
-- SECTION 1: Agregar columnas a cada tabla de catálogo
-- ================================================================

-- Helper function para agregar audit columns (DRY)
DO $$
DECLARE
    tables TEXT[] := ARRAY['stop_reasons', 'lines', 'machines', 'products', 'shifts'];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- created_at
        EXECUTE format(
            'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()',
            t
        );
        -- updated_at
        EXECUTE format(
            'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()',
            t
        );
        -- updated_by
        EXECUTE format(
            'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id)',
            t
        );

        -- Comentarios
        EXECUTE format(
            'COMMENT ON COLUMN public.%I.created_at IS ''Fecha de creación del registro''', t
        );
        EXECUTE format(
            'COMMENT ON COLUMN public.%I.updated_at IS ''Última modificación (auto-actualizado por trigger)''', t
        );
        EXECUTE format(
            'COMMENT ON COLUMN public.%I.updated_by IS ''ID del usuario que hizo la última modificación (desde la app)''', t
        );
    END LOOP;
END;
$$;

-- ================================================================
-- SECTION 2: Trigger function para auto-update updated_at
-- ================================================================

CREATE OR REPLACE FUNCTION public.update_catalog_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.update_catalog_timestamp() IS
  'Auto-actualiza updated_at en tablas de catálogo al hacer UPDATE';

-- ================================================================
-- SECTION 3: Crear triggers en cada tabla
-- ================================================================

DO $$
DECLARE
    tables TEXT[] := ARRAY['stop_reasons', 'lines', 'machines', 'products', 'shifts'];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I',
            t, t
        );
        EXECUTE format(
            'CREATE TRIGGER trg_%I_updated_at
             BEFORE UPDATE ON public.%I
             FOR EACH ROW
             EXECUTE FUNCTION public.update_catalog_timestamp()',
            t, t
        );
    END LOOP;
END;
$$;

-- ================================================================
-- SECTION 4: Notificación
-- ================================================================

DO $$
DECLARE
    cnt INT;
BEGIN
    SELECT COUNT(*) INTO cnt
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('stop_reasons', 'lines', 'machines', 'products', 'shifts')
      AND column_name = 'updated_at';

    RAISE NOTICE '✅ Migration 021_catalog_audit_columns aplicada:';
    RAISE NOTICE '   - created_at, updated_at, updated_by agregados a 5 tablas';
    RAISE NOTICE '   - %/5 tablas tienen updated_at', cnt;
    RAISE NOTICE '   - 5 triggers auto-update creados';
    RAISE NOTICE '';
    RAISE NOTICE '⚠ IMPORTANTE: updated_by se debe enviar desde el cliente en cada mutation';
END;
$$;
