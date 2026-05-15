/**
 * Domain model types for the Chocolate Ibarra application.
 *
 * Pattern: Domain Model / Interface Definitions
 * Why: TypeScript interfaces define the shape of all data entities.
 * These are used by both RxDB (local) and GraphQL (remote) layers.
 * The `IBaseDocument` interface is the mandatory foundation for all collections,
 * ensuring every document has a UUID primary key, sync timestamp, and soft-delete flag.
 */

import type { RxDocument } from 'rxdb';

/**
 * Base document interface — mandatory fields for all collections.
 * - id: UUID v4 primary key
 * - client_updated_at: milliseconds since epoch (BIGINT in Postgres)
 * - deleted: soft-delete flag for sync
 *
 * Pattern: Base Interface Embedding
 * All domain interfaces extend IBaseDocument to inherit these mandatory fields.
 * This ensures consistent structure across all collections and enables
 * generic sync logic (checkpoint-based pull, upsert push, LWW conflict resolution).
 */
export interface IBaseDocument {
  id: string;
  client_updated_at: number;
  deleted: boolean;
}

// ─── Asset Types ────────────────────────────────────────────────────────────────

export type AssetStatus = 'active' | 'maintenance' | 'retired';

/**
 * Asset entity — represents a piece of equipment or facility asset.
 *
 * Fields:
 * - name: human-readable asset name
 * - type_id: reference to asset type catalog
 * - status: current operational status
 * - location: optional physical location
 * - serial_number: manufacturer serial (optional, for warranty tracking)
 * - manufacturer, model_number: make/model info
 * - in_service_date: when the asset was put into service
 * - warranty_expiration: warranty end date
 */
export interface IAsset extends IBaseDocument {
  name: string;
  type_id: string;
  status: AssetStatus;
  location?: string;
  serial_number?: string;
  manufacturer?: string;
  model_number?: string;
  in_service_date?: number; // epoch ms
  warranty_expiration?: number; // epoch ms
}

export type RxAsset = RxDocument<IAsset>;

// ─── Asset Type Catalog ────────────────────────────────────────────────────────

/**
 * Asset Type — classifies assets into categories (e.g., "HVAC", "Electrical", "Plumbing").
 * Used to group assets and enforce type-specific maintenance schedules.
 *
 * Fields:
 * - code: short identifier (e.g., "HVAC", "ELEC")
 * - description: human-readable description
 * - is_active: whether this type is available for new assets
 */
export interface IAssetType extends IBaseDocument {
  code: string;
  description: string;
  is_active: boolean;
}

export type RxAssetType = RxDocument<IAssetType>;

// ─── Work Orders ───────────────────────────────────────────────────────────────

export type WorkOrderStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type WorkOrderPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Work Order — represents a maintenance or repair task assigned to an asset.
 *
 * Fields:
 * - equipment_id: the asset this work order pertains to
 * - description: what needs to be done
 * - status: current workflow state
 * - priority: urgency level
 * - assigned_to: optional user ID of the assigned technician
 * - scheduled_date: when the work is scheduled
 * - completed_date: when the work was finished
 */
export interface IWorkOrder extends IBaseDocument {
  equipment_id: string;
  description: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  assigned_to?: string;
  scheduled_date?: number; // epoch ms
  completed_date?: number; // epoch ms
}

export type RxWorkOrder = RxDocument<IWorkOrder>;

// ─── Reports ───────────────────────────────────────────────────────────────────

export interface ReportData {
  line_id: string;
  total_pieces: number;
  rejected_pieces: number;
  downtime_minutes: number;
}

/**
 * Report entity — represents a production report with flexible data payload.
 *
 * Fields:
 * - template_id: identifies the report template (e.g., 'oee-basic')
 * - data: flexible payload containing report-specific metrics
 *
 * Uses `updated_at` (not `client_updated_at`) per the approved data contract
 * for new collections.
 */
export interface IReport {
  id: string;
  updated_at: number;
  deleted: boolean;
  template_id: string;
  data: ReportData;
}

export type RxReport = RxDocument<IReport>;

// ─── OEE Events ────────────────────────────────────────────────────────────────

export type OeeEventType =
  | 'shift_start'
  | 'shift_end'
  | 'downtime_start'
  | 'downtime_end'
  | 'box_count'
  | 'reject_count';

/**
 * OEE Event — atomic production event for OEE calculation.
 *
 * Uses `updated_at` (not `client_updated_at`) per the new data contract.
 */
export interface IOeeEvent {
  id: string;
  updated_at: number;
  deleted: boolean;

  // Context
  line_id: string;
  machine_id: string;
  operator_id?: string;
  shift_id: string;

  // Evento atómico
  event_type: OeeEventType;
  timestamp: number;

  // Datos del evento
  reason_code?: string;
  quantity?: number;
  planned_boxes?: number;
  notes?: string;

  // Retroactivo
  is_retroactive?: boolean;
  related_event_id?: string;

  // Wave 4: device audit
  device_id: string;
}

export type RxOeeEvent = RxDocument<IOeeEvent>;

// ─── Sync Error (Dead Letter Queue) ─────────────────────────────────────────────

/**
 * Sync Error — quarantined event that failed server-side validation.
 * Stored locally for supervisor review and retry.
 */
export interface ISyncError {
  id: string;
  id_evento: string;
  payload_original: Record<string, unknown>;
  mensaje_error: string;
  fecha: number;
}

export type RxSyncError = RxDocument<ISyncError>;

// ─── Catalog Types (from Hasura) ────────────────────────────────────────────────

/**
 * Catalog interfaces for data fetched from Hasura reference tables.
 * These are NOT RxDB documents — they live in Zustand + AsyncStorage.
 * They mirror the DB schema (snake_case) for direct mapping from GraphQL.
 */

export interface ICatalogLine {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

export interface ICatalogMachine {
  id: string;
  line_id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

export interface ICatalogShift {
  id: string;
  label: string;
  start_hour: number;
  end_hour: number;
  is_active: boolean;
}

export interface ICatalogProduct {
  id: string;
  code: string;
  name: string;
  theoretical_ppm: number;
  is_active: boolean;
}

export interface ICatalogStopReason {
  id: string;
  code: string;
  label: string;
  category: string;
  macro: string;
  stops_line: boolean;
  sort_order: number;
  is_active: boolean;
}
