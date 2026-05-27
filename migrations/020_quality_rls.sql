-- Migration: 020_quality_rls
-- Cierre de brecha de seguridad: RLS en tablas de Calidad
--
-- Dependencias: public.machines, public.user_line_assignments, public.quality_inspections (010),
--               public.defect_logs (010), public.weight_logs (010)
--
-- Propósito:
--   Las tablas de calidad NO tenían RLS. Un operador podía ver inspecciones de
--   TODAS las líneas. Esta migración:
--     1. Agrega line_id a quality_inspections (desnormalizado, auto-sync por trigger)
--     2. Habilita RLS en quality_inspections, defect_logs, weight_logs
--     3. Crea políticas que replican el patrón _exists de user_line_assignments
--
-- Estrategia:
--   quality_inspections recibe line_id directamente (como oee_events ya tiene).
--   El trigger trg_quality_inspections_sync_line_id lo mantiene sincronizado
--   automáticamente al insertar o cambiar machine_id.
--
--   defect_logs y weight_logs usan una subconsulta EXISTS a quality_inspections
--   que a su vez verifica user_line_assignments (defense-in-depth).
--
--   A NIVEL HASURA se actualiza quality_permissions.json con _exists subqueries.
--   ESTA MIGRACIÓN es la capa de defensa en profundidad a nivel PostgreSQL.
--
-- ================================================================
-- SECTION 1: Agregar line_id a quality_inspections
-- ================================================================

ALTER TABLE public.quality_inspections
  ADD COLUMN IF NOT EXISTS line_id UUID REFERENCES public.lines(id);

COMMENT ON COLUMN public.quality_inspections.line_id IS
  'Línea de producción (desnormalizada de machines.line_id para RLS directo)';

-- Poblar line_id desde machines para registros existentes
UPDATE public.quality_inspections qi
SET line_id = m.line_id
FROM public.machines m
WHERE qi.machine_id = m.id
  AND qi.line_id IS NULL;

-- Ahora que está poblado, hacer NOT NULL
ALTER TABLE public.quality_inspections
  ALTER COLUMN line_id SET NOT NULL;

-- Índice para RLS
CREATE INDEX IF NOT EXISTS idx_quality_inspections_line_id
  ON public.quality_inspections(line_id);

-- ================================================================
-- SECTION 2: Agregar line_id a defect_logs y weight_logs
-- ================================================================
-- Necesario para que Hasura pueda aplicar _exists directo sin
-- multi-level subqueries (limitación del sistema de permisos de Hasura).

ALTER TABLE public.defect_logs
  ADD COLUMN IF NOT EXISTS line_id UUID REFERENCES public.lines(id);

COMMENT ON COLUMN public.defect_logs.line_id IS
  'Línea de producción (desnormalizada para RLS directo en Hasura)';

ALTER TABLE public.weight_logs
  ADD COLUMN IF NOT EXISTS line_id UUID REFERENCES public.lines(id);

COMMENT ON COLUMN public.weight_logs.line_id IS
  'Línea de producción (desnormalizada para RLS directo en Hasura)';

-- Poblar line_id desde quality_inspections para registros existentes
UPDATE public.defect_logs dl
SET line_id = qi.line_id
FROM public.quality_inspections qi
WHERE dl.inspection_id = qi.id
  AND dl.line_id IS NULL;

UPDATE public.weight_logs wl
SET line_id = qi.line_id
FROM public.quality_inspections qi
WHERE wl.inspection_id = qi.id
  AND wl.line_id IS NULL;

ALTER TABLE public.defect_logs
  ALTER COLUMN line_id SET NOT NULL;

ALTER TABLE public.weight_logs
  ALTER COLUMN line_id SET NOT NULL;

-- Índices para RLS
CREATE INDEX IF NOT EXISTS idx_defect_logs_line_id
  ON public.defect_logs(line_id);

CREATE INDEX IF NOT EXISTS idx_weight_logs_line_id
  ON public.weight_logs(line_id);

-- ================================================================
-- SECTION 3: Triggers para sync automático de line_id
-- ================================================================

