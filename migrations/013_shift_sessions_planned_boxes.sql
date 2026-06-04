-- Migration: 013_shift_sessions_planned_boxes
-- Agrega columnas de planeación a shift_sessions + índices analíticos para VIEW oee_hr_x_hr
--
-- Dependencias: public.shift_sessions (migración 012)
--
-- Nota de diseño:
--   planned_boxes almacena la meta de producción del turno en cajas, proveniente
--   del plan de producción de Epicor. No se deriva ni se calcula — el valor viene
--   del ERP y se asigna al turno antes de arrancar.
--
--   product_code es el código de producto Epicor asignado al turno
--   (ej: '102/953' para Chocolate de Mesa).
--
--   Los 3 índices adicionales soportan range scans por hora para la VIEW
--   view_oee_hr_x_hr, evitando sequential scans en tablas grandes durante
--   las agregaciones por hora natural.

-- ============================================================
-- Columnas nuevas en shift_sessions
-- ============================================================
ALTER TABLE public.shift_sessions
  ADD COLUMN IF NOT EXISTS planned_boxes INTEGER,
  ADD COLUMN IF NOT EXISTS product_code VARCHAR(50);

COMMENT ON COLUMN public.shift_sessions.planned_boxes IS
  'Meta de producción del turno en cajas (viene de la planeación Epicor)';
COMMENT ON COLUMN public.shift_sessions.product_code IS
  'Código de producto asignado al turno (ej: 102/953 para Chocolate de Mesa)';

-- ============================================================
-- Índices analíticos para range scans por hora
-- ============================================================

-- Índice en oee_events.started_at para range scan por hora en CTE downtime
CREATE INDEX IF NOT EXISTS idx_oee_events_started_at
  ON public.oee_events(started_at);

-- Índice en reports.created_at para range scan por hora en CTE production
CREATE INDEX IF NOT EXISTS idx_reports_created_at
  ON public.reports(created_at);

-- Índice en telemetry_raw_staging.received_at para range scan por hora en CTE telemetry_flag
CREATE INDEX IF NOT EXISTS idx_telemetry_raw_received_at
  ON public.telemetry_raw_staging(received_at);
