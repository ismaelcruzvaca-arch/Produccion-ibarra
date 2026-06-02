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
  IAsset,
  IAssetType,
  IWorkOrder,
  IReport,
  IOeeEvent,
  ISyncError,
  ISignature,
  IToasterLog,
  IMixingBatch,
  IExtractorCheck,
  IVitaminKit,
  IQualityInspection,
  IDefectLog,
  IWeightLog,
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
 */
export const workOrderSchema: RxJsonSchema<IWorkOrder> = {
  version: 1,
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
  },
  indexes: ['updated_at'],
};

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

/**
 * Signatures collection schema.
 * Indexes: updated_at for replication, document_id, [document_type, document_id].
 */
export const signatureSchema: RxJsonSchema<ISignature> = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  required: [
    'id',
    'created_at',
    'updated_at',
    'is_deleted',
    'document_type',
    'document_id',
    'signer_id',
    'signer_name',
    'signer_role',
    'signed_at',
    'sequence',
  ],
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
    temp_superior: { type: 'number' },
    temp_media: { type: 'number' },
    temp_inferior: { type: 'number' },
    rpm: { type: 'number' },
    vapor_pressure: { type: 'number' },
    cacao_crudo_humidity: { type: 'number' },
    cacao_tostado_humidity: { type: 'number' },
    pesadas: { type: 'number' },
    silo: { type: 'string' },
    lotes: { type: 'string' },
    tiempo_muerto_min: { type: 'number' },
    tiempo_muerto_cause: { type: 'string' },
    inv_ini_cascarilla: { type: 'number' },
    inv_ini_polvillo: { type: 'number' },
    inv_ini_granilla: { type: 'number' },
    inv_ini_cacao_crudo: { type: 'number' },
    inv_ini_azucar: { type: 'number' },
    inv_fin_cascarilla: { type: 'number' },
    inv_fin_polvillo: { type: 'number' },
    inv_fin_granilla: { type: 'number' },
    inv_fin_cacao_crudo: { type: 'number' },
    inv_fin_azucar: { type: 'number' },
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
    line_id: { type: 'string' },
    machine_id: { type: 'string' },
    shift_id: { type: 'string' },
    operator_id: { type: 'string' },
    batch_sequence: { type: 'number' },
    mezcladora: { type: 'string' },
    agitador: { type: 'string' },
    azucar_kg: { type: 'number' },
    licor_kg: { type: 'number' },
    cocoa_kg: { type: 'number' },
    grasa_vegetal_kg: { type: 'number' },
    lecitina_kg: { type: 'number' },
    reproceso_kg: { type: 'number' },
    viscosity_cps: { type: 'number' },
    discharge_temp: { type: 'number' },
    mezcladas: { type: 'number' },
    molidas: { type: 'number' },
    reproceso_total: { type: 'number' },
    desperdicio: { type: 'number' },
    inv_ini_azucar: { type: 'number' },
    inv_ini_licor: { type: 'number' },
    inv_ini_cocoa: { type: 'number' },
    inv_ini_grasa_vegetal: { type: 'number' },
    inv_ini_lecitina: { type: 'number' },
    inv_ini_reproceso: { type: 'number' },
    inv_fin_azucar: { type: 'number' },
    inv_fin_licor: { type: 'number' },
    inv_fin_cocoa: { type: 'number' },
    inv_fin_grasa_vegetal: { type: 'number' },
    inv_fin_lecitina: { type: 'number' },
    inv_fin_reproceso: { type: 'number' },
    consumo_azucar: { type: 'number' },
    consumo_licor: { type: 'number' },
    consumo_cocoa: { type: 'number' },
    consumo_grasa_vegetal: { type: 'number' },
    consumo_lecitina: { type: 'number' },
    consumo_reproceso: { type: 'number' },
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
    line_id: { type: 'string' },
    machine_id: { type: 'string' },
    shift_id: { type: 'string' },
    operator_id: { type: 'string' },
    extractor_1_on: { type: 'boolean' },
    extractor_2_on: { type: 'boolean' },
    extractor_3_on: { type: 'boolean' },
    extractor_4_on: { type: 'boolean' },
    extractor_5_on: { type: 'boolean' },
    extractor_6_on: { type: 'boolean' },
    extractor_7_on: { type: 'boolean' },
    extractor_8_on: { type: 'boolean' },
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
    line_id: { type: 'string' },
    machine_id: { type: 'string' },
    shift_id: { type: 'string' },
    operator_id: { type: 'string' },
    orden: { type: 'string' },
    kit: { type: 'string' },
    semi_terminado: { type: 'string' },
    ingredients: { type: 'array' },
    verif_produccion: { type: 'boolean' },
    verif_calidad: { type: 'boolean' },
    peso_bascula_kg: { type: 'number' },
    peso_fisico_kg: { type: 'number' },
  },
  indexes: ['updated_at', 'shift_id'],
};

