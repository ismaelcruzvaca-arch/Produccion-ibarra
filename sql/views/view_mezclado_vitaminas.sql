-- VIEW: view_mezclado_vitaminas — Mezclado de Vitaminas (F-PD-06)
--
-- Propósito:
--   Digitalizar el formato F-PD-06 — control de mezclado de micro-ingredientes
--   (vitaminas, lecitina, fécula, maltodextrina, cocoa). Exponer una fila por batch
--   con ingredientes pivotados, pesos (báscula vs físico), doble firma de verificación,
--   trazabilidad de lotes, e inventario de kits.
--
-- Dependencias:
--   public.vitaminas_batches, public.vitaminas_ingredients,
--   public.vitaminas_kit_inventory, public.machines, public.lines,
--   public.operators
--
-- Diseño:
--   4 CTEs + SELECT final con LEFT JOIN + COALESCE para tolerancia a
--   datos faltantes. La alineación temporal usa AT TIME ZONE
--   'America/Mexico_City' en toda la VIEW.
--
-- CTEs:
--   batches           — JOIN vitaminas_batches → machines → lines → operators
--   ingredients_pivot — GROUP BY batch_id, SUM FILTER para cada micro-ingrediente
--   inventory         — Inventario de kits desde vitaminas_kit_inventory
--   SELECT final      — LEFT JOIN batches + ingredients + inventory
--
-- Columnas (28+):
--   fecha, shift_type, machine_code, machine_name, line_name, operator_name,
--   batch_number, product_name, product_formula,
--   peso_bascula, peso_fisico,
--   6 ingredientes pivotados (azucar_kg .. reproceso_kg),
--   kit_numero, kit_kg, semi_terminado_kg,
--   verificador_produccion, verificador_calidad,
--   4 inventario (inv_inicial .. inv_final),
--   data_source, status
--
-- Nota:
--   data_source se obtiene de COALESCE(batches.data_source, 'manual').
--   Los lotes se agrupan por tipo de ingrediente (cada tipo tiene LOTE 1 y LOTE 2).
--   El lot_number en la VIEW es el primer lote encontrado del ingrediente de
--   mayor prioridad de negocio.
--
-- Historial:
--   2026-05-24 - Creación inicial

CREATE OR REPLACE VIEW public.view_mezclado_vitaminas AS
WITH

-- ============================================================
-- CTE 1: batches — Cabecera de batch con datos descriptivos
--   JOINea vitaminas_batches → machines → lines → operators para
--   obtener machine_code, machine_name, line_name, operator_name.
--   Convierte created_at a timezone CDMX y extrae fecha (DATE).
-- ============================================================
batches AS (
  SELECT
    vb.id,
    vb.machine_id,
    m.code                                   AS machine_code,
    m.name                                   AS machine_name,
    l.name                                   AS line_name,
    op.full_name                             AS operator_name,
    vb.shift_type,
    vb.batch_number,
    vb.product_name,
    vb.product_formula,
    vb.peso_bascula,
    vb.peso_fisico,
    vb.kit_numero,
    vb.kit_kg,
    vb.semi_terminado_kg,
    vb.verificador_produccion,
    vb.verificador_calidad,
    vb.status,
    vb.data_source,
    vb.created_at,
    date_trunc('day', vb.created_at AT TIME ZONE 'America/Mexico_City')::date AS fecha
  FROM public.vitaminas_batches vb
  JOIN public.machines m ON m.id = vb.machine_id
  JOIN public.lines l ON l.id = m.line_id
  LEFT JOIN public.operators op ON op.id = vb.operator_id
),

