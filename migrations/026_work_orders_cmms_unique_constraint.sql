-- Migration: 026_work_orders_cmms_unique_constraint
-- Agrega restricción UNIQUE sobre cmms_wo_id para permitir upsert
-- vía Hasura REST endpoint (on_conflict).
--
-- Dependencias: 025_work_orders_cmms_integration
--
-- Propósito:
--   Hasura REST endpoint "upsert_work_order_from_cmms" utiliza el patrón
--   insert_work_orders con on_conflict para hacer upsert. El on_conflict
--   requiere una restricción UNIQUE (o EXCLUSION) sobre la columna cmms_wo_id.
--   Esta migración agrega dicha restricción.
--
-- Nota:
--   PostgreSQL permite múltiples NULLs en una columna con UNIQUE,
--   por lo que filas existentes con cmms_wo_id IS NULL no causan conflictos.
--
-- ================================================================
-- SECTION 1: Agregar restricción UNIQUE sobre cmms_wo_id
-- ================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint pc
        JOIN pg_class tc ON pc.conrelid = tc.oid
        WHERE tc.relname = 'work_orders'
          AND pc.conname = 'work_orders_cmms_wo_id_key'
          AND pc.contype = 'u'
    ) THEN
        ALTER TABLE work_orders
            ADD CONSTRAINT work_orders_cmms_wo_id_key UNIQUE (cmms_wo_id);
    END IF;
END;
$$;

-- ================================================================
-- SECTION 2: Comentario en español
-- ================================================================

COMMENT ON CONSTRAINT work_orders_cmms_wo_id_key ON work_orders IS
    'Restricción UNIQUE sobre cmms_wo_id para upsert desde cmms-ibero vía Hasura on_conflict';

-- ================================================================
-- SECTION 3: Notificación
-- ================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 026_work_orders_cmms_unique_constraint aplicada:';
    RAISE NOTICE '   - Restricción UNIQUE work_orders_cmms_wo_id_key agregada sobre cmms_wo_id';
    RAISE NOTICE '   - Permite upsert vía Hasura REST endpoint: POST /api/rest/upsert_work_order_from_cmms';
    RAISE NOTICE '   - PostgreSQL permite NULLs múltiples (NULL != NULL) — filas legacy no afectadas';
END;
$$;
