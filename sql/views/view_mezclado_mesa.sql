-- VIEW: view_mezclado_mesa — Mezclado Mesa (F-PD-17)
--
-- Propósito:
--   Digitalizar el formato F-PD-17 — control de mezclado de pasta para
--   Chocolate de Mesa. Exponer una fila por batch con ingredientes pivotados,
--   parámetros de proceso (IoT preferido, manual como fallback), trazabilidad
--   por lote (lot_number del ingrediente de mayor prioridad) y totales agregados
--   por turno.
--
-- Dependencias:
--   public.mezclado_batches, public.mezclado_ingredients,
--   public.mezclado_shift_totals, public.machines, public.lines,
--   public.operators, public.telemetry_raw_staging
--
-- Diseño:
--   4 CTEs + SELECT final con LEFT JOIN + COALESCE para tolerancia a
--   datos faltantes. La alineación temporal usa AT TIME ZONE
--   'America/Mexico_City' en toda la VIEW.
--
-- CTEs:
--   batches           — JOIN mezclado_batches → machines → lines → operators
--   ingredients_pivot — GROUP BY batch_id, SUM FILTER para cada ingrediente
--   telemetry         — AVG de parámetros IoT desde telemetry_raw_staging
--   shift_totals      — Totales agregados desde mezclado_shift_totals
--
-- Columnas (22+):
--   fecha, shift_type, machine_code, machine_name, line_name, operator_name,
--   batch_number, mezcladora_id, total_kg,
--   7 ingredientes pivotados (azucar_kg .. reproceso_kg),
--   viscosidad_cps, temp_descarga, temp_deposito (IoT → manual),
--   tiempo_mezclado, lot_number,
--   6 totales de turno (total_mezcladas .. reproceso_total_kg),
--   data_source, status
--
-- Nota:
--   El lot_number se deriva del ingrediente con mayor prioridad de negocio:
--   licor > azúcar > cocoa > grasa_vegetal > fórmula > lecitina > reproceso.
--   data_source se obtiene de COALESCE(batches.data_source, 'manual').
--
-- Historial:
--   2026-05-24 - Creación inicial

CREATE OR REPLACE VIEW public.view_mezclado_mesa AS
WITH

-- ============================================================
-- CTE 1: batches — Cabecera de batch con datos descriptivos
--   JOINea mezclado_batches → machines → lines → operators para
--   obtener machine_code, machine_name, line_name, operator_name.
--   Convierte hora_entrada a timezone CDMX y extrae fecha (DATE).
-- ============================================================
batches AS (
  SELECT
    mb.id,
    mb.machine_id,
    m.code                                   AS machine_code,
    m.name                                   AS machine_name,
    l.name                                   AS line_name,
    op.full_name                             AS operator_name,
    mb.shift_type,
    mb.batch_number,
    mb.mezcladora_id,
    mb.total_kg,
    mb.viscosidad_cps,
    mb.temp_descarga,
    mb.temp_deposito,
    mb.tiempo_mezclado_min                   AS tiempo_mezclado,
    mb.status,
    mb.data_source,
    mb.hora_entrada,
    date_trunc('day', mb.hora_entrada AT TIME ZONE 'America/Mexico_City')::date AS fecha
  FROM public.mezclado_batches mb
  JOIN public.machines m ON m.id = mb.machine_id
  JOIN public.lines l ON l.id = m.line_id
  LEFT JOIN public.operators op ON op.id = mb.operator_id
),

