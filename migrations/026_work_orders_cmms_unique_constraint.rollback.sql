-- Rollback: 026_work_orders_cmms_unique_constraint
-- Revierte la restricción UNIQUE sobre cmms_wo_id

ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_cmms_wo_id_key;
