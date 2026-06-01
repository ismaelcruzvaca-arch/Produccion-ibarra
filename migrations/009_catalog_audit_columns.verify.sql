-- Verify: 009_catalog_audit_columns
-- Checks that all catalog tables have the expected 3 audit columns.
-- Returns rows for any table where a column is MISSING or has the wrong type.

WITH expected AS (
  SELECT unnest(ARRAY['stop_reasons', 'products', 'shifts', 'lines', 'machines']) AS table_name
),
columns_to_check AS (
  SELECT
    pc.relname AS table_name,
    pa.attname AS column_name,
    pg_catalog.format_type(pa.atttypid, pa.atttypmod) AS data_type
  FROM pg_catalog.pg_class pc
  JOIN pg_catalog.pg_namespace pn ON pn.oid = pc.relnamespace
  JOIN pg_catalog.pg_attribute pa ON pa.attrelid = pc.oid
  WHERE pn.nspname = 'public'
    AND pc.relname IN ('stop_reasons', 'products', 'shifts', 'lines', 'machines')
    AND pa.attnum > 0
    AND NOT pa.attisdropped
    AND pa.attname IN ('created_at', 'updated_at', 'updated_by')
)
SELECT
  e.table_name,
  c.column_name,
  c.data_type,
  CASE
    WHEN c.column_name IS NULL THEN 'MISSING'
    WHEN c.column_name = 'updated_by' AND c.data_type != 'uuid' THEN 'WRONG_TYPE'
    WHEN c.column_name IN ('created_at', 'updated_at') AND c.data_type != 'timestamp with time zone' THEN 'WRONG_TYPE'
    ELSE 'OK'
  END AS status
FROM expected e
LEFT JOIN columns_to_check c ON c.table_name = e.table_name
ORDER BY e.table_name, c.column_name;

-- Expected result: 15 rows, all status = 'OK' (5 tables × 3 columns)
