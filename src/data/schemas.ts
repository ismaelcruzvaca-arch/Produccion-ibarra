/**
 * RxDB JSON schemas for all collections.
 *
 * Pattern: Schema Definition
 * Why: RxDB requires explicit JSON schemas for validation and indexing.
 * Each schema follows the same structure:
 *   - version: 1 (standardized across all collections; migrations enabled)
 *   - primaryKey: 'id' (UUID v4, set by the repository before insert)
 *   - required: ['id', 'created_at', 'updated_at', 'is_deleted'] — IBaseDocument fields
 *   - properties: typed fields matching the TypeScript interfaces
 *
 * All schemas use `created_at` and `updated_at` timestamps (epoch ms).
 * `updated_at` serves as the replication checkpoint for RxDB sync.
 *
 * These schemas are used by both local storage (Dexie/SQLite) and the
 * replication layer to validate document structure.
 */

import type { RxJsonSchema } from 'rxdb';
import type {
  IAsset, IAssetType, IWorkOrder, IReport, IOeeEvent, ISyncError,
  ISignature, IToasterLog, IMixingBatch, IExtractorCheck, IVitaminKit,
  IQualityInspection, IDefectLog, IWeightLog,
  IShiftSession, IOperator, IProductWeightStandard,
  IDowntimeConciliation, IPlantConfig, IShiftSummary,
} from '../core/types';

/**
 * Asset collection schema.
 * Indexes: updated_at for replication checkpoint, status + type_id for filtered queries.
 */
export const assetSchema: RxJsonSchema<IAsset> = {
  version: 2,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'created_at', 'updated_at', 'is_deleted'],
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
    created_at: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    updated_at: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    is_deleted: { type: 'boolean' },
  },
  indexes: ['updated_at'],
};

/**
 * Asset Type catalog schema.
 * Used to categorize assets (e.g., HVAC, Electrical, Plumbing).
 */
export const assetTypeSchema: RxJsonSchema<IAssetType> = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'created_at', 'updated_at', 'is_deleted'],
  properties: {
    id: { type: 'string', maxLength: 100 },
    code: { type: 'string' },
    description: { type: 'string' },
    is_active: { type: 'boolean' },
    created_at: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    updated_at: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    is_deleted: { type: 'boolean' },
  },
  indexes: ['updated_at'],
};

/**
 * Work Order schema.
 * Represents a maintenance/repair task assigned to an asset.
 * 
 * v1: Added lifecycle_phase, symptom_note, cause_note, action_note,
 *     actual_start_at, cmms_wo_id (wo-lifecycle-outbox integration).
 * v2: Added completed_at (wo-lifecycle-integration).
 */
export const workOrderSchema: RxJsonSchema<IWorkOrder> = {
  version: 2,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'created_at', 'updated_at', 'is_deleted'],
  properties: {
    id: { type: 'string', maxLength: 100 },
    equipment_id: { type: 'string' },
    description: { type: 'string' },
    status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] },
    priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
    assigned_to: { type: 'string' },
    scheduled_date: { type: 'number' },
    completed_date: { type: 'number' },
    created_at: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    updated_at: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    is_deleted: { type: 'boolean' },

    // wo-lifecycle-outbox v1: campos desde cmms-ibero
    lifecycle_phase: { type: 'string' },
    symptom_note: { type: 'string' },
    cause_note: { type: 'string' },
    action_note: { type: 'string' },
    actual_start_at: { type: 'number' },
    completed_at: { type: 'number' },   // v2: cuándo finalizó la intervención
    cmms_wo_id: { type: 'string' },
  },
  indexes: ['updated_at'],
};

/**
 * Migration strategy for work_orders v0 → v1.
 * Adds default values for new optional fields (all undefined = safe).
 */
export const workOrderSchemaV0ToV1 = (oldDoc: Record<string, unknown>) => ({
  ...oldDoc,
  lifecycle_phase: undefined,
  symptom_note: undefined,
  cause_note: undefined,
  action_note: undefined,
  actual_start_at: undefined,
  cmms_wo_id: undefined,
});

/**
 * Migration strategy for work_orders v1 → v2.
 * Adds completed_at for the wo-lifecycle-integration.
 */
export const workOrderSchemaV1ToV2 = (oldDoc: Record<string, unknown>) => ({
  ...oldDoc,
  completed_at: undefined,
});

/**
 * Report collection schema.
 * The `data` field is a flexible object for template-specific payloads.
 */
