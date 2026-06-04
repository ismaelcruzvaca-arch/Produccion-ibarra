-- VIEW: view_oee_hr_x_hr — OEE Hora × Hora
--
-- Propósito:
--   Exponer una fila por máquina × hora natural × turno con OEE completo
--   calculado en SQL. Es la fuente única de verdad para dashboards Power BI
--   del CEO/Planta, integrando datos manuales (operadores vía app) y
--   telemetría IoT.
--
-- Dependencias:
--   public.shift_sessions, public.machines, public.lines, public.operators,
--   public.oee_events, public.reports, public.quality_inspections,
--   public.defect_logs, public.telemetry_raw_staging
--
-- Diseño:
--   7 CTEs + SELECT final con LEFT JOIN + COALESCE para tolerancia a
--   datos faltantes. La alineación temporal usa AT TIME ZONE
--   'America/Mexico_City' en toda la VIEW.
--
-- Fórmulas OEE:
--   availability_pct  = (60 - total_downtime_min) / 60
--   performance_pct   = total_boxes / planned_boxes (NULL si planned_boxes = 0)
--   quality_pct       = good_boxes / total_boxes (NULL si total_boxes = 0)
--   oee_pct           = availability × performance × quality
--
-- Causas de paro (15 + OTROS):
--   AT=Arranque, FC=Falla Cavemil, FME=Falta Material Empaque, FS=Falla Servicios,
--   BV=Baja Velocidad, FE=Falla Eléctrica, FP=Falla Proceso, LF=Limpieza Física,
--   MP=Manto. Preventivo, PAP=Paro Administrativo Planta, PAM=Paro Admvo. Mantto,
--   CP=Cambio Presentación, AO=Ajuste Operación, MD=Material Defectuoso, OTROS
--
-- Nota: No se incluye rework_boxes (columna reservada, no requerida actualmente).
--
-- Historial:
--   2026-05-24 - Creación inicial

CREATE OR REPLACE VIEW public.view_oee_hr_x_hr AS
WITH

-- ============================================================
-- CTE 1: session_hours — Expande cada turno en filas-hora
--   Usa CROSS JOIN LATERAL generate_series para crear una fila
--   por cada hora natural que abarca el turno.
--   JOINea machines, lines, operators para datos descriptivos.
-- ============================================================
session_hours AS (
  SELECT
    ss.id                     AS session_id,
    ss.machine_id,
    ss.operator_id,
    ss.shift_type,
    ss.planned_boxes,
    ss.product_code,
    m.code                    AS machine_code,
    m.name                    AS machine_name,
    l.name                    AS line_name,
    op.full_name              AS operator_name,
    sh.local_hour,
    ROUND(
      COALESCE(ss.planned_boxes, 0)::NUMERIC
      / NULLIF(
          GREATEST(
            EXTRACT(EPOCH FROM (COALESCE(ss.ended_at, now()) - ss.started_at)) / 3600,
            1
          ),
          0
        )
    )::INTEGER                AS hourly_planned_boxes
  FROM public.shift_sessions ss
  JOIN public.machines m ON m.id = ss.machine_id
  JOIN public.lines l ON l.id = m.line_id
  LEFT JOIN public.operators op ON op.id = ss.operator_id
  CROSS JOIN LATERAL generate_series(
    date_trunc('hour', ss.started_at AT TIME ZONE 'America/Mexico_City')::timestamp without time zone,
    -- Restamos 1 segundo para que generate_series sea semi-abierto [start, end):
    -- un turno 06:00-07:00 produce SOLO la fila 06:00 (no 07:00)
    date_trunc('hour', (COALESCE(ss.ended_at, now()) - INTERVAL '1 second') AT TIME ZONE 'America/Mexico_City')::timestamp without time zone,
    '1 hour'::interval
  ) AS sh(local_hour)
),

