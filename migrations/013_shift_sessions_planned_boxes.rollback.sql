-- Rollback: 013_shift_sessions_planned_boxes
-- Elimina las columnas agregadas a shift_sessions y los índices analíticos nuevos
--
-- Orden: primero índices (no tienen dependencias), luego columnas

DROP INDEX IF EXISTS idx_oee_events_started_at;
DROP INDEX IF EXISTS idx_reports_created_at;
DROP INDEX IF EXISTS idx_telemetry_raw_received_at;

ALTER TABLE public.shift_sessions
  DROP COLUMN IF EXISTS planned_boxes,
  DROP COLUMN IF EXISTS product_code;