export const reportSchema: RxJsonSchema<IReport> = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'created_at', 'updated_at', 'is_deleted', 'template_id', 'data'],
  properties: {
    id: { type: 'string', maxLength: 100 },
    created_at: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
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
 * Indexes: updated_at for replication, timestamp, [line_id, timestamp], [shift_id, timestamp].
 */
export const oeeEventSchema: RxJsonSchema<IOeeEvent> = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'created_at', 'updated_at', 'is_deleted', 'line_id', 'machine_id', 'shift_id', 'event_type', 'timestamp'],
  properties: {
    id:               { type: 'string', maxLength: 100 },
    created_at:       { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
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
  indexes: ['updated_at', 'timestamp', ['line_id', 'timestamp'], ['shift_id', 'timestamp']],
};

/**
 * Sync Error collection schema (dead-letter queue).
 * Stores events that failed server-side validation during push.
 */
export const syncErrorSchema: RxJsonSchema<ISyncError> = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'created_at', 'updated_at', 'is_deleted', 'id_evento', 'payload_original', 'mensaje_error', 'fecha'],
  properties: {
    id:               { type: 'string', maxLength: 100 },
    created_at:       { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    updated_at:       { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    is_deleted:       { type: 'boolean' },
    id_evento:        { type: 'string', maxLength: 100 },
    payload_original: { type: 'object' },
    mensaje_error:    { type: 'string' },
    fecha:            { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
  },
  indexes: ['id_evento', 'fecha'],
};

// ─── Digital Signatures ─────────────────────────────────────────────────────────

export const signatureSchema: RxJsonSchema<ISignature> = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'created_at', 'updated_at', 'is_deleted', 'document_type', 'document_id', 'signer_id', 'signer_name', 'signer_role', 'signed_at', 'sequence'],
  properties: {
    id: { type: 'string', maxLength: 100 },
    created_at: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    updated_at: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    is_deleted: { type: 'boolean' },
    document_type: { type: 'string' },
    document_id: { type: 'string' },
    signer_id: { type: 'string' },
    signer_name: { type: 'string' },
    signer_role: { type: 'string' },
    signed_at: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    sequence: { type: 'number', multipleOf: 1, minimum: 0, maximum: 100 },
  },
  indexes: ['updated_at', 'document_id', ['document_type', 'document_id']],
};

// ─── Toaster Log (F-PD-16) ──────────────────────────────────────────────────────

export const toasterLogSchema: RxJsonSchema<IToasterLog> = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'created_at', 'updated_at', 'is_deleted'],
  properties: {
    id: { type: 'string', maxLength: 100 },
    created_at: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    updated_at: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    is_deleted: { type: 'boolean' },
    line_id: { type: 'string' },
    machine_id: { type: 'string' },
    shift_id: { type: 'string' },
    operator_id: { type: 'string' },
    batch_number: { type: 'string' },
    temp_superior: { type: 'number' }, temp_media: { type: 'number' }, temp_inferior: { type: 'number' },
    rpm: { type: 'number' }, vapor_pressure: { type: 'number' },
    cacao_crudo_humidity: { type: 'number' }, cacao_tostado_humidity: { type: 'number' },
    pesadas: { type: 'number' }, silo: { type: 'string' }, lotes: { type: 'string' },
    tiempo_muerto_min: { type: 'number' }, tiempo_muerto_cause: { type: 'string' },
    inv_ini_cascarilla: { type: 'number' }, inv_ini_polvillo: { type: 'number' },
    inv_ini_granilla: { type: 'number' }, inv_ini_cacao_crudo: { type: 'number' }, inv_ini_azucar: { type: 'number' },
    inv_fin_cascarilla: { type: 'number' }, inv_fin_polvillo: { type: 'number' },
    inv_fin_granilla: { type: 'number' }, inv_fin_cacao_crudo: { type: 'number' }, inv_fin_azucar: { type: 'number' },
  },
  indexes: ['updated_at', 'shift_id', ['shift_id', 'batch_number']],
};

// ─── Mixing Batch (F-PD-17) ─────────────────────────────────────────────────────

