/**
 * RxDB JSON schemas for all collections.
 *
 * Pattern: Schema Definition
 * Why: RxDB requires explicit JSON schemas for validation and indexing.
 * Each schema follows the same structure:
 *   - version: 0 (initial schema, no migrations needed)
 *   - primaryKey: 'id' (UUID v4, set by the repository before insert)
 *   - required: ['id', 'client_updated_at', 'deleted'] — IBaseDocument fields
 *   - properties: typed fields matching the TypeScript interfaces
 *
 * These schemas are used by both local storage (Dexie/SQLite) and the
 * replication layer to validate document structure.
 */

import type { RxJsonSchema } from 'rxdb';
import type {
  IAsset, IAssetType, IWorkOrder, IReport, IOeeEvent, ISyncError,
  IQualityInspection, IDefectLog, IWeightLog, IShiftSession, IOperator,
  IProductWeightStandard,
  IDowntimeConciliation, IPlantConfig, IShiftSummary,
} from '../core/types';

/**
 * Asset collection schema.
 * Indexes: none defined yet — add performance indexes as needed (e.g., status, type_id).
 */
export const assetSchema: RxJsonSchema<IAsset> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'client_updated_at', 'is_deleted'],
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    type_id: { type: 'string' },
    status: { type: 'string', enum: ['active', 'maintenance', 'retired'] },
    location: { type: 'string' },
    serial_number: { type: 'string' },
    manufacturer: { type: 'string' },
    model_number: { type: 'string' },
    in_service_date: { type: 'number' },
    warranty_expiration: { type: 'number' },
    client_updated_at: { type: 'number' },
    is_deleted: { type: 'boolean' },
  },
  indexes: [],
};

/**
 * Asset Type catalog schema.
 * Used to categorize assets (e.g., HVAC, Electrical, Plumbing).
 */
export const assetTypeSchema: RxJsonSchema<IAssetType> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'client_updated_at', 'is_deleted'],
  properties: {
    id: { type: 'string', maxLength: 100 },
    code: { type: 'string' },
    description: { type: 'string' },
    is_active: { type: 'boolean' },
    client_updated_at: { type: 'number' },
    is_deleted: { type: 'boolean' },
  },
  indexes: [],
};

/**
 * Work Order schema.
 * Represents a maintenance/repair task assigned to an asset.
 * 
 * v1: Added lifecycle_phase, symptom_note, cause_note, action_note,
 *     actual_start_at, cmms_wo_id (wo-lifecycle-outbox integration).
 */
export const workOrderSchema: RxJsonSchema<IWorkOrder> = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'client_updated_at', 'is_deleted'],
  properties: {
    id: { type: 'string', maxLength: 100 },
    equipment_id: { type: 'string' },
    description: { type: 'string' },
    status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] },
    priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
    assigned_to: { type: 'string' },
    scheduled_date: { type: 'number' },
    completed_date: { type: 'number' },
    client_updated_at: { type: 'number' },
    is_deleted: { type: 'boolean' },

    // wo-lifecycle-outbox v1: campos desde cmms-ibero
    lifecycle_phase: { type: 'string' },
    symptom_note: { type: 'string' },
    cause_note: { type: 'string' },
    action_note: { type: 'string' },
    actual_start_at: { type: 'number' },
    cmms_wo_id: { type: 'string' },
  },
  indexes: [],
};

/**
 * Migration strategy for work_orders v0 → v1.
 * Adds default values for new optional fields (all undefined = safe).
 */
export const workOrderSchemaMigrationStrategy = (oldDoc: Record<string, unknown>) => ({
  ...oldDoc,
  lifecycle_phase: undefined,
  symptom_note: undefined,
  cause_note: undefined,
  action_note: undefined,
  actual_start_at: undefined,
  cmms_wo_id: undefined,
});

/**
 * Report collection schema.
 * Uses `updated_at` (not `client_updated_at`) per the new data contract.
 * The `data` field is a flexible object for template-specific payloads.
 */
export const reportSchema: RxJsonSchema<IReport> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'updated_at', 'is_deleted', 'template_id', 'data'],
  properties: {
    id: { type: 'string', maxLength: 100 },
    updated_at: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    is_deleted: { type: 'boolean' },
    template_id: { type: 'string' },
    data: {
      type: 'object',
      properties: {
        line_id: { type: 'string' },
        total_pieces: { type: 'number' },
        rejected_pieces: { type: 'number' },
        downtime_minutes: { type: 'number' },
      },
    },
  },
  indexes: ['updated_at'],
};

/**
 * OEE Event collection schema.
 * Uses `updated_at` (not `client_updated_at`) per the new data contract.
 * Indexes: timestamp, [line_id, timestamp], [shift_id, timestamp] for performance.
 */
