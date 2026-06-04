-- VIEW: view_quality_defects_by_shift — Defectos de Calidad por Turno
--
-- Propósito:
--   Exponer una fila por máquina × turno × día con métricas consolidadas
--   de calidad: total de inspecciones, defectos por severidad (critical/major/minor),
--   porcentaje de calidad, top 3 tipos de defecto, fuente de datos y tipo de inspector.
--   Es la fuente única de verdad para dashboards Power BI del módulo de calidad.
--
-- Dependencias:
--   public.quality_inspections, public.machines, public.lines, public.defect_logs
--
-- Diseño:
--   3 CTEs + SELECT final con LEFT JOIN + COALESCE para tolerancia a
--   inspecciones sin defectos. La alineación temporal usa AT TIME ZONE
--   'America/Mexico_City' en toda la VIEW.
--
-- Columnas:
--   fecha                  — Día natural en CDMX (sin timezone)
--   shift_type             — matutino / vespertino / nocturno
--   machine_code           — Código de máquina
--   machine_name           — Nombre de máquina
--   line_name              — Nombre de línea
--   total_inspections      — Conteo de inspecciones en el grupo
--   total_passed           — Inspecciones con disposition = 'liberado'
--   total_failed           — Inspecciones con disposition = 'rechazado'
--   total_rework           — Inspecciones con disposition = 'reproceso'
--   critical_defects       — Suma de defectos con severidad 'critical'
--   major_defects          — Suma de defectos con severidad 'major'
--   minor_defects          — Suma de defectos con severidad 'minor'
--   calidad_pct            — Proporción de liberados sobre total (NULL si 0)
--   data_source            — Fuente: vision / manual / hybrid (consolidado)
--   inspector_type_summary — Tipo: ai / human / both (consolidado)
--   top_defect_type_1      — Tipo de defecto más frecuente en el grupo
--   top_defect_type_2      — Segundo tipo de defecto más frecuente
--   top_defect_type_3      — Tercer tipo de defecto más frecuente
--
-- Nota: Se usa LEFT JOIN para defects_summary y top_defects de modo que
--   inspecciones sin defectos registrados aún aparezcan con valores 0.
--
-- Historial:
--   2026-05-24 - Creación inicial

CREATE OR REPLACE VIEW public.view_quality_defects_by_shift AS
WITH

-- ============================================================
-- CTE 1: base_inspections — Inspecciones con datos descriptivos
--   JOINea quality_inspections → machines → lines para obtener
--   machine_code, machine_name, line_name. Convierte created_at
--   a timezone CDMX y trunca a día para agrupación.
-- ============================================================
base_inspections AS (
  SELECT
    qi.id                                    AS inspection_id,
    qi.machine_id,
    m.code                                   AS machine_code,
    m.name                                   AS machine_name,
    l.name                                   AS line_name,
    qi.shift_type,
    qi.data_source,
    qi.inspector_type,
    qi.disposition,
    date_trunc('day', qi.created_at AT TIME ZONE 'America/Mexico_City')::timestamp without time zone AS fecha
  FROM public.quality_inspections qi
  JOIN public.machines m ON m.id = qi.machine_id
  JOIN public.lines l ON l.id = m.line_id
),

-- ============================================================
-- CTE 2: defects_summary — Defectos agregados por inspección
--   Agrupa defect_logs por inspection_id y pivota severidad
--   usando FILTER con COALESCE para garantizar 0 cuando no hay
--   defectos de esa severidad.
-- ============================================================
defects_summary AS (
  SELECT
    dl.inspection_id,
    COALESCE(SUM(dl.defect_count) FILTER (WHERE dl.severity = 'critical'), 0) AS critical_defects,
    COALESCE(SUM(dl.defect_count) FILTER (WHERE dl.severity = 'major'), 0)    AS major_defects,
    COALESCE(SUM(dl.defect_count) FILTER (WHERE dl.severity = 'minor'), 0)    AS minor_defects,
    COALESCE(SUM(dl.defect_count), 0)                                         AS total_defects
  FROM public.defect_logs dl
  GROUP BY dl.inspection_id
),