export const mixingBatchSchema: RxJsonSchema<IMixingBatch> = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'created_at', 'updated_at', 'is_deleted'],
  properties: {
    id: { type: 'string', maxLength: 100 },
    created_at: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    updated_at: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    is_deleted: { type: 'boolean' },
    line_id: { type: 'string' }, machine_id: { type: 'string' }, shift_id: { type: 'string' }, operator_id: { type: 'string' },
    batch_sequence: { type: 'number' }, mezcladora: { type: 'string' }, agitador: { type: 'string' },
    azucar_kg: { type: 'number' }, licor_kg: { type: 'number' }, cocoa_kg: { type: 'number' },
    grasa_vegetal_kg: { type: 'number' }, lecitina_kg: { type: 'number' }, reproceso_kg: { type: 'number' },
    viscosity_cps: { type: 'number' }, discharge_temp: { type: 'number' },
    mezcladas: { type: 'number' }, molidas: { type: 'number' }, reproceso_total: { type: 'number' }, desperdicio: { type: 'number' },
    inv_ini_azucar: { type: 'number' }, inv_ini_licor: { type: 'number' }, inv_ini_cocoa: { type: 'number' },
    inv_ini_grasa_vegetal: { type: 'number' }, inv_ini_lecitina: { type: 'number' }, inv_ini_reproceso: { type: 'number' },
    inv_fin_azucar: { type: 'number' }, inv_fin_licor: { type: 'number' }, inv_fin_cocoa: { type: 'number' },
    inv_fin_grasa_vegetal: { type: 'number' }, inv_fin_lecitina: { type: 'number' }, inv_fin_reproceso: { type: 'number' },
    consumo_azucar: { type: 'number' }, consumo_licor: { type: 'number' }, consumo_cocoa: { type: 'number' },
    consumo_grasa_vegetal: { type: 'number' }, consumo_lecitina: { type: 'number' }, consumo_reproceso: { type: 'number' },
  },
  indexes: ['updated_at', 'shift_id', 'batch_sequence'],
};

// ─── Extractor Check (F-PD-18) ──────────────────────────────────────────────────

export const extractorCheckSchema: RxJsonSchema<IExtractorCheck> = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'created_at', 'updated_at', 'is_deleted'],
  properties: {
    id: { type: 'string', maxLength: 100 },
    created_at: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    updated_at: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    is_deleted: { type: 'boolean' },
    line_id: { type: 'string' }, machine_id: { type: 'string' }, shift_id: { type: 'string' }, operator_id: { type: 'string' },
    extractor_1_on: { type: 'boolean' }, extractor_2_on: { type: 'boolean' },
    extractor_3_on: { type: 'boolean' }, extractor_4_on: { type: 'boolean' },
    extractor_5_on: { type: 'boolean' }, extractor_6_on: { type: 'boolean' },
    extractor_7_on: { type: 'boolean' }, extractor_8_on: { type: 'boolean' },
    cedazo_tt_last_cleaning: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
  },
  indexes: ['updated_at', 'shift_id'],
};

// ─── Vitamin Kit (F-PD-06) ──────────────────────────────────────────────────────

export const vitaminKitSchema: RxJsonSchema<IVitaminKit> = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'created_at', 'updated_at', 'is_deleted'],
  properties: {
    id: { type: 'string', maxLength: 100 },
    created_at: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    updated_at: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    is_deleted: { type: 'boolean' },
    line_id: { type: 'string' }, machine_id: { type: 'string' }, shift_id: { type: 'string' }, operator_id: { type: 'string' },
    orden: { type: 'string' }, kit: { type: 'string' }, semi_terminado: { type: 'string' },
    ingredients: { type: 'array' },
    verif_produccion: { type: 'boolean' }, verif_calidad: { type: 'boolean' },
    peso_bascula_kg: { type: 'number' }, peso_fisico_kg: { type: 'number' },
  },
  indexes: ['updated_at', 'shift_id'],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 3: New Collections — Quality, Shifts, Operators
// ─── Adaptados a version 1 con created_at + updated_at para trazabilidad
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Quality Inspection schema (IT-AC-09).
 * Modelo de disposición (liberado/rechazado/reproceso) con data_source para IoT.
 * Indexes: machine_id, shift_type para filtrado por máquina/turno.
 */
