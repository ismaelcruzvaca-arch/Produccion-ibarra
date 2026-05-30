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
  is_deleted: boolean;
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

  // wo-lifecycle-outbox: campos recibidos desde cmms-ibero
  lifecycle_phase?: string;       // WAPPR | APPROVED | INPRG | COMP | CLOSED | CANCELLED | REJECTED
  symptom_note?: string;          // síntoma reportado por el mecánico
  cause_note?: string;            // causa probable
  action_note?: string;           // acción realizada
  actual_start_at?: number;       // epoch ms — cuándo arrancó la intervención
  cmms_wo_id?: string;            // ID de la WO en cmms-ibero (para mapping cross-project)
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
  is_deleted: boolean;
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
  is_deleted: boolean;

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
  is_iot_enabled?: boolean;
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

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 3: New Collections — Quality, Shifts, Operators
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Quality Inspections ─────────────────────────────────────────────────────────

export type DispositionType = 'liberado' | 'rechazado' | 'reproceso';
export type ShiftType = 'matutino' | 'vespertino' | 'nocturno';
export type DataSourceType = 'vision' | 'manual' | 'hybrid';

/**
 * Quality Inspection — atomic QC check event.
 *
 * Fields now match Hasura production schema:
 * - inspector_id instead of operator_id
 * - disposition (liberado/rechazado/reproceso) instead of result (pass/fail)
 * - shift_type (matutino/vespertino/nocturno) instead of shift_id FK
 * - data_source (vision/manual/hybrid) for audit trail
 * - No more inspection_type, value, defect_code — those are now in defect_logs/weight_logs
 *
 * Uses `updated_at` (not `client_updated_at`) per the new data contract.
 */
export interface IQualityInspection {
  id: string;
  machine_id: string;
  inspector_id: string;
  shift_type: ShiftType;
  disposition: DispositionType;
  notes?: string;
  data_source: DataSourceType;
  updated_at: number;
  device_id: string;
  is_deleted: boolean;
}

export type RxQualityInspection = RxDocument<IQualityInspection>;

// ─── Defect Logs (1:N child of quality_inspections) ─────────────────────────────

/**
 * Defect Log — individual defect entry linked to a quality inspection.
 * Free-text defect_type (no catalog lookup), with severity classification.
 *
 * Uses `updated_at` (not `client_updated_at`) per the new data contract.
 */
export interface IDefectLog {
  id: string;
  inspection_id: string;
  severity: 'critical' | 'major' | 'minor';
  defect_type: string;
  defect_count: number;
  updated_at: number;
  device_id: string;
  is_deleted: boolean;
}

export type RxDefectLog = RxDocument<IDefectLog>;

// ─── Weight Logs (1:N child of quality_inspections) ─────────────────────────────

/**
 * Weight Log — individual weight measurement linked to a quality inspection.
 *
 * Uses `updated_at` (not `client_updated_at`) per the new data contract.
 */
export interface IWeightLog {
  id: string;
  inspection_id: string;
  measured_weight: number;
  updated_at: number;
  device_id: string;
  is_deleted: boolean;
}

export type RxWeightLog = RxDocument<IWeightLog>;

// ─── Shift Sessions ──────────────────────────────────────────────────────────────

/**
 * Shift Session — tracks the lifecycle of a production shift.
 *
 * Fields now match Hasura production schema:
 * - shift_type (string) instead of shift_id FK
 * - started_at/ended_at instead of start_timestamp/end_timestamp
 * - planned_boxes + product_code from Epicor (migration 013)
 * - No more line_id, supervisor_id, notes
 *
 * Uses `updated_at` (not `client_updated_at`) per the new data contract.
 */
export interface IShiftSession {
  id: string;
  machine_id: string;
  operator_id: string;
  shift_type: ShiftType;
  status: 'active' | 'closed';
  started_at: number;
  ended_at?: number;
  planned_boxes?: number;
  product_code?: string;
  updated_at: number;
  device_id: string;
  is_deleted: boolean;
}

export type RxShiftSession = RxDocument<IShiftSession>;

// ─── Operators ───────────────────────────────────────────────────────────────────

/**
 * Operator — reference table for production operators.
 * Uses `is_active` for soft deactivation (catalog pattern).
 * Fields match Hasura: id IS the Epicor payroll code, no more employee_code or role.
 */
export interface IOperator {
  id: string;
  full_name: string;
  is_active: boolean;
  updated_at: number;
  device_id: string;
  is_deleted: boolean;
}