-- ============================================================
-- CTE 3: top_defects — Top 3 tipos de defecto por máquina×turno×día
--   Usa ROW_NUMBER para rankear tipos de defecto por frecuencia
--   dentro de cada grupo (machine_id, shift_type, fecha). Pivota
--   los 3 primeros como columnas separadas.
--   Se JOINea con defect_logs (INNER) porque solo tiene sentido
--   cuando hay defectos.
-- ============================================================
top_defects AS (
  SELECT
    machine_id,
    shift_type,
    inspection_date,
    MAX(CASE WHEN rn = 1 THEN defect_type END) AS top_defect_type_1,
    MAX(CASE WHEN rn = 2 THEN defect_type END) AS top_defect_type_2,
    MAX(CASE WHEN rn = 3 THEN defect_type END) AS top_defect_type_3
  FROM (
    SELECT
      qi.machine_id,
      qi.shift_type,
      date_trunc('day', qi.created_at AT TIME ZONE 'America/Mexico_City')::timestamp without time zone AS inspection_date,
      dl.defect_type,
      SUM(dl.defect_count) AS total_count,
      ROW_NUMBER() OVER (
        PARTITION BY qi.machine_id, qi.shift_type,
                     date_trunc('day', qi.created_at AT TIME ZONE 'America/Mexico_City')
        ORDER BY SUM(dl.defect_count) DESC
      ) AS rn
    FROM public.quality_inspections qi
    JOIN public.defect_logs dl ON dl.inspection_id = qi.id
    GROUP BY qi.machine_id, qi.shift_type,
             date_trunc('day', qi.created_at AT TIME ZONE 'America/Mexico_City'),
             dl.defect_type
  ) ranked
  WHERE rn <= 3
  GROUP BY machine_id, shift_type, inspection_date
)

-- ============================================================
-- SELECT final — Agrupa por día × turno × máquina
--   base_inspections es el ancla: toda inspección aparece.
--   LEFT JOIN defects_summary para tolerar inspecciones sin
--   defect_logs. LEFT JOIN top_defects para top 3 por grupo.
--   COALESCE en columnas numéricas de defectos.
--   calidad_pct = liberados / total, NULL si total = 0.
--   data_source = 'hybrid' si hay múltiples fuentes en el grupo.
--   inspector_type_summary = 'both' si hay ai y human.
-- ============================================================
SELECT
  bi.fecha,
  bi.shift_type,
  bi.machine_code,
  bi.machine_name,
  bi.line_name,

  -- ========== Inspecciones ==========
  COUNT(*)                                                  AS total_inspections,
  COUNT(*) FILTER (WHERE bi.disposition = 'liberado')       AS total_passed,
  COUNT(*) FILTER (WHERE bi.disposition = 'rechazado')      AS total_failed,
  COUNT(*) FILTER (WHERE bi.disposition = 'reproceso')      AS total_rework,

  -- ========== Defectos por severidad ==========
  COALESCE(SUM(ds.critical_defects), 0)                     AS critical_defects,
  COALESCE(SUM(ds.major_defects), 0)                        AS major_defects,
  COALESCE(SUM(ds.minor_defects), 0)                        AS minor_defects,

  -- ========== Calidad (%) ==========
  CASE
    WHEN COUNT(*) > 0
    THEN (COUNT(*) FILTER (WHERE bi.disposition = 'liberado'))::NUMERIC / COUNT(*)
    ELSE NULL
  END                                                       AS calidad_pct,

  -- ========== Fuente de datos consolidada ==========
  CASE
    WHEN COUNT(DISTINCT bi.data_source) > 1 THEN 'hybrid'
    ELSE MAX(bi.data_source)
  END                                                       AS data_source,

  -- ========== Tipo de inspector consolidado ==========
  CASE
    WHEN COUNT(DISTINCT bi.inspector_type) > 1 THEN 'both'
    ELSE MAX(bi.inspector_type)
  END                                                       AS inspector_type_summary,

  -- ========== Top 3 defectos ==========
  MAX(td.top_defect_type_1)                                 AS top_defect_type_1,
  MAX(td.top_defect_type_2)                                 AS top_defect_type_2,
  MAX(td.top_defect_type_3)                                 AS top_defect_type_3

FROM base_inspections bi
LEFT JOIN defects_summary ds ON ds.inspection_id = bi.inspection_id
LEFT JOIN top_defects td
  ON td.machine_id = bi.machine_id
 AND td.shift_type = bi.shift_type
 AND td.inspection_date = bi.fecha
GROUP BY
  bi.fecha,
  bi.shift_type,
  bi.machine_code,
  bi.machine_name,
  bi.line_name
ORDER BY
  bi.fecha,
  bi.machine_code,
  bi.shift_type;

COMMENT ON VIEW public.view_quality_defects_by_shift IS
  'Defectos de Calidad por Turno — una fila por máquina×turno×día con total de inspecciones, defectos por severidad (critical/major/minor), top 3 defectos, calidad_pct, fuente de datos y tipo de inspector';
