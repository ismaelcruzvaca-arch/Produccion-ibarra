-- VIEW: view_tostadores — Tostadores (F-PD-16)
--
-- Propósito:
--   Digitalizar el formato F-PD-16 — Reporte de Tostadores. Control de
--   tostado de cacao por hora con parámetros de proceso (temperatura
--   superior/media/inferior, RPM, presión, humedad), inventario de silos,
--   subproductos (cascarilla, polvillo, granilla) y totales agregados
--   por turno. Fuente híbrida IoT + operador.
--
-- Dependencias:
--   public.tostado_hourly, public.tostado_shift_totals,
--   public.machines, public.operators,
--   public.telemetry_raw_staging
--
-- Diseño:
--   3 CTEs + SELECT final con LEFT JOIN + COALESCE para tolerancia a
--   datos faltantes. La alineación temporal usa AT TIME ZONE
--   'America/Mexico_City' en toda la VIEW.
--
-- CTEs:
--   hourly    — JOIN tostado_hourly → machines → operators
--   telemetry — AVG de parámetros IoT desde telemetry_raw_staging
--               por machine_id + hora (temp_superior, temp_media,
--               temp_inferior, rpm, presion_vapor)
--   shift     — Totales agregados desde tostado_shift_totals
--
-- Columnas (28):
--   fecha, hora, shift_type, machine_code, machine_name, operator_name,
--   pesada_kg,
--   temp_superior, temp_media, temp_inferior (IoT → manual),
--   rpm (IoT → manual), presion_vapor (IoT → manual),
--   humedad_crudo_pct, humedad_tostado_pct,
--   tiempo_muerto_min, causa_paro,
--   total_kg_tostados, cascarilla_kg, polvillo_kg, granilla_kg,
--   pct_cascarilla_en_granilla, pct_granilla_en_cascarilla,
--   silo_origen, horas_trabajadas, extractores_funcionando, extractores_totales,
--   data_source
--
-- Nota:
--   data_source se calcula dinámicamente:
--     'iot'     — cuando hourly.data_source = 'iot' (origen IoT)
--     'hybrid'  — cuando IoT telemetry enriquece datos manuales
--     'manual'  — cuando solo hay datos del operador
--
-- Historial:
--   2026-05-24 - Creación inicial

CREATE OR REPLACE VIEW public.view_tostadores AS
WITH

-- ============================================================
-- CTE 1: hourly — Lectura horaria con datos descriptivos
--   JOINea tostado_hourly → machines → operators para
--   obtener machine_code, machine_name, operator_name.
--   Convierte hora a timezone CDMX y extrae fecha (DATE) y hora (TIME).
-- ============================================================
hourly AS (
  SELECT
    th.id,
    th.machine_id,
    m.code                                   AS machine_code,
    m.name                                   AS machine_name,
    op.full_name                             AS operator_name,
    th.operator_id,
    th.shift_type,
    th.hora,
    (th.hora AT TIME ZONE 'America/Mexico_City')::date AS fecha,
    (th.hora AT TIME ZONE 'America/Mexico_City')::time AS hora_local,
    th.pesada_kg,
    th.temp_superior,
    th.temp_media,
    th.temp_inferior,
    th.rpm,
    th.presion_vapor,
    th.humedad_crudo_pct,
    th.humedad_tostado_pct,
    th.tiempo_muerto_min,
    th.causa_paro,
    th.data_source
  FROM public.tostado_hourly th
  JOIN public.machines m ON m.id = th.machine_id
  LEFT JOIN public.operators op ON op.id = th.operator_id
),

-- ============================================================
-- CTE 2: telemetry — Parámetros IoT agregados por máquina y hora
--   Calcula AVG de temp_superior, temp_media, temp_inferior, rpm,
--   presion_vapor desde telemetry_raw_staging, agrupado por
--   machine_id + hora natural en CDMX.
--   Los valores individuales se extraen del payload JSONB
--   mediante el operador ->>.
-- ============================================================
telemetry AS (
  SELECT
    tr.machine_id,
    date_trunc('hour', tr.received_at AT TIME ZONE 'America/Mexico_City')::timestamp without time zone AS local_hour,
    AVG(COALESCE((tr.payload->>'temp_superior')::NUMERIC, NULL))  AS temp_superior,
    AVG(COALESCE((tr.payload->>'temp_media')::NUMERIC, NULL))     AS temp_media,
    AVG(COALESCE((tr.payload->>'temp_inferior')::NUMERIC, NULL))  AS temp_inferior,
    AVG(COALESCE((tr.payload->>'rpm')::NUMERIC, NULL))            AS rpm,
    AVG(COALESCE((tr.payload->>'presion_vapor')::NUMERIC, NULL))  AS presion_vapor
  FROM public.telemetry_raw_staging tr
  WHERE tr.payload IS NOT NULL
  GROUP BY tr.machine_id, date_trunc('hour', tr.received_at AT TIME ZONE 'America/Mexico_City')
),