-- ============================================================
-- CTE 2: ingredients_pivot — Pivot de ingredientes por batch
--   Agrupa mezclado_ingredients por batch_id y pivota cada
--   ingredient_type como columna separada usando SUM FILTER.
--   COALESCE con NULL para que un ingrediente ausente se muestre
--   como NULL (no 0). El lot_number se deriva del ingrediente de
--   mayor prioridad usando COALESCE anidado con FILTER por
--   orden de prioridad: licor > azúcar > cocoa > grasa_vegetal >
--   fórmula > lecitina > reproceso.
-- ============================================================
ingredients_pivot AS (
  SELECT
    mi.batch_id,

    -- Kilogramos por tipo de ingrediente (NULL cuando no presente)
    SUM(mi.kg) FILTER (WHERE mi.ingredient_type = 'azucar')        AS azucar_kg,
    SUM(mi.kg) FILTER (WHERE mi.ingredient_type = 'licor')         AS licor_kg,
    SUM(mi.kg) FILTER (WHERE mi.ingredient_type = 'cocoa')         AS cocoa_kg,
    SUM(mi.kg) FILTER (WHERE mi.ingredient_type = 'grasa_vegetal') AS grasa_kg,
    SUM(mi.kg) FILTER (WHERE mi.ingredient_type = 'formula')       AS formula_kg,
    SUM(mi.kg) FILTER (WHERE mi.ingredient_type = 'lecitina')      AS lecitina_kg,
    SUM(mi.kg) FILTER (WHERE mi.ingredient_type = 'reproceso')     AS reproceso_kg,

    -- Trazabilidad: lote del ingrediente de mayor prioridad
    COALESCE(
      MAX(mi.lot_number) FILTER (WHERE mi.ingredient_type = 'licor'),
      MAX(mi.lot_number) FILTER (WHERE mi.ingredient_type = 'azucar'),
      MAX(mi.lot_number) FILTER (WHERE mi.ingredient_type = 'cocoa'),
      MAX(mi.lot_number) FILTER (WHERE mi.ingredient_type = 'grasa_vegetal'),
      MAX(mi.lot_number) FILTER (WHERE mi.ingredient_type = 'formula'),
      MAX(mi.lot_number) FILTER (WHERE mi.ingredient_type = 'lecitina'),
      MAX(mi.lot_number) FILTER (WHERE mi.ingredient_type = 'reproceso')
    )                                                              AS lot_number

  FROM public.mezclado_ingredients mi
  GROUP BY mi.batch_id
),

-- ============================================================
-- CTE 3: telemetry — Parámetros IoT agregados por máquina y hora
--   Calcula AVG de viscosidad, temp_descarga y temp_deposito desde
--   telemetry_raw_staging, agrupado por machine_id + hora natural
--   en CDMX. Los valores individuales se extraen del payload JSONB
--   mediante el operador ->>.
--   Sin FILTER — AVG de un solo valor o de múltiples lecturas en
--   la misma ventana horaria.
-- ============================================================
telemetry AS (
  SELECT
    tr.machine_id,
    date_trunc('hour', tr.received_at AT TIME ZONE 'America/Mexico_City')::timestamp without time zone AS local_hour,
    AVG(COALESCE((tr.payload->>'viscosidad_cps')::NUMERIC, NULL)) AS viscosidad_cps,
    AVG(COALESCE((tr.payload->>'temp_descarga')::NUMERIC, NULL))  AS temp_descarga,
    AVG(COALESCE((tr.payload->>'temp_deposito')::NUMERIC, NULL))  AS temp_deposito
  FROM public.telemetry_raw_staging tr
  WHERE tr.payload IS NOT NULL
  GROUP BY tr.machine_id, date_trunc('hour', tr.received_at AT TIME ZONE 'America/Mexico_City')
),

-- ============================================================
-- CTE 4: shift_totals — Totales agregados por turno
--   Simplemente expone mezclado_shift_totals como CTE para
--   mantener la consistencia de la VIEW y LEFT JOINear en el
--   SELECT final.
-- ============================================================
shift_totals AS (
  SELECT
    st.machine_id,
    st.shift_type,
    st.fecha,
    st.total_mezcladas,
    st.total_molidas,
    st.desperdicio_licor_kg,
    st.desperdicio_azucar_kg,
    st.barreduras_kg,
    st.reproceso_total_kg
  FROM public.mezclado_shift_totals st
)

-- ============================================================
-- SELECT final — batches LEFT JOIN ingredients + telemetry + totals
--   batches es el ancla LEFT: todo batch aparece aunque no tenga
--   ingredientes, telemetría o totales de turno.
--   telemetry se alinea por machine_id + hora de hora_entrada.
--   shift_totals se alinea por machine_id + shift_type + fecha.
--   viscosidad/temperatura usan COALESCE (IoT → manual batch).
-- ============================================================
SELECT
  -- ========== Dimensiones de agrupación ==========
  b.fecha                                          AS fecha,
  b.shift_type                                     AS shift_type,
  b.machine_code                                   AS machine_code,
  b.machine_name                                   AS machine_name,
  b.line_name                                      AS line_name,
  b.operator_name                                  AS operator_name,

  -- ========== Batch ==========
  b.batch_number                                   AS batch_number,
  b.mezcladora_id                                  AS mezcladora_id,
  b.total_kg                                       AS total_kg,

  -- ========== Ingredientes pivotados ==========
  ip.azucar_kg                                     AS azucar_kg,
  ip.licor_kg                                      AS licor_kg,
  ip.cocoa_kg                                      AS cocoa_kg,
  ip.grasa_kg                                      AS grasa_kg,
  ip.formula_kg                                    AS formula_kg,
  ip.lecitina_kg                                   AS lecitina_kg,
  ip.reproceso_kg                                  AS reproceso_kg,

  -- ========== Parámetros de proceso (IoT preferido → batch manual fallback) ==========
  COALESCE(t.viscosidad_cps, b.viscosidad_cps)     AS viscosidad_cps,
  COALESCE(t.temp_descarga, b.temp_descarga)        AS temp_descarga,
  COALESCE(t.temp_deposito, b.temp_deposito)        AS temp_deposito,
  b.tiempo_mezclado                                AS tiempo_mezclado,

  -- ========== Trazabilidad ==========
  ip.lot_number                                    AS lot_number,

  -- ========== Totales del turno ==========
  st.total_mezcladas                               AS total_mezcladas,
  st.total_molidas                                 AS total_molidas,
  st.desperdicio_licor_kg                          AS desperdicio_licor_kg,
  st.desperdicio_azucar_kg                         AS desperdicio_azucar_kg,
  st.barreduras_kg                                 AS barreduras_kg,
  st.reproceso_total_kg                            AS reproceso_total_kg,

  -- ========== Metadatos ==========
  COALESCE(b.data_source, 'manual')                AS data_source,
  b.status                                         AS status

FROM batches b
LEFT JOIN ingredients_pivot ip ON ip.batch_id = b.id
LEFT JOIN telemetry t
  ON t.machine_id = b.machine_id
 AND t.local_hour = date_trunc('hour', b.hora_entrada AT TIME ZONE 'America/Mexico_City')::timestamp without time zone
LEFT JOIN shift_totals st
  ON st.machine_id = b.machine_id
 AND st.shift_type = b.shift_type
 AND st.fecha = b.fecha
ORDER BY
  b.fecha,
  b.machine_code,
  b.shift_type,
  b.batch_number;

-- ============================================================
-- Comentarios de VIEW y COLUMNAS
-- ============================================================

COMMENT ON VIEW public.view_mezclado_mesa IS
  'Mezclado Mesa (F-PD-17) — una fila por batch con ingredientes pivotados, parámetros IoT+manual, lot_number y totales del turno';

COMMENT ON COLUMN public.view_mezclado_mesa.fecha IS
  'Fecha del batch en CDMX (día natural)';

COMMENT ON COLUMN public.view_mezclado_mesa.shift_type IS
  'Tipo de turno: matutino, vespertino, nocturno';

COMMENT ON COLUMN public.view_mezclado_mesa.machine_code IS
  'Código de máquina';