export const oeeEventSchema: RxJsonSchema<IOeeEvent> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'updated_at', 'is_deleted', 'line_id', 'machine_id', 'shift_id', 'event_type', 'timestamp', 'device_id'],
  properties: {
    id:               { type: 'string', maxLength: 100 },
    updated_at:       { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    is_deleted:       { type: 'boolean' },
    line_id:          { type: 'string', maxLength: 100 },
    machine_id:       { type: 'string' },
    operator_id:      { type: 'string' },
    shift_id:         { type: 'string', maxLength: 100 },
    event_type:       { type: 'string', enum: ['shift_start','shift_end','downtime_start','downtime_end','box_count','reject_count'] },
    timestamp:        { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    reason_code:      { type: 'string' },
    quantity:         { type: 'number' },
    planned_boxes:    { type: 'number' },
    notes:            { type: 'string' },
    is_retroactive:   { type: 'boolean' },
    related_event_id: { type: 'string' },
    device_id:        { type: 'string' },
  },
  indexes: ['timestamp', ['line_id', 'timestamp'], ['shift_id', 'timestamp']],
};

/**
 * Sync Error collection schema (dead-letter queue).
 * Stores events that failed server-side validation during push.
 */
export const syncErrorSchema: RxJsonSchema<ISyncError> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'id_evento', 'payload_original', 'mensaje_error', 'fecha'],
  properties: {
    id:               { type: 'string', maxLength: 100 },
    id_evento:        { type: 'string', maxLength: 100 },
    payload_original: { type: 'object' },
    mensaje_error:    { type: 'string' },
    fecha:            { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
  },
  indexes: ['id_evento', 'fecha'],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 3: New Collections — Quality, Shifts, Operators
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Quality Inspection schema.
 * Matches Hasura production schema: inspector_id, disposition, shift_type, data_source.
 *
 * Indexes: machine_id, shift_type for filtering.
 */
export const qualityInspectionSchema: RxJsonSchema<IQualityInspection> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'machine_id', 'inspector_id', 'shift_type', 'disposition', 'data_source', 'updated_at', 'device_id', 'is_deleted'],
  properties: {
    id:           { type: 'string', maxLength: 100 },
    machine_id:   { type: 'string', maxLength: 100 },
    inspector_id: { type: 'string', maxLength: 100 },
    shift_type:   { type: 'string', enum: ['matutino', 'vespertino', 'nocturno'] },
    disposition:  { type: 'string', enum: ['pending', 'liberado', 'rechazado', 'reproceso'] },
    notes:        { type: 'string' },
    data_source:  { type: 'string', enum: ['vision', 'manual', 'hybrid'] },
    updated_at:   { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    device_id:    { type: 'string' },
    is_deleted:   { type: 'boolean' },
  },
  indexes: ['machine_id', 'shift_type'],
};

/**
 * Defect Log schema — 1:N child of quality_inspections.
 * Free-text defect_type (no catalog lookup), with severity classification.
 */
export const defectLogSchema: RxJsonSchema<IDefectLog> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'inspection_id', 'severity', 'defect_type', 'defect_count', 'updated_at', 'device_id', 'is_deleted'],
  properties: {
    id:            { type: 'string', maxLength: 100 },
    inspection_id: { type: 'string', maxLength: 100 },
    severity:      { type: 'string', enum: ['critical', 'major', 'minor'] },
    defect_type:   { type: 'string' },
    defect_count:  { type: 'number' },
    updated_at:    { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    device_id:     { type: 'string' },
    is_deleted:    { type: 'boolean' },
  },
  indexes: ['inspection_id'],
};

/**
 * Weight Log schema — 1:N child of quality_inspections.
 * Individual weight measurement per inspection.
 */
export const weightLogSchema: RxJsonSchema<IWeightLog> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'inspection_id', 'measured_weight', 'updated_at', 'device_id', 'is_deleted'],
  properties: {
    id:             { type: 'string', maxLength: 100 },
    inspection_id:  { type: 'string', maxLength: 100 },
    measured_weight:{ type: 'number' },
    updated_at:     { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    device_id:      { type: 'string' },
    is_deleted:     { type: 'boolean' },
  },
  indexes: ['inspection_id'],
};

/**
 * Shift Session schema.
 * Matches Hasura: shift_type (string), started_at/ended_at, planned_boxes, product_code.
 * No more line_id, supervisor_id, notes.
 */
export const shiftSessionSchema: RxJsonSchema<IShiftSession> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'machine_id', 'operator_id', 'shift_type', 'status', 'started_at', 'updated_at', 'device_id', 'is_deleted'],
  properties: {
    id:           { type: 'string', maxLength: 100 },
    machine_id:   { type: 'string', maxLength: 100 },
    operator_id:  { type: 'string', maxLength: 100 },
    shift_type:   { type: 'string', enum: ['matutino', 'vespertino', 'nocturno'] },
    status:       { type: 'string', enum: ['active', 'closed'] },
    started_at:   { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    ended_at:     { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    planned_boxes:{ type: 'number' },
    product_code: { type: 'string' },
    updated_at:   { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    device_id:    { type: 'string' },
    is_deleted:   { type: 'boolean' },
  },
  indexes: ['started_at', 'status'],
};

/**
 * Operator schema.
 * Matches Hasura: id IS the Epicor payroll code, full_name, is_active.
 * No more employee_code, role.
 */
export const operatorSchema: RxJsonSchema<IOperator> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'full_name', 'is_active', 'updated_at', 'device_id', 'is_deleted'],
  properties: {
    id:         { type: 'string', maxLength: 100 },
    full_name:  { type: 'string' },
    is_active:  { type: 'boolean' },
    updated_at: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    device_id:  { type: 'string' },
    is_deleted: { type: 'boolean' },
  },
  indexes: [],
};