-- ============================================================
-- CTE 3: shift — Totales agregados por turno
--   Simplemente expone tostado_shift_totals como CTE para
--   mantener la consistencia de la VIEW y LEFT JOINear en el
--   SELECT final.
-- ============================================================
shift AS (
  SELECT
    st.machine_id,
    st.shift_type,
    st.fecha,
    st.total_kg_tostados,
    st.cascarilla_kg,
    st.polvillo_kg,
    st.granilla_kg,
    st.pct_cascarilla_en_granilla,
    st.pct_granilla_en_cascarilla,
    st.silo_origen,
    st.horas_trabajadas,
    st.extractores_funcionando,
    st.extractores_totales
  FROM public.tostado_shift_totals st
)

-- ============================================================
-- SELECT final — hourly LEFT JOIN telemetry + shift
--   hourly es el ancla LEFT: toda lectura horaria aparece aunque
--   no tenga telemetría o totales de turno.
--   telemetry se alinea por machine_id + hora de hora.
--   shift se alinea por machine_id + shift_type + fecha.
--   temperatura, RPM y presión usan COALESCE (IoT → manual hourly).
--   data_source se calcula dinámicamente según fuentes disponibles.
-- ============================================================
SELECT
  -- ========== Dimensiones de agrupación ==========
  h.fecha                                          AS fecha,
  h.hora_local                                     AS hora,
  h.shift_type                                     AS shift_type,
  h.machine_code                                   AS machine_code,
  h.machine_name                                   AS machine_name,
  h.operator_name                                  AS operator_name,

  -- ========== Pesada ==========
  h.pesada_kg                                      AS pesada_kg,

  -- ========== Parámetros de proceso (IoT preferido → hourly manual fallback) ==========
  COALESCE(t.temp_superior, h.temp_superior)       AS temp_superior,
  COALESCE(t.temp_media, h.temp_media)             AS temp_media,
  COALESCE(t.temp_inferior, h.temp_inferior)       AS temp_inferior,
  COALESCE(t.rpm, h.rpm)                           AS rpm,
  COALESCE(t.presion_vapor, h.presion_vapor)       AS presion_vapor,

  -- ========== Humedad (solo manual — no hay IoT para estas) ==========
  h.humedad_crudo_pct                              AS humedad_crudo_pct,
  h.humedad_tostado_pct                            AS humedad_tostado_pct,

  -- ========== Paros ==========
  h.tiempo_muerto_min                              AS tiempo_muerto_min,
  h.causa_paro                                     AS causa_paro,

  -- ========== Totales del turno ==========
  st.total_kg_tostados                             AS total_kg_tostados,
  st.cascarilla_kg                                 AS cascarilla_kg,
  st.polvillo_kg                                   AS polvillo_kg,
  st.granilla_kg                                   AS granilla_kg,
  st.pct_cascarilla_en_granilla                    AS pct_cascarilla_en_granilla,
  st.pct_granilla_en_cascarilla                    AS pct_granilla_en_cascarilla,
  st.silo_origen                                   AS silo_origen,
  st.horas_trabajadas                              AS horas_trabajadas,
  st.extractores_funcionando                       AS extractores_funcionando,
  st.extractores_totales                           AS extractores_totales,

  -- ========== Metadatos ==========
  CASE
    WHEN h.data_source = 'iot' THEN 'iot'
    WHEN t.machine_id IS NOT NULL THEN 'hybrid'
    ELSE COALESCE(h.data_source, 'manual')
  END                                              AS data_source