export const qualityInspectionSchema: RxJsonSchema<IQualityInspection> = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'created_at', 'updated_at', 'is_deleted', 'machine_id', 'inspector_id', 'shift_type', 'disposition', 'data_source', 'device_id', 'inspection_type', 'passed', 'value', 'unit', 'product_id', 'line_id', 'shift_session_id', 'operator_id'],
  properties: {
    id:               { type: 'string', maxLength: 100 },
    created_at:       { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    updated_at:       { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    is_deleted:       { type: 'boolean' },
    machine_id:       { type: 'string', maxLength: 100 },
    inspector_id:     { type: 'string', maxLength: 100 },
    shift_type:       { type: 'string', enum: ['matutino', 'vespertino', 'nocturno'] },
    disposition:      { type: 'string', enum: ['pending', 'liberado', 'rechazado', 'reproceso'] },
    notes:            { type: 'string' },
    data_source:      { type: 'string', enum: ['vision', 'manual', 'hybrid'] },
    device_id:        { type: 'string' },
    inspection_type:  { type: 'string' },
    passed:           { type: 'boolean' },
    value:            { type: 'number' },
    unit:             { type: 'string' },
    standard_min:     { type: 'number' },
    standard_max:     { type: 'number' },
    standard_warning: { type: 'boolean' },
    product_id:       { type: 'string' },
    line_id:          { type: 'string' },
    shift_session_id: { type: 'string' },
    operator_id:      { type: 'string' },
    defect_id:        { type: 'string' },
    defect_label:     { type: 'string' },
    defect_severity:  { type: 'string' },
  },
  indexes: ['machine_id', 'shift_type'],
};

/**
 * Defect Log schema — 1:N child of quality_inspections (IT-AC-09).
 * Severidad: critical (inocuidad), major, minor. defect_type en texto libre.
 */
export const defectLogSchema: RxJsonSchema<IDefectLog> = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'created_at', 'updated_at', 'is_deleted', 'inspection_id', 'severity', 'defect_type', 'defect_count', 'device_id'],
  properties: {
    id:            { type: 'string', maxLength: 100 },
    created_at:    { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    updated_at:    { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    is_deleted:    { type: 'boolean' },
    inspection_id: { type: 'string', maxLength: 100 },
    severity:      { type: 'string', enum: ['critical', 'major', 'minor'] },
    defect_type:   { type: 'string' },
    defect_count:  { type: 'number' },
    device_id:     { type: 'string' },
  },
  indexes: ['inspection_id'],
};

/**
 * Weight Log schema — 1:N child of quality_inspections (IT-AC-09).
 * Validado contra product_weight_standards.
 */
export const weightLogSchema: RxJsonSchema<IWeightLog> = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'created_at', 'updated_at', 'is_deleted', 'inspection_id', 'measured_weight', 'device_id'],
  properties: {
    id:             { type: 'string', maxLength: 100 },
    created_at:     { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    updated_at:     { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    is_deleted:     { type: 'boolean' },
    inspection_id:  { type: 'string', maxLength: 100 },
    measured_weight:{ type: 'number' },
    device_id:      { type: 'string' },
  },
  indexes: ['inspection_id'],
};

/**
 * Shift Session schema — ciclo de vida del turno de producción.
 * shift_type (matutino/vespertino/nocturno), started_at/ended_at, planned_boxes, product_code.
 */
export const shiftSessionSchema: RxJsonSchema<IShiftSession> = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'created_at', 'updated_at', 'is_deleted', 'machine_id', 'operator_id', 'shift_type', 'status', 'started_at', 'device_id'],
  properties: {
    id:           { type: 'string', maxLength: 100 },
    created_at:   { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    updated_at:   { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    is_deleted:   { type: 'boolean' },
    machine_id:   { type: 'string', maxLength: 100 },
    operator_id:  { type: 'string', maxLength: 100 },
    shift_type:   { type: 'string', enum: ['matutino', 'vespertino', 'nocturno'] },
    status:       { type: 'string', enum: ['active', 'closed'] },
    started_at:   { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    ended_at:     { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    planned_boxes:{ type: 'number' },
    product_code: { type: 'string' },
    device_id:    { type: 'string' },
  },
  indexes: ['started_at', 'status'],
};

/**
 * Operator schema — referencia de operadores (Epicor payroll code = id).
 */
export const operatorSchema: RxJsonSchema<IOperator> = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'created_at', 'updated_at', 'is_deleted', 'full_name', 'is_active', 'device_id'],
  properties: {
    id:         { type: 'string', maxLength: 100 },
    created_at: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    updated_at: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    is_deleted: { type: 'boolean' },
    full_name:  { type: 'string' },
    is_active:  { type: 'boolean' },
    device_id:  { type: 'string' },
  },
  indexes: [],
};

/**
 * Product Weight Standard schema (IT-AC-09 — tabla de pesos máximos y mínimos).
 * Primary key: sku (Epicor natural key). Pull-only desde Hasura.
 */
export const productWeightStandardSchema: RxJsonSchema<IProductWeightStandard> = {
  version: 1,
  primaryKey: 'sku',
  type: 'object',
  required: ['sku', 'created_at', 'updated_at', 'is_deleted', 'name', 'lower_limit', 'upper_limit', 'requires_tare', 'device_id'],
  properties: {
    sku:          { type: 'string', maxLength: 100 },
    created_at:   { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    updated_at:   { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    is_deleted:   { type: 'boolean' },
    name:         { type: 'string' },
    lower_limit:  { type: 'number' },
    upper_limit:  { type: 'number' },
    requires_tare:{ type: 'boolean' },
    device_id:    { type: 'string' },
  },
  indexes: ['sku'],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Downtime Conciliation — bridge Production ↔ Maintenance
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Downtime Conciliation schema.
 * Vincula eventos de paro (oee_events) con diagnóstico de supervisor y trigger de OT.
 */
export const downtimeConciliationSchema: RxJsonSchema<IDowntimeConciliation> = {
  version: 2,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'created_at', 'updated_at', 'is_deleted', 'oee_event_id', 'machine_id', 'reason_code', 'status', 'conciliated', 'ot_sent', 'is_mtto', 'device_id'],
  properties: {
    id:                { type: 'string', maxLength: 100 },
    created_at:        { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    updated_at:        { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    is_deleted:        { type: 'boolean' },
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
    status:            { type: 'string', enum: ['pending', 'reconciled', 'disputed', 'escalated'] },
    ot_sent:           { type: 'boolean' },
    ot_response:       { type: 'string' },
    ot_sent_at:        { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    is_mtto:           { type: 'boolean' },
    device_id:         { type: 'string' },

    // Wave 5: RCA + Multi-Department Verdicts
    involved_departments:    { type: 'array' },
    verdicts:               { type: 'array' },
    analysis_method:        { type: 'string', enum: ['5whys', 'ishikawa'] },
    why_1:                  { type: 'string' },
    why_2:                  { type: 'string' },
    why_3:                  { type: 'string' },
    why_4:                  { type: 'string' },
    why_5:                  { type: 'string' },
    root_cause:             { type: 'string' },
    corrective_action:      { type: 'object', properties: {
      description:  { type: 'string' },
      responsible:  { type: 'string' },
      department:   { type: 'string' },
      due_date:     { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
      status:       { type: 'string', enum: ['open', 'in_progress', 'completed'] },
    } },
    escalation_deadline:    { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    escalated_at:           { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    escalated_to:           { type: 'string' },
  },
  indexes: ['status', 'machine_id', 'shift_session_id', 'updated_at'],
};

/**
 * Plant Config schema — parámetros clave-valor de planta.
 * Primer key: micro_stop_threshold_min.
 */
export const plantConfigSchema: RxJsonSchema<IPlantConfig> = {
  version: 1,
  primaryKey: 'key',
  type: 'object',
  required: ['key', 'created_at', 'updated_at', 'is_deleted', 'value', 'device_id'],
  properties: {
    key:          { type: 'string', maxLength: 100 },
    created_at:   { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    updated_at:   { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    is_deleted:   { type: 'boolean' },
    value:        { type: 'string' },
    description:  { type: 'string' },
    device_id:    { type: 'string' },
  },
  indexes: ['updated_at'],
};

/**
 * Shift Summary schema — agregados cacheados por turno.
 * No autoritativo — siempre derivable de oee_events.
 */
export const shiftSummarySchema: RxJsonSchema<IShiftSummary> = {
  version: 2,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'created_at', 'updated_at', 'is_deleted', 'shift_session_id', 'total_planned_min', 'total_downtime_min', 'total_micro_stop_min', 'total_mtto_min', 'total_prod_min', 'total_boxes', 'total_rejects', 'has_pending_conciliation', 'device_id'],
  properties: {
    id:                      { type: 'string', maxLength: 100 },
    created_at:              { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    updated_at:              { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    is_deleted:              { type: 'boolean' },
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
    device_id:               { type: 'string' },

    // Wave 5: Stop Classification
    classified_stops:        { type: 'array' },
  },
  indexes: ['shift_session_id', 'updated_at'],
};