export type RxOperator = RxDocument<IOperator>;

// ─── Product Weight Standards (Offline FK validation) ───────────────────────────

/**
 * Product Weight Standard — local cache for validation of quality weight checks.
 * Operators weigh finished product and the system validates against the standard.
 * Stored locally so validation works offline.
 *
 * Primary key is `sku` (natural key from Epicor), not UUID.
 *
 * Uses `updated_at` (not `client_updated_at`) per the new data contract.
 */
export interface IProductWeightStandard {
  sku: string;
  name: string;
  lower_limit: number;
  upper_limit: number;
  requires_tare: boolean;
  updated_at: number;
  device_id: string;
  is_deleted: boolean;
}

export type RxProductWeightStandard = RxDocument<IProductWeightStandard>;

// ═══════════════════════════════════════════════════════════════════════════════
// Downtime Conciliation — Phase: downtime-conciliation
// ═══════════════════════════════════════════════════════════════════════════════

export type ConciliationStatus = 'pending' | 'reconciled' | 'disputed';

/**
 * Downtime Conciliation — bridges Production downtime events with Maintenance action.
 *
 * When an operator flags a paro with an MTTO reason, a conciliation record is created.
 * The supervisor reviews at shift-end, diagnoses root cause, and triggers OT via cmms-ibero.
 *
 * Uses `updated_at` (not `client_updated_at`) per the new data contract.
 */
export interface IDowntimeConciliation {
  id: string;
  oee_event_id: string;          // FK → oee_events.id (downtime_start event)
  shift_session_id?: string;     // FK → shift_sessions.id
  machine_id: string;            // denormalized for query speed
  reason_code: string;           // original operator reason from oee_event
  duration_min?: number;         // computed from downtime_start → downtime_end

  // Production diagnosis (supervisor)
  diagnosed_code?: string;       // supervisor's root cause code
  diagnosed_by?: string;         // supervisor user ID
  diagnosed_at?: number;         // epoch ms

  // Maintenance diagnosis (mechanic)
  conciliated: boolean;          // whether maintenance has participated
  conciliated_code?: string;     // final cause code
  conciliated_macro?: string;    // final macro category (MTTO, PROD, OTROS)
  conciliated_by_prod?: string;  // production sign-off
  conciliated_by_mtto?: string;  // maintenance sign-off
  conciliated_at?: number;       // epoch ms

  // Notes
  conciliation_notes?: string;

  // Status
  status: ConciliationStatus;

  // OT tracking
  ot_sent: boolean;              // whether oee-trigger was called
  ot_response?: string;          // response from oee-trigger (WO id or error)
  ot_sent_at?: number;

  // Classification
  is_mtto: boolean;              // whether the original reason is MTTO category

  // Timestamps
  updated_at: number;
  device_id: string;
  is_deleted: boolean;
}

export type RxDowntimeConciliation = RxDocument<IDowntimeConciliation>;

/**
 * Plant Config — key-value configuration for plant-level parameters.
 *
 * First key: micro_stop_threshold_min (integer, minutes).
 * Read at startup, cached in Zustand, editable from Settings.
 *
 * Uses `updated_at` (not `client_updated_at`) per the new data contract.
 */
export interface IPlantConfig {
  key: string;         // e.g., 'micro_stop_threshold_min'
  value: string;       // stored as string, parsed by consumer (e.g., '5')
  description?: string;
  updated_at: number;
  device_id: string;
  is_deleted: boolean;
}

export type RxPlantConfig = RxDocument<IPlantConfig>;

/**
 * Shift Summary — cached aggregates for shift-end reporting.
 * Materialized at shift-end. Non-authoritative — always derivable from oee_events.
 * If target met (actual >= theoretical), no record is created.
 *
 * Uses `updated_at` (not `client_updated_at`) per the new data contract.
 */
export interface IShiftSummary {
  id: string;
  shift_session_id: string;      // FK → shift_sessions.id
  total_planned_min: number;
  total_downtime_min: number;
  total_micro_stop_min: number;
  total_mtto_min: number;
  total_prod_min: number;
  total_boxes: number;
  total_rejects: number;
  performance_pct?: number;       // e.g., 85.50
  has_pending_conciliation: boolean;
  updated_at: number;
  device_id: string;
  is_deleted: boolean;
}

export type RxShiftSummary = RxDocument<IShiftSummary>;