COMMENT ON COLUMN public.view_mezclado_mesa.machine_name IS
  'Nombre de máquina';

COMMENT ON COLUMN public.view_mezclado_mesa.line_name IS
  'Nombre de línea de producción';

COMMENT ON COLUMN public.view_mezclado_mesa.operator_name IS
  'Nombre completo del operador responsable';

COMMENT ON COLUMN public.view_mezclado_mesa.batch_number IS
  'Número de batch dentro del turno';

COMMENT ON COLUMN public.view_mezclado_mesa.mezcladora_id IS
  'Identificador de la mezcladora utilizada (1 o 2)';

COMMENT ON COLUMN public.view_mezclado_mesa.total_kg IS
  'Peso total del batch en kilogramos';

COMMENT ON COLUMN public.view_mezclado_mesa.azucar_kg IS
  'Kilogramos de azúcar en el batch (NULL si no presente)';

COMMENT ON COLUMN public.view_mezclado_mesa.licor_kg IS
  'Kilogramos de licor en el batch (NULL si no presente)';

COMMENT ON COLUMN public.view_mezclado_mesa.cocoa_kg IS
  'Kilogramos de cocoa en el batch (NULL si no presente)';

COMMENT ON COLUMN public.view_mezclado_mesa.grasa_kg IS
  'Kilogramos de grasa vegetal en el batch (NULL si no presente)';

COMMENT ON COLUMN public.view_mezclado_mesa.formula_kg IS
  'Kilogramos de fórmula en el batch (NULL si no presente)';

COMMENT ON COLUMN public.view_mezclado_mesa.lecitina_kg IS
  'Kilogramos de lecitina en el batch (NULL si no presente)';

COMMENT ON COLUMN public.view_mezclado_mesa.reproceso_kg IS
  'Kilogramos de reproceso en el batch (NULL si no presente)';

COMMENT ON COLUMN public.view_mezclado_mesa.viscosidad_cps IS
  'Viscosidad en cps — IoT preferido, valor manual del batch como fallback';

COMMENT ON COLUMN public.view_mezclado_mesa.temp_descarga IS
  'Temperatura de descarga en °C — IoT preferido, valor manual del batch como fallback';

COMMENT ON COLUMN public.view_mezclado_mesa.temp_deposito IS
  'Temperatura de depósito en °C — IoT preferido, valor manual del batch como fallback';

COMMENT ON COLUMN public.view_mezclado_mesa.tiempo_mezclado IS
  'Tiempo de mezclado en minutos';

COMMENT ON COLUMN public.view_mezclado_mesa.lot_number IS
  'Número de lote del ingrediente con mayor prioridad de negocio (licor > azúcar > cocoa > grasa_vegetal > fórmula > lecitina > reproceso)';

COMMENT ON COLUMN public.view_mezclado_mesa.total_mezcladas IS
  'Total de mezcladas realizadas en el turno';

COMMENT ON COLUMN public.view_mezclado_mesa.total_molidas IS
  'Total de molidas realizadas en el turno';

COMMENT ON COLUMN public.view_mezclado_mesa.desperdicio_licor_kg IS
  'Desperdicio de licor en kilogramos';

COMMENT ON COLUMN public.view_mezclado_mesa.desperdicio_azucar_kg IS
  'Desperdicio de azúcar en kilogramos';

COMMENT ON COLUMN public.view_mezclado_mesa.barreduras_kg IS
  'Barreduras generadas en kilogramos';

COMMENT ON COLUMN public.view_mezclado_mesa.reproceso_total_kg IS
  'Total de reproceso en kilogramos';

COMMENT ON COLUMN public.view_mezclado_mesa.data_source IS
  'Fuente de datos: manual (captura operador), iot (telemetría), hybrid (ambos)';

COMMENT ON COLUMN public.view_mezclado_mesa.status IS
  'Estado del batch: pending, in_progress, completed, rejected';