-- ============================================================
-- CTE 2: ingredients_pivot — Pivot de micro-ingredientes por batch
--   Agrupa vitaminas_ingredients por batch_id y pivota cada
--   ingredient_type como columna separada usando SUM FILTER.
--   COALESCE con NULL para que un ingrediente ausente se muestre
--   como NULL (no 0). El lot_number se deriva del ingrediente de
--   mayor prioridad usando COALESCE anidado con FILTER por
--   orden de prioridad: azúcar > cocoa > lecitina > fécula >
--   maltodextrina > reproceso.
-- ============================================================
ingredients_pivot AS (
  SELECT
    vi.batch_id,

    -- Kilogramos por tipo de micro-ingrediente (NULL cuando no presente)
    SUM(vi.kg) FILTER (WHERE vi.ingredient_type = 'azucar')        AS azucar_kg,
    SUM(vi.kg) FILTER (WHERE vi.ingredient_type = 'cocoa')         AS cocoa_kg,
    SUM(vi.kg) FILTER (WHERE vi.ingredient_type = 'lecitina')      AS lecitina_kg,
    SUM(vi.kg) FILTER (WHERE vi.ingredient_type = 'fecula')        AS fecula_kg,
    SUM(vi.kg) FILTER (WHERE vi.ingredient_type = 'maltodextrina') AS maltodextrina_kg,
    SUM(vi.kg) FILTER (WHERE vi.ingredient_type = 'reproceso')     AS reproceso_kg,

    -- Trazabilidad: lote del ingrediente de mayor prioridad
    COALESCE(
      MAX(vi.lot_number) FILTER (WHERE vi.ingredient_type = 'azucar'),
      MAX(vi.lot_number) FILTER (WHERE vi.ingredient_type = 'cocoa'),
      MAX(vi.lot_number) FILTER (WHERE vi.ingredient_type = 'lecitina'),
      MAX(vi.lot_number) FILTER (WHERE vi.ingredient_type = 'fecula'),
      MAX(vi.lot_number) FILTER (WHERE vi.ingredient_type = 'maltodextrina'),
      MAX(vi.lot_number) FILTER (WHERE vi.ingredient_type = 'reproceso')
    )                                                              AS lot_number

  FROM public.vitaminas_ingredients vi
  GROUP BY vi.batch_id
),

-- ============================================================
-- CTE 3: inventory — Inventario de kits por turno
--   Expone vitaminas_kit_inventory como CTE para mantener
--   consistencia y LEFT JOINear en el SELECT final.
-- ============================================================
inventory AS (
  SELECT
    ki.machine_id,
    ki.shift_type,
    ki.fecha,
    ki.product_name,
    ki.inv_inicial,
    ki.recibidos,
    ki.consumo,
    ki.inv_final
  FROM public.vitaminas_kit_inventory ki
)

-- ============================================================
-- SELECT final — batches LEFT JOIN ingredients + inventory
--   batches es el ancla LEFT: todo batch aparece aunque no tenga
--   ingredientes o inventario.
--   inventory se alinea por machine_id + shift_type + fecha + product_name.
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
  b.product_name                                   AS product_name,
  b.product_formula                                AS product_formula,

  -- ========== Pesos ==========
  b.peso_bascula                                   AS peso_bascula,
  b.peso_fisico                                    AS peso_fisico,

  -- ========== Micro-ingredientes pivotados ==========
  ip.azucar_kg                                     AS azucar_kg,
  ip.cocoa_kg                                      AS cocoa_kg,
  ip.lecitina_kg                                   AS lecitina_kg,
  ip.fecula_kg                                     AS fecula_kg,
  ip.maltodextrina_kg                              AS maltodextrina_kg,
  ip.reproceso_kg                                  AS reproceso_kg,

  -- ========== Kit y semi-terminado ==========
  b.kit_numero                                     AS kit_numero,
  b.kit_kg                                         AS kit_kg,
  b.semi_terminado_kg                              AS semi_terminado_kg,

  -- ========== Trazabilidad ==========
  ip.lot_number                                    AS lot_number,

  -- ========== Doble firma ==========
  b.verificador_produccion                         AS verificador_produccion,
  b.verificador_calidad                            AS verificador_calidad,

  -- ========== Inventario de kits ==========
  i.inv_inicial                                    AS inv_inicial,
  i.recibidos                                      AS recibidos,
  i.consumo                                        AS consumo,
  i.inv_final                                      AS inv_final,

  -- ========== Metadatos ==========
  COALESCE(b.data_source, 'manual')                AS data_source,
  b.status                                         AS status

FROM batches b
LEFT JOIN ingredients_pivot ip ON ip.batch_id = b.id
LEFT JOIN inventory i
  ON i.machine_id = b.machine_id
 AND i.shift_type = b.shift_type
 AND i.fecha = b.fecha
 AND i.product_name = b.product_name
ORDER BY
  b.fecha,
  b.machine_code,
  b.shift_type,
  b.batch_number;

-- ============================================================
-- Comentarios de VIEW y COLUMNAS
-- ============================================================

COMMENT ON VIEW public.view_mezclado_vitaminas IS
  'Mezclado de Vitaminas (F-PD-06) — una fila por batch con ingredientes pivotados, doble firma, inventario de kits';