// ─── Quality Inspection ─────────────────────────────────────────────────────────

/**
 * Quality Inspection schema.
 * Indexes: shift_session_id for active shift queries, [shift_session_id, updated_at] for DESC sort.
 */
export const qualityInspectionSchema: RxJsonSchema<IQualityInspection> = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  required: [
    'id',
    'created_at',
    'updated_at',
    'is_deleted',
    'line_id',
    'machine_id',
    'shift_session_id',
    'operator_id',
    'product_id',
    'inspection_type',
    'value',
    'unit',
    'passed',
  ],
  properties: {
    id: { type: 'string', maxLength: 100 },
    created_at: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    updated_at: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    is_deleted: { type: 'boolean' },
    line_id: { type: 'string' },
    machine_id: { type: 'string' },
    shift_session_id: { type: 'string' },
    operator_id: { type: 'string' },
    product_id: { type: 'string' },
    inspection_type: {
      type: 'string',
      enum: ['visual', 'weight', 'temp', 'metal_detector'],
    },
    value: { type: 'number' },
    unit: { type: 'string' },
    passed: { type: 'boolean' },
    defect_id: { type: 'string' },
    defect_label: { type: 'string' },
    defect_severity: { type: 'string' },
    notes: { type: 'string' },
    standard_min: { type: 'number' },
    standard_max: { type: 'number' },
    standard_warning: { type: 'boolean' },
  },
  indexes: ['shift_session_id', ['shift_session_id', 'updated_at']],
};

// ─── Defect Log ─────────────────────────────────────────────────────────────────

/**
 * Defect Log schema.
 * Indexes: updated_at for replication, inspection_id for lookup.
 */
export const defectLogSchema: RxJsonSchema<IDefectLog> = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  required: [
    'id',
    'created_at',
    'updated_at',
    'is_deleted',
    'inspection_id',
    'defect_id',
    'defect_label',
    'defect_severity',
    'quantity',
  ],
  properties: {
    id: { type: 'string', maxLength: 100 },
    created_at: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    updated_at: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    is_deleted: { type: 'boolean' },
    inspection_id: { type: 'string' },
    defect_id: { type: 'string' },
    defect_label: { type: 'string' },
    defect_severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
    quantity: { type: 'number' },
    notes: { type: 'string' },
  },
  indexes: ['updated_at', 'inspection_id'],
};

// ─── Weight Log ─────────────────────────────────────────────────────────────────

/**
 * Weight Log schema.
 * Indexes: updated_at for replication, inspection_id for lookup.
 */
export const weightLogSchema: RxJsonSchema<IWeightLog> = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  required: [
    'id',
    'created_at',
    'updated_at',
    'is_deleted',
    'inspection_id',
    'product_id',
    'weight_kg',
    'passed',
  ],
  properties: {
    id: { type: 'string', maxLength: 100 },
    created_at: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    updated_at: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10000000000000 },
    is_deleted: { type: 'boolean' },
    inspection_id: { type: 'string' },
    product_id: { type: 'string' },
    weight_kg: { type: 'number' },
    standard_min_kg: { type: 'number' },
    standard_max_kg: { type: 'number' },
    passed: { type: 'boolean' },
    warning: { type: 'boolean' },
  },
  indexes: ['updated_at', 'inspection_id'],
};
