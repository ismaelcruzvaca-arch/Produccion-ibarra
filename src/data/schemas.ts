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
import type { IAsset, IAssetType, IWorkOrder, IReport, IOeeEvent, ISyncError } from '../core/types';

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
 */
export const workOrderSchema: RxJsonSchema<IWorkOrder> = {
  version: 0,
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
  },
  indexes: [],
};

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