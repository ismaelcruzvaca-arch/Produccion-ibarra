-- Migration: 025_work_orders_cmms_integration
-- Agrega columnas de integración con cmms-ibero para el ciclo de vida
-- de órdenes de trabajo (work orders lifecycle).
--
-- Dependencias: public.work_orders (tabla existente, creada fuera de migraciones)
--
-- Propósito:
--   Permitir que produccion-ibarra reciba y almacene información del ciclo
--   de vida de órdenes de trabajo provenientes de cmms-ibero (sistema CMMS
--   central). Las nuevas columnas permiten sincronización bidireccional
--   mediante el campo cmms_wo_id como identificador cross-system.
--
--   lifecycle_phase puede tomar los valores:
--     'WAPPR', 'APPROVED', 'INPRG', 'COMP', 'CLOSED', 'CANCELLED', 'REJECTED'
--
-- ================================================================
-- SECTION 1: Agregar columnas a work_orders
-- ================================================================

ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS lifecycle_phase TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS symptom_note TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS cause_note TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS action_note TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS actual_start_at TIMESTAMPTZ;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS cmms_wo_id TEXT;

-- ================================================================
-- SECTION 2: Comentarios en español
-- ================================================================

COMMENT ON COLUMN work_orders.lifecycle_phase IS
  'Fase del ciclo de vida desde cmms-ibero: WAPPR, APPROVED, INPRG, COMP, CLOSED, CANCELLED, REJECTED';

COMMENT ON COLUMN work_orders.symptom_note IS
  'Descripción del síntoma reportado, proveniente de cmms-ibero';

COMMENT ON COLUMN work_orders.cause_note IS
  'Descripción de la causa raíz identificada, proveniente de cmms-ibero';

COMMENT ON COLUMN work_orders.action_note IS
  'Descripción de la acción correctiva tomada, proveniente de cmms-ibero';

COMMENT ON COLUMN work_orders.actual_start_at IS
  'Marca temporal de inicio real de los trabajos, proveniente de cmms-ibero';

COMMENT ON COLUMN work_orders.completed_at IS
  'Marca temporal de finalización, proveniente de cmms-ibero';

COMMENT ON COLUMN work_orders.cmms_wo_id IS
  'UUID de la orden de trabajo en cmms-ibero para identidad cross-system (cross-reference ID)';

-- ================================================================
-- SECTION 3: Índice para búsqueda eficiente por cmms_wo_id
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_work_orders_cmms_wo_id ON work_orders (cmms_wo_id);

-- ================================================================
-- SECTION 4: Notificación
-- ================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 025_work_orders_cmms_integration aplicada:';
    RAISE NOTICE '   - 7 columnas agregadas (lifecycle_phase, symptom_note, cause_note, action_note, actual_start_at, completed_at, cmms_wo_id)';
    RAISE NOTICE '   - Todas NULLable — filas existentes no afectadas';
    RAISE NOTICE '   - Índice idx_work_orders_cmms_wo_id creado';
    RAISE NOTICE '   - 7 comentarios de columna en español';
    RAISE NOTICE '';
    RAISE NOTICE '⚠ Recordar trackear las nuevas columnas en Hasura:';
    RAISE NOTICE '  - Ejecutar hasura/metadata para incluir las columnas en GraphQL schema';
    RAISE NOTICE '  - Verificar permisos SELECT/INSERT/UPDATE para roles supervisor y admin';
END;
$$;