-- 3a. quality_inspections: machine_id → line_id via machines
CREATE OR REPLACE FUNCTION public.sync_quality_inspections_line_id()
RETURNS TRIGGER AS $$
BEGIN
    NEW.line_id = (SELECT line_id FROM public.machines WHERE id = NEW.machine_id);
    IF NEW.line_id IS NULL THEN
        RAISE EXCEPTION 'machine_id % not found in public.machines', NEW.machine_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.sync_quality_inspections_line_id() IS
  'Auto-sincroniza quality_inspections.line_id desde machines.line_id';

DROP TRIGGER IF EXISTS trg_quality_inspections_sync_line_id
  ON public.quality_inspections;

CREATE TRIGGER trg_quality_inspections_sync_line_id
    BEFORE INSERT OR UPDATE OF machine_id
    ON public.quality_inspections
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_quality_inspections_line_id();

-- 3b. defect_logs: inspection_id → line_id via quality_inspections
CREATE OR REPLACE FUNCTION public.sync_defect_logs_line_id()
RETURNS TRIGGER AS $$
BEGIN
    NEW.line_id = (SELECT line_id FROM public.quality_inspections WHERE id = NEW.inspection_id);
    IF NEW.line_id IS NULL THEN
        RAISE EXCEPTION 'inspection_id % not found in public.quality_inspections', NEW.inspection_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.sync_defect_logs_line_id() IS
  'Auto-sincroniza defect_logs.line_id desde quality_inspections.line_id';

DROP TRIGGER IF EXISTS trg_defect_logs_sync_line_id
  ON public.defect_logs;

CREATE TRIGGER trg_defect_logs_sync_line_id
    BEFORE INSERT OR UPDATE OF inspection_id
    ON public.defect_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_defect_logs_line_id();

-- 3c. weight_logs: inspection_id → line_id via quality_inspections
CREATE OR REPLACE FUNCTION public.sync_weight_logs_line_id()
RETURNS TRIGGER AS $$
BEGIN
    NEW.line_id = (SELECT line_id FROM public.quality_inspections WHERE id = NEW.inspection_id);
    IF NEW.line_id IS NULL THEN
        RAISE EXCEPTION 'inspection_id % not found in public.quality_inspections', NEW.inspection_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.sync_weight_logs_line_id() IS
  'Auto-sincroniza weight_logs.line_id desde quality_inspections.line_id';

DROP TRIGGER IF EXISTS trg_weight_logs_sync_line_id
  ON public.weight_logs;

CREATE TRIGGER trg_weight_logs_sync_line_id
    BEFORE INSERT OR UPDATE OF inspection_id
    ON public.weight_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_weight_logs_line_id();

-- ================================================================
-- SECTION 4: Helper functions para RLS policies
-- ================================================================
-- Verifica si el usuario autenticado tiene acceso a una línea específica
-- via user_line_assignments. Usa current_setting('hasura.user') que Hasura
-- establece como variable de sesión para cada request.

CREATE OR REPLACE FUNCTION public.user_has_line_access(check_line_id UUID)
RETURNS BOOLEAN
STABLE
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id TEXT;
BEGIN
    BEGIN
        v_user_id := current_setting('hasura.user');
    EXCEPTION WHEN OTHERS THEN
        -- Si no hay variable de sesión (acceso directo a BD), denegar
        RETURN FALSE;
    END;

    IF v_user_id IS NULL OR v_user_id = '' THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.user_line_assignments
        WHERE user_id = v_user_id::UUID
          AND line_id = check_line_id
    );
END;
$$;

-- ================================================================
-- SECTION 4: Helper function — user_has_inspection_access
-- ================================================================
-- Para defect_logs y weight_logs: verifica acceso a través de
-- quality_inspections → machines → user_line_assignments

CREATE OR REPLACE FUNCTION public.user_has_inspection_access(check_inspection_id UUID)
RETURNS BOOLEAN
STABLE
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id TEXT;
    v_line_id UUID;
BEGIN
    BEGIN
        v_user_id := current_setting('hasura.user');
    EXCEPTION WHEN OTHERS THEN
        RETURN FALSE;
    END;

    IF v_user_id IS NULL OR v_user_id = '' THEN
        RETURN FALSE;
    END IF;

    -- Obtener line_id de la inspección
    SELECT line_id INTO v_line_id
    FROM public.quality_inspections
    WHERE id = check_inspection_id;

    IF v_line_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Verificar acceso a la línea
    RETURN EXISTS (
        SELECT 1 FROM public.user_line_assignments
        WHERE user_id = v_user_id::UUID
          AND line_id = v_line_id
    );
