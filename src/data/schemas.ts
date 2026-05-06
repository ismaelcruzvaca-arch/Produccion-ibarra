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
import type { IAsset, IAssetType, IWorkOrder } from '../core/types';

/**
 * Asset collection schema.
 * Indexes: none defined yet — add performance indexes as needed (e.g., status, type_id).
 */
export const assetSchema: RxJsonSchema<IAsset> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  required: ['id', 'client_updated_at', 'deleted'],
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
    deleted: { type: 'boolean' },
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
  required: ['id', 'client_updated_at', 'deleted'],
  properties: {
    id: { type: 'string', maxLength: 100 },
    code: { type: 'string' },
    description: { type: 'string' },
    is_active: { type: 'boolean' },
    client_updated_at: { type: 'number' },
    deleted: { type: 'boolean' },
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
  required: ['id', 'client_updated_at', 'deleted'],
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
    deleted: { type: 'boolean' },
  },
  indexes: [],
};