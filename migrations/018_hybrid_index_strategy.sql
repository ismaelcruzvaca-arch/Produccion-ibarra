-- Migration: 018_hybrid_index_strategy
-- Estrategia de indexación híbrida B-Tree + BRIN para el ecosistema analítico
--
-- Dos familias de índices:
--
-- 1. B-Tree Compuestos → Tablas TRANSACCIONALES (operador manual)
--    Volumen bajo/medio (decenas a cientos de registros por día)
--    Power BI SIEMPRE filtra por (machine_id, shift_type, fecha)
--    Índice compuesto exacto = Index Scan, no Sequential Scan
--
-- 2. BRIN (Block Range Index) → Tablas TIME-SERIES / IoT
--    Volumen alto (telemetría a 15 Hz = millones de registros)
--    B-Tree aquí pesa GB de RAM y frena la ingesta
--    BRIN ocupa ~1% del tamaño de un B-Tree, escaneo de rango absurdo
--
-- Orden: primero BRIN (no bloquean lecturas), luego B-Tree CONCURRENTLY
-- ================================================================

-- ================================================================
-- FAMILIA 1: ÍNDICES BRIN — Series de Tiempo
-- ================================================================

-- telemetry_raw_staging: IoT a 15 Hz, millones de filas
-- BRIN sobre received_at porque los inserts son secuenciales por tiempo
CREATE INDEX IF NOT EXISTS idx_telemetry_raw_received_at_brin
  ON public.telemetry_raw_staging
  USING brin (received_at)
  WITH (pages_per_range = 32);
COMMENT ON INDEX idx_telemetry_raw_received_at_brin IS
  'BRIN para telemetría IoT — inserts secuenciales, rango por fecha';

-- oee_events: eventos semi-automáticos, miles/día
-- El timestamp es bigint (epoch), BRIN funciona igual con enteros ordenados
CREATE INDEX IF NOT EXISTS idx_oee_events_timestamp_brin
  ON public.oee_events
  USING brin (timestamp)
  WITH (pages_per_range = 16);
COMMENT ON INDEX idx_oee_events_timestamp_brin IS
  'BRIN para eventos OEE — escaneo por rango de tiempo';

-- tostado_hourly: si recibe IoT, puede escalar rápido
-- BRIN sobre hora (TIMESTAMPTZ ordenado)
CREATE INDEX IF NOT EXISTS idx_tostado_hourly_hora_brin
  ON public.tostado_hourly
  USING brin (hora)
  WITH (pages_per_range = 16);
COMMENT ON INDEX idx_tostado_hourly_hora_brin IS
  'BRIN para tostado horario — escaneo por rango de hora';

-- ================================================================
-- FAMILIA 2: ÍNDICES B-TREE COMPUESTOS — Tablas Transaccionales
-- ================================================================
-- NOTA: Se usa CONCURRENTLY para no bloquear escrituras de operadores
-- en producción. Esto aplica a TODOS los CREATE INDEX de esta familia.

-- quality_inspections: Power BI filtra por (máquina, turno, fecha)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quality_inspections_group
  ON public.quality_inspections(machine_id, shift_type, created_at DESC);
COMMENT ON INDEX idx_quality_inspections_group IS
  'B-Tree compuesto para view_quality_defects_by_shift';

-- defect_logs: JOIN crítico con quality_inspections
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_defect_logs_inspection_group
  ON public.defect_logs(inspection_id, severity);
COMMENT ON INDEX idx_defect_logs_inspection_group IS
  'B-Tree compuesto para pivot de severidad en defect_logs';

-- weight_logs: JOIN con quality_inspections
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_weight_logs_inspection_id
  ON public.weight_logs(inspection_id);

-- mezclado_batches: Power BI filtra por (máquina, turno, fecha)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mezclado_batches_group
  ON public.mezclado_batches(machine_id, shift_type, created_at DESC);
COMMENT ON INDEX idx_mezclado_batches_group IS
  'B-Tree compuesto para view_mezclado_mesa';

-- mezclado_ingredients: JOIN con batches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mezclado_ingredients_batch_group
  ON public.mezclado_ingredients(batch_id, ingredient_type);
COMMENT ON INDEX idx_mezclado_ingredients_batch_group IS
  'B-Tree compuesto para pivot de ingredientes';

-- mezclado_shift_totals: JOIN por (máquina, turno, fecha)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mezclado_shift_totals_group
  ON public.mezclado_shift_totals(machine_id, shift_type, fecha DESC);
COMMENT ON INDEX idx_mezclado_shift_totals_group IS
  'B-Tree compuesto para totales por turno en mezclado';

-- tostado_hourly: Power BI filtra por (máquina, turno, hora)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tostado_hourly_group
  ON public.tostado_hourly(machine_id, shift_type, hora DESC);
COMMENT ON INDEX idx_tostado_hourly_group IS
  'B-Tree compuesto para view_tostadores';

-- tostado_shift_totals: JOIN por (máquina, turno, fecha)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tostado_shift_totals_group
  ON public.tostado_shift_totals(machine_id, shift_type, fecha DESC);

-- vitaminas_batches: Power BI filtra por (máquina, turno, fecha)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vitaminas_batches_group
  ON public.vitaminas_batches(machine_id, shift_type, created_at DESC);
COMMENT ON INDEX idx_vitaminas_batches_group IS
  'B-Tree compuesto para view_mezclado_vitaminas';

-- vitaminas_ingredients: JOIN con batches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vitaminas_ingredients_batch_group
  ON public.vitaminas_ingredients(batch_id, ingredient_type);
COMMENT ON INDEX idx_vitaminas_ingredients_batch_group IS
  'B-Tree compuesto para pivot de micro-ingredientes';

-- shift_sessions: JOIN base para todas las vistas
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shift_sessions_group
  ON public.shift_sessions(machine_id, shift_type, started_at DESC);
COMMENT ON INDEX idx_shift_sessions_group IS
  'B-Tree compuesto para JOIN de turnos en vistas';

-- reports: datos de operador vía app
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reports_group
  ON public.reports(machine_id, shift_type, created_at DESC);
COMMENT ON INDEX idx_reports_group IS
  'B-Tree compuesto para reports JSONB';

-- ================================================================
-- VERIFY: Script de verificación
-- ================================================================
-- Ejecutar: migrations/018_hybrid_index_strategy.verify.sql