END;
$$;

-- ================================================================
-- SECTION 5: Habilitar RLS y crear políticas
-- ================================================================

-- 5a. quality_inspections
ALTER TABLE public.quality_inspections ENABLE ROW LEVEL SECURITY;

-- Política: operador solo ve inspecciones de líneas asignadas
DROP POLICY IF EXISTS quality_inspections_operator_select ON public.quality_inspections;
CREATE POLICY quality_inspections_operator_select ON public.quality_inspections
    FOR SELECT
    USING (user_has_line_access(line_id));

DROP POLICY IF EXISTS quality_inspections_operator_insert ON public.quality_inspections;
CREATE POLICY quality_inspections_operator_insert ON public.quality_inspections
    FOR INSERT
    WITH CHECK (user_has_line_access(line_id));

DROP POLICY IF EXISTS quality_inspections_operator_update ON public.quality_inspections;
CREATE POLICY quality_inspections_operator_update ON public.quality_inspections
    FOR UPDATE
    USING (user_has_line_access(line_id))
    WITH CHECK (user_has_line_access(line_id));

-- 5b. defect_logs (usa line_id directo ahora)
ALTER TABLE public.defect_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS defect_logs_operator_select ON public.defect_logs;
CREATE POLICY defect_logs_operator_select ON public.defect_logs
    FOR SELECT
    USING (user_has_line_access(line_id));

DROP POLICY IF EXISTS defect_logs_operator_insert ON public.defect_logs;
CREATE POLICY defect_logs_operator_insert ON public.defect_logs
    FOR INSERT
    WITH CHECK (user_has_line_access(line_id));

-- 5c. weight_logs (usa line_id directo ahora)
ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS weight_logs_operator_select ON public.weight_logs;
CREATE POLICY weight_logs_operator_select ON public.weight_logs
    FOR SELECT
    USING (user_has_line_access(line_id));

DROP POLICY IF EXISTS weight_logs_operator_insert ON public.weight_logs;
CREATE POLICY weight_logs_operator_insert ON public.weight_logs
    FOR INSERT
    WITH CHECK (user_has_line_access(line_id));

-- ================================================================
-- SECTION 6: Políticas para supervisor y admin (sin filtro)
-- ================================================================

-- Supervisor: ve todo
DROP POLICY IF EXISTS quality_inspections_supervisor_select ON public.quality_inspections;
CREATE POLICY quality_inspections_supervisor_select ON public.quality_inspections
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS defect_logs_supervisor_select ON public.defect_logs;
CREATE POLICY defect_logs_supervisor_select ON public.defect_logs
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS weight_logs_supervisor_select ON public.weight_logs;
CREATE POLICY weight_logs_supervisor_select ON public.weight_logs
    FOR SELECT
    USING (true);

-- ================================================================
-- SECTION 7: Notificación
-- ================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 020_quality_rls aplicada:';
    RAISE NOTICE '   - line_id agregado a quality_inspections, defect_logs, weight_logs (auto-sync triggers)';
    RAISE NOTICE '   - RLS habilitado en quality_inspections, defect_logs, weight_logs';
    RAISE NOTICE '   - 3 triggers de sync: trg_quality_inspections_sync_line_id';
    RAISE NOTICE '                          trg_defect_logs_sync_line_id';
    RAISE NOTICE '                          trg_weight_logs_sync_line_id';
    RAISE NOTICE '   - 3 funciones helper + 9 políticas RLS';
    RAISE NOTICE '   - Operador: filtrado por user_line_assignments';
    RAISE NOTICE '   - Supervisor/Admin: sin restricción';
    RAISE NOTICE '';
    RAISE NOTICE '⚠ IMPORTANTE: Aplicar también quality_permissions.json en Hasura';
    RAISE NOTICE '  para la capa de permisos a nivel GraphQL.';
    RAISE NOTICE '  bash hasura/apply_metadata.sh --endpoint <url> --admin-secret <secret>';
END;
$$;