-- ============================================================
-- CTE 2: production — Producción desde reports (datos manuales)
--   Extrae total_pieces y rejected_pieces del JSONB data,
--   agrupado por máquina y hora.
-- ============================================================
production AS (
  SELECT
    (r.data->>'machine_id')::UUID  AS machine_id,
    date_trunc('hour', r.created_at AT TIME ZONE 'America/Mexico_City')::timestamp without time zone AS local_hour,
    COALESCE((r.data->>'total_pieces')::INTEGER, 0)     AS total_boxes,
    COALESCE((r.data->>'rejected_pieces')::INTEGER, 0)  AS rejected_pieces
  FROM public.reports r
  WHERE r.data IS NOT NULL
    AND r.data ? 'total_pieces'
    AND (r.data->>'machine_id') IS NOT NULL
  GROUP BY (r.data->>'machine_id')::UUID, date_trunc('hour', r.created_at AT TIME ZONE 'America/Mexico_City')
),

-- ============================================================
-- CTE 3: defects — Defectos desde calidad
--   defect_logs se JOINea con quality_inspections para obtener
--   machine_id. Se agrupa por máquina y hora (usando created_at
--   de la inspección como proxy del momento del defecto).
-- ============================================================
defects AS (
  SELECT
    qi.machine_id,
    date_trunc('hour', qi.created_at AT TIME ZONE 'America/Mexico_City')::timestamp without time zone AS local_hour,
    COALESCE(SUM(dl.defect_count), 0)  AS defect_boxes
  FROM public.quality_inspections qi
  LEFT JOIN public.defect_logs dl ON dl.inspection_id = qi.id
  GROUP BY qi.machine_id, date_trunc('hour', qi.created_at AT TIME ZONE 'America/Mexico_City')
),

-- ============================================================
-- CTE 4: downtime — Tiempo muerto pivotado por causa
--   Convierte filas de oee_events en columnas por código de causa
--   (15 causas F-PD-21 + min_paro_otros para códigos no reconocidos
--   o NULL). Total de downtime también se computa.
-- ============================================================
downtime AS (
  SELECT
    oe.machine_id,
    date_trunc('hour', oe.started_at AT TIME ZONE 'America/Mexico_City')::timestamp without time zone AS local_hour,
    COALESCE(SUM(oe.duration_minutes), 0) AS total_downtime_min,
    -- Causas individuales (COALESCE garantiza 0 cuando no hay eventos)
    COALESCE(SUM(CASE WHEN oe.reason = 'AT'   THEN oe.duration_minutes END), 0) AS min_paro_at,
    COALESCE(SUM(CASE WHEN oe.reason = 'FC'   THEN oe.duration_minutes END), 0) AS min_paro_fc,
    COALESCE(SUM(CASE WHEN oe.reason = 'FME'  THEN oe.duration_minutes END), 0) AS min_paro_fme,
    COALESCE(SUM(CASE WHEN oe.reason = 'FS'   THEN oe.duration_minutes END), 0) AS min_paro_fs,
    COALESCE(SUM(CASE WHEN oe.reason = 'BV'   THEN oe.duration_minutes END), 0) AS min_paro_bv,
    COALESCE(SUM(CASE WHEN oe.reason = 'FE'   THEN oe.duration_minutes END), 0) AS min_paro_fe,
    COALESCE(SUM(CASE WHEN oe.reason = 'FP'   THEN oe.duration_minutes END), 0) AS min_paro_fp,
    COALESCE(SUM(CASE WHEN oe.reason = 'LF'   THEN oe.duration_minutes END), 0) AS min_paro_lf,
    COALESCE(SUM(CASE WHEN oe.reason = 'MP'   THEN oe.duration_minutes END), 0) AS min_paro_mp,
    COALESCE(SUM(CASE WHEN oe.reason = 'PAP'  THEN oe.duration_minutes END), 0) AS min_paro_pap,
    COALESCE(SUM(CASE WHEN oe.reason = 'PAM'  THEN oe.duration_minutes END), 0) AS min_paro_pam,
    COALESCE(SUM(CASE WHEN oe.reason = 'CP'   THEN oe.duration_minutes END), 0) AS min_paro_cp,
    COALESCE(SUM(CASE WHEN oe.reason = 'AO'   THEN oe.duration_minutes END), 0) AS min_paro_ao,
    COALESCE(SUM(CASE WHEN oe.reason = 'MD'   THEN oe.duration_minutes END), 0) AS min_paro_md,
    -- OTROS: códigos no reconocidos O NULL
    COALESCE(SUM(CASE WHEN oe.reason IS NULL
                       OR oe.reason NOT IN ('AT','FC','FME','FS','BV','FE','FP','LF','MP','PAP','PAM','CP','AO','MD')
                      THEN oe.duration_minutes END), 0) AS min_paro_otros
  FROM public.oee_events oe
  GROUP BY oe.machine_id, date_trunc('hour', oe.started_at AT TIME ZONE 'America/Mexico_City')
),