FROM hourly h
LEFT JOIN telemetry t
  ON t.machine_id = h.machine_id
 AND t.local_hour = date_trunc('hour', h.hora AT TIME ZONE 'America/Mexico_City')::timestamp without time zone
LEFT JOIN shift st
  ON st.machine_id = h.machine_id
 AND st.shift_type = h.shift_type
 AND st.fecha = h.fecha
ORDER BY
  h.fecha,
  h.hora_local,
  h.machine_code,
  h.shift_type;

-- ============================================================
-- Comentarios de VIEW y COLUMNAS
-- ============================================================

COMMENT ON VIEW public.view_tostadores IS
  'Tostadores (F-PD-16) — una fila por máquina×hora×turno con parámetros de proceso IoT+manual, paros y totales del turno';

COMMENT ON COLUMN public.view_tostadores.fecha IS
  'Fecha de la lectura en CDMX (día natural)';

COMMENT ON COLUMN public.view_tostadores.hora IS
  'Hora local de la lectura en CDMX';

COMMENT ON COLUMN public.view_tostadores.shift_type IS
  'Tipo de turno: matutino, vespertino, nocturno';

COMMENT ON COLUMN public.view_tostadores.machine_code IS
  'Código del tostador';

COMMENT ON COLUMN public.view_tostadores.machine_name IS
  'Nombre del tostador';

COMMENT ON COLUMN public.view_tostadores.operator_name IS
  'Nombre completo del operador responsable';

COMMENT ON COLUMN public.view_tostadores.pesada_kg IS
  'Kilogramos de cacao pesados en la hora';

COMMENT ON COLUMN public.view_tostadores.temp_superior IS
  'Temperatura superior del tostador en °C — IoT preferido, valor manual como fallback';

COMMENT ON COLUMN public.view_tostadores.temp_media IS
  'Temperatura media del tostador en °C — IoT preferido, valor manual como fallback';

COMMENT ON COLUMN public.view_tostadores.temp_inferior IS
  'Temperatura inferior del tostador en °C — IoT preferido, valor manual como fallback';

COMMENT ON COLUMN public.view_tostadores.rpm IS
  'RPM del tambor — IoT preferido, valor manual como fallback';

COMMENT ON COLUMN public.view_tostadores.presion_vapor IS
  'Presión de vapor en kgf/cm² — IoT preferido, valor manual como fallback';

COMMENT ON COLUMN public.view_tostadores.humedad_crudo_pct IS
  'Porcentaje de humedad del cacao crudo';

COMMENT ON COLUMN public.view_tostadores.humedad_tostado_pct IS
  'Porcentaje de humedad del cacao tostado';

COMMENT ON COLUMN public.view_tostadores.tiempo_muerto_min IS
  'Minutos de tiempo muerto o paro en la hora';

COMMENT ON COLUMN public.view_tostadores.causa_paro IS
  'Causa del paro (código según catálogo) — NULL si no hubo paro';

COMMENT ON COLUMN public.view_tostadores.total_kg_tostados IS
  'Total de kilogramos tostados en el turno';

COMMENT ON COLUMN public.view_tostadores.cascarilla_kg IS
  'Kilogramos de cascarilla producida en el turno';

COMMENT ON COLUMN public.view_tostadores.polvillo_kg IS
  'Kilogramos de polvillo producido en el turno';

COMMENT ON COLUMN public.view_tostadores.granilla_kg IS
  'Kilogramos de granilla producida en el turno';

COMMENT ON COLUMN public.view_tostadores.pct_cascarilla_en_granilla IS
  'Porcentaje de cascarilla presente en la granilla';

COMMENT ON COLUMN public.view_tostadores.pct_granilla_en_cascarilla IS
  'Porcentaje de granilla presente en la cascarilla';

COMMENT ON COLUMN public.view_tostadores.silo_origen IS
  'Silo de origen del cacao';

COMMENT ON COLUMN public.view_tostadores.horas_trabajadas IS
  'Horas trabajadas en el turno';

COMMENT ON COLUMN public.view_tostadores.extractores_funcionando IS
  'Número de extractores funcionando';

COMMENT ON COLUMN public.view_tostadores.extractores_totales IS
  'Número total de extractores disponibles';

COMMENT ON COLUMN public.view_tostadores.data_source IS
  'Fuente de datos: manual (solo operador), iot (solo telemetría), hybrid (ambos)';