COMMENT ON COLUMN public.view_mezclado_vitaminas.fecha IS
  'Fecha del batch en CDMX (día natural)';

COMMENT ON COLUMN public.view_mezclado_vitaminas.shift_type IS
  'Tipo de turno: matutino, vespertino, nocturno';

COMMENT ON COLUMN public.view_mezclado_vitaminas.machine_code IS
  'Código de máquina';

COMMENT ON COLUMN public.view_mezclado_vitaminas.machine_name IS
  'Nombre de máquina';

COMMENT ON COLUMN public.view_mezclado_vitaminas.line_name IS
  'Nombre de línea de producción';

COMMENT ON COLUMN public.view_mezclado_vitaminas.operator_name IS
  'Nombre completo del operador responsable';

COMMENT ON COLUMN public.view_mezclado_vitaminas.batch_number IS
  'Número de batch dentro del turno (1-20)';

COMMENT ON COLUMN public.view_mezclado_vitaminas.product_name IS
  'Nombre del producto (Choco choco, Aurrera, Canelate, Chedraui, etc.)';

COMMENT ON COLUMN public.view_mezclado_vitaminas.product_formula IS
  'Fórmula del producto: R1, R2, Aurrera, Canelate, Chedraui, etc.';

COMMENT ON COLUMN public.view_mezclado_vitaminas.peso_bascula IS
  'Peso registrado por la báscula (IoT si conectada, manual como fallback)';

COMMENT ON COLUMN public.view_mezclado_vitaminas.peso_fisico IS
  'Peso físico verificado manualmente';

COMMENT ON COLUMN public.view_mezclado_vitaminas.azucar_kg IS
  'Kilogramos de azúcar en el batch (NULL si no presente)';

COMMENT ON COLUMN public.view_mezclado_vitaminas.cocoa_kg IS
  'Kilogramos de cocoa en el batch (NULL si no presente)';

COMMENT ON COLUMN public.view_mezclado_vitaminas.lecitina_kg IS
  'Kilogramos de lecitina en el batch (NULL si no presente)';

COMMENT ON COLUMN public.view_mezclado_vitaminas.fecula_kg IS
  'Kilogramos de fécula en el batch (NULL si no presente)';

COMMENT ON COLUMN public.view_mezclado_vitaminas.maltodextrina_kg IS
  'Kilogramos de maltodextrina en el batch (NULL si no presente)';

COMMENT ON COLUMN public.view_mezclado_vitaminas.reproceso_kg IS
  'Kilogramos de reproceso en el batch (NULL si no presente)';

COMMENT ON COLUMN public.view_mezclado_vitaminas.kit_numero IS
  'Número de kit (# Orden + # Kit)';

COMMENT ON COLUMN public.view_mezclado_vitaminas.kit_kg IS
  'Kilogramos del kit';

COMMENT ON COLUMN public.view_mezclado_vitaminas.semi_terminado_kg IS
  'Kilogramos de semi-terminado generados';

COMMENT ON COLUMN public.view_mezclado_vitaminas.lot_number IS
  'Número de lote del ingrediente con mayor prioridad de negocio (azúcar > cocoa > lecitina > fécula > maltodextrina > reproceso)';

COMMENT ON COLUMN public.view_mezclado_vitaminas.verificador_produccion IS
  'Verificador de producción (doble firma calidad-producción)';

COMMENT ON COLUMN public.view_mezclado_vitaminas.verificador_calidad IS
  'Verificador de calidad (doble firma calidad-producción)';

COMMENT ON COLUMN public.view_mezclado_vitaminas.inv_inicial IS
  'Inventario inicial de kits al inicio del turno';

COMMENT ON COLUMN public.view_mezclado_vitaminas.recibidos IS
  'Kits recibidos durante el turno';

COMMENT ON COLUMN public.view_mezclado_vitaminas.consumo IS
  'Kits consumidos durante el turno';

COMMENT ON COLUMN public.view_mezclado_vitaminas.inv_final IS
  'Inventario final de kits al cierre del turno';

COMMENT ON COLUMN public.view_mezclado_vitaminas.data_source IS
  'Fuente de datos: manual (captura operador), iot (báscula conectada), hybrid (ambos)';

COMMENT ON COLUMN public.view_mezclado_vitaminas.status IS
  'Estado del batch: pending, in_progress, completed, rejected';