-- ============================================================
-- CTE 5: telemetry_flag — Bandera de telemetría IoT
--   Simplemente EXISTS (vía GROUP BY) de registros en
--   telemetry_raw_staging por máquina-hora.
-- ============================================================
telemetry_flag AS (
  SELECT
    tr.machine_id,
    date_trunc('hour', tr.received_at AT TIME ZONE 'America/Mexico_City')::timestamp without time zone AS local_hour,
    TRUE  AS has_telemetry
  FROM public.telemetry_raw_staging tr
  GROUP BY tr.machine_id, date_trunc('hour', tr.received_at AT TIME ZONE 'America/Mexico_City')
),

-- ============================================================
-- CTE 6: data_sources — Clasificación de fuente de datos
--   FULL OUTER JOIN entre production (manual) y telemetry_flag (IoT)
--   para clasificar cada máquina-hora como:
--     'manual' → solo reports
--     'iot'    → solo telemetry
--     'hybrid' → ambas fuentes
--   Sin correlated subqueries — el planner usa Hash JOIN.
-- ============================================================
data_sources AS (
  SELECT
    COALESCE(p.machine_id, t.machine_id) AS machine_id,
    COALESCE(p.local_hour, t.local_hour) AS local_hour,
    CASE
      WHEN p.machine_id IS NOT NULL AND t.machine_id IS NOT NULL THEN 'hybrid'
      WHEN t.machine_id IS NOT NULL THEN 'iot'
      WHEN p.machine_id IS NOT NULL THEN 'manual'
      ELSE NULL
    END                              AS data_source,
    COALESCE(p.total_boxes, 0)       AS total_boxes,
    COALESCE(p.rejected_pieces, 0)   AS rejected_pieces
  FROM production p
  FULL OUTER JOIN telemetry_flag t
    ON p.machine_id = t.machine_id
   AND p.local_hour = t.local_hour
)