/**
 * Product Weight Standard schema (offline FK validation cache).
 * Primary key is `sku` (natural key from Epicor), not UUID.
 * Pull-only from Hasura (reference data, never created on device).
 */
export const productWeightStandardSchema: RxJsonSchema<IProductWeightStandard> = {
  version: 0,
  primaryKey: 'sku',
  type: 'object',
  required: ['sku', 'name', 'lower_limit', 'upper_limit', 'requires_tare', 'updated_at', 'device_id', 'is_deleted'],
  properties: {
    sku:          { type: 'string', maxLength: 100 },
    name:         { type: 'string' },
    lower_limit:  { type: 'number' },
    upper_limit:  { type: 'number' },
    requires_tare:{ type: 'boolean' },
    updated_at:   { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    device_id:    { type: 'string' },
    is_deleted:   { type: 'boolean' },
  },
  indexes: ['sku'],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Downtime Conciliation — Phase: downtime-conciliation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Downtime Conciliation schema.
 * Links oee_events with maintenance diagnosis and OT trigger.
 *
 * Indexes: status, machine_id, shift_session_id for filtering.
 */
export const downtimeConciliationSchema: RxJsonSchema<IDowntimeConciliation> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  required: [
    'id', 'oee_event_id', 'machine_id', 'reason_code', 'status',
    'conciliated', 'ot_sent', 'is_mtto',
    'updated_at', 'device_id', 'is_deleted',
  ],
  properties: {
    id:                { type: 'string', maxLength: 100 },
    oee_event_id:      { type: 'string', maxLength: 100 },
    shift_session_id:  { type: 'string', maxLength: 100 },
    machine_id:        { type: 'string', maxLength: 100 },
    reason_code:       { type: 'string' },
    duration_min:      { type: 'number' },

    diagnosed_code:    { type: 'string' },
    diagnosed_by:      { type: 'string' },
    diagnosed_at:      { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },

    conciliated:       { type: 'boolean' },
    conciliated_code:  { type: 'string' },
    conciliated_macro: { type: 'string' },
    conciliated_by_prod: { type: 'string' },
    conciliated_by_mtto: { type: 'string' },
    conciliated_at:    { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },

    conciliation_notes:{ type: 'string' },

    status:            { type: 'string', enum: ['pending', 'reconciled', 'disputed'] },

    ot_sent:           { type: 'boolean' },
    ot_response:       { type: 'string' },
    ot_sent_at:        { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },

    is_mtto:           { type: 'boolean' },

    updated_at:        { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    device_id:         { type: 'string' },
    is_deleted:        { type: 'boolean' },
  },
  indexes: ['status', 'machine_id', 'shift_session_id', 'updated_at'],
};

/**
 * Plant Config schema — key-value configuration table.
 * Primary key is `key` (natural key).
 */
export const plantConfigSchema: RxJsonSchema<IPlantConfig> = {
  version: 0,
  primaryKey: 'key',
  type: 'object',
  required: ['key', 'value', 'updated_at', 'device_id', 'is_deleted'],
  properties: {
    key:          { type: 'string', maxLength: 100 },
    value:        { type: 'string' },
    description:  { type: 'string' },
    updated_at:   { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    device_id:    { type: 'string' },
    is_deleted:   { type: 'boolean' },
  },
  indexes: ['updated_at'],
};

/**
 * Shift Summary schema — cached aggregates per shift session.
 * 1:1 relationship with shift_sessions via shift_session_id.
 */
export const shiftSummarySchema: RxJsonSchema<IShiftSummary> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  required: [
    'id', 'shift_session_id',
    'total_planned_min', 'total_downtime_min', 'total_micro_stop_min',
    'total_mtto_min', 'total_prod_min', 'total_boxes', 'total_rejects',
    'has_pending_conciliation',
    'updated_at', 'device_id', 'is_deleted',
  ],
  properties: {
    id:                      { type: 'string', maxLength: 100 },
    shift_session_id:        { type: 'string', maxLength: 100 },
    total_planned_min:       { type: 'number' },
    total_downtime_min:      { type: 'number' },
    total_micro_stop_min:    { type: 'number' },
    total_mtto_min:          { type: 'number' },
    total_prod_min:          { type: 'number' },
    total_boxes:             { type: 'number' },
    total_rejects:           { type: 'number' },
    performance_pct:         { type: 'number' },
    has_pending_conciliation:{ type: 'boolean' },
    updated_at:              { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    device_id:               { type: 'string' },
    is_deleted:              { type: 'boolean' },
  },
  indexes: ['shift_session_id', 'updated_at'],
};