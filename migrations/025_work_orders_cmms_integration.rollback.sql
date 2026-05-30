-- Rollback: 025_work_orders_cmms_integration
-- Revierte las columnas de integración con cmms-ibero en work_orders

DROP INDEX IF EXISTS idx_work_orders_cmms_wo_id;

ALTER TABLE work_orders DROP COLUMN IF EXISTS cmms_wo_id;
ALTER TABLE work_orders DROP COLUMN IF EXISTS completed_at;
ALTER TABLE work_orders DROP COLUMN IF EXISTS actual_start_at;
ALTER TABLE work_orders DROP COLUMN IF EXISTS action_note;
ALTER TABLE work_orders DROP COLUMN IF EXISTS cause_note;
ALTER TABLE work_orders DROP COLUMN IF EXISTS symptom_note;
ALTER TABLE work_orders DROP COLUMN IF EXISTS lifecycle_phase;