-- ============================================================
-- SELECT final — LEFT JOIN session_hours con datos
--   session_hours es el ancla LEFT: toda hora con turno aparece,
--   aunque no haya datos de producción/defectos/paros.
--   COALESCE en todas las columnas numéricas.
--   OEE se calcula inline respetando NULLs en división por cero.
-- ============================================================
SELECT
  -- ========== Dimensiones ==========
  (sh.local_hour AT TIME ZONE 'America/Mexico_City')  AS hora,
  sh.machine_code,
  sh.machine_name,
  sh.line_name,
  sh.shift_type,
  sh.product_code,
  sh.hourly_planned_boxes                              AS planned_boxes,

  -- ========== Producción ==========
  COALESCE(ds.total_boxes, 0)           AS total_boxes,
  COALESCE(ds.total_boxes, 0)
    - COALESCE(ds.rejected_pieces, 0)
    - COALESCE(df.defect_boxes, 0)      AS good_boxes,

  -- ========== Downtime total ==========
  COALESCE(dt.total_downtime_min, 0)    AS total_downtime_min,

  -- ========== OEE Components ==========
  -- availability_pct: proporción del tiempo que la máquina estuvo disponible
  (60.0 - COALESCE(dt.total_downtime_min, 0)) / 60.0
                                        AS availability_pct,

  -- performance_pct: velocidad real vs planeada (NULL si no hay meta)
  CASE
    WHEN COALESCE(sh.hourly_planned_boxes, 0) > 0
    THEN COALESCE(ds.total_boxes, 0)::NUMERIC / sh.hourly_planned_boxes
    ELSE NULL
  END                                   AS performance_pct,

  -- quality_pct: cajas buenas vs totales (NULL si no hay producción)
  CASE
    WHEN COALESCE(ds.total_boxes, 0) > 0
    THEN (COALESCE(ds.total_boxes, 0)
          - COALESCE(ds.rejected_pieces, 0)
          - COALESCE(df.defect_boxes, 0)
         )::NUMERIC / COALESCE(ds.total_boxes, 0)
    ELSE NULL
  END                                   AS quality_pct,

  -- oee_pct = availability × performance × quality (NULL si alguno es NULL)
  ((60.0 - COALESCE(dt.total_downtime_min, 0)) / 60.0)
  * CASE
      WHEN COALESCE(sh.hourly_planned_boxes, 0) > 0
      THEN COALESCE(ds.total_boxes, 0)::NUMERIC / sh.hourly_planned_boxes
      ELSE NULL
    END
  * CASE
      WHEN COALESCE(ds.total_boxes, 0) > 0
      THEN (COALESCE(ds.total_boxes, 0)
            - COALESCE(ds.rejected_pieces, 0)
            - COALESCE(df.defect_boxes, 0)
           )::NUMERIC / COALESCE(ds.total_boxes, 0)
      ELSE NULL
    END                                   AS oee_pct,

  -- ========== Causas de paro (15 + OTROS) ==========
  COALESCE(dt.min_paro_at, 0)            AS min_paro_at,
  COALESCE(dt.min_paro_fc, 0)            AS min_paro_fc,
  COALESCE(dt.min_paro_fme, 0)           AS min_paro_fme,
  COALESCE(dt.min_paro_fs, 0)            AS min_paro_fs,
  COALESCE(dt.min_paro_bv, 0)            AS min_paro_bv,
  COALESCE(dt.min_paro_fe, 0)            AS min_paro_fe,
  COALESCE(dt.min_paro_fp, 0)            AS min_paro_fp,
  COALESCE(dt.min_paro_lf, 0)            AS min_paro_lf,
  COALESCE(dt.min_paro_mp, 0)            AS min_paro_mp,
  COALESCE(dt.min_paro_pap, 0)           AS min_paro_pap,
  COALESCE(dt.min_paro_pam, 0)           AS min_paro_pam,
  COALESCE(dt.min_paro_cp, 0)            AS min_paro_cp,
  COALESCE(dt.min_paro_ao, 0)            AS min_paro_ao,
  COALESCE(dt.min_paro_md, 0)            AS min_paro_md,
  COALESCE(dt.min_paro_otros, 0)         AS min_paro_otros,

  -- ========== Metadatos ==========
  COALESCE(ds.data_source, 'manual')     AS data_source,
  sh.operator_name

FROM session_hours sh
LEFT JOIN data_sources ds
  ON ds.machine_id = sh.machine_id
 AND ds.local_hour = sh.local_hour
LEFT JOIN defects df
  ON df.machine_id = sh.machine_id
 AND df.local_hour = sh.local_hour
LEFT JOIN downtime dt
  ON dt.machine_id = sh.machine_id
 AND dt.local_hour = sh.local_hour;

COMMENT ON VIEW public.view_oee_hr_x_hr IS
  'OEE Hora × Hora — una fila por máquina×hora×turno con disponibilidad, rendimiento, calidad y 15+ causas de paro';
