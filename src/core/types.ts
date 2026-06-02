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

// ─── Digital Signatures ─────────────────────────────────────────────────────────

/**
 * Signature entity — represents a digital signature (tap-to-confirm) on a document.
 *
 * Fields:
 * - document_type: discriminator for the signed document type (oee_report, toaster_log,
 *   mixing_batch, extractor_check, vitamin_kit, quality_inspection)
 * - document_id: UUID of the signed document
 * - signer_id: operator_profiles.id of the signer
 * - signer_name: denormalized display name (for offline availability)
 * - signer_role: role at time of signing (operator, supervisor, admin)
 * - signed_at: epoch ms when the signature was captured
 * - sequence: ordinal position in multi-signer chain (1st, 2nd, 3rd, 4th)
 *
 * Uses `updated_at` (not `client_updated_at`) per the new data contract.
 * Stored in shared `signatures` RxDB collection across all form types.
 */
export interface ISignature {
  id: string;
  updated_at: number;
  is_deleted: boolean;
  document_type: string;   // e.g. 'oee_report', 'toaster_log', 'quality_inspection'
  document_id: string;     // UUID of the signed document
  signer_id: string;       // operator_profiles.id
  signer_name: string;     // denormalized (displayName for offline)
  signer_role: string;     // 'operator' | 'supervisor' | 'admin'
  signed_at: number;       // epoch ms
  sequence: number;        // 1st, 2nd, 3rd, 4th signature on same document
}

export type RxSignature = RxDocument<ISignature>;

// ─── Toaster Log (F-PD-16) ──────────────────────────────────────────────────────

/**
 * Toaster Log — captures production data for the toaster station (F-PD-16).
 *
 * Fields per spec TF-1 through TF-5:
 * - Temperature readings (superior, media, inferior)
 * - RPM, vapor pressure
 * - Cacao crudo and tostado humidity percentages
 * - Pesadas per batch, silo, lotes
 * - Tiempo muerto with cause
 * - Initial and final inventories: cascarilla, polvillo, granilla, cacao_crudo, azucar
 */
export interface IToasterLog {
  id: string;
  updated_at: number;
  is_deleted: boolean;
  line_id: string;
  machine_id: string;
  shift_id: string;
  operator_id: string;
  batch_number: string;
  // Temperature readings
  temp_superior: number;
  temp_media: number;
  temp_inferior: number;
  // Process parameters
  rpm: number;
  vapor_pressure: number;
  // Humidity
  cacao_crudo_humidity: number;
  cacao_tostado_humidity: number;
  // Production tracking
  pesadas: number;
  silo: string;
  lotes: string;
  // Dead time
  tiempo_muerto_min: number;
  tiempo_muerto_cause: string;
  // Inventories — initial
  inv_ini_cascarilla: number;
  inv_ini_polvillo: number;
  inv_ini_granilla: number;
  inv_ini_cacao_crudo: number;
  inv_ini_azucar: number;
  // Inventories — final
  inv_fin_cascarilla: number;
  inv_fin_polvillo: number;
  inv_fin_granilla: number;
  inv_fin_cacao_crudo: number;
  inv_fin_azucar: number;
}

export type RxToasterLog = RxDocument<IToasterLog>;

// ─── Mixing Batch (F-PD-17) ─────────────────────────────────────────────────────

/**
 * Mixing Batch — captures production data for the mixing station (F-PD-17).
 *
 * Fields per spec MF-1 through MF-4:
 * - Mezcladora, agitador, batch sequence
 * - Ingredients per batch: azucar, licor, cocoa, grasa vegetal, lecitina, reproceso
 * - Viscosity (cps), discharge temp
 * - Initial / final / consumo inventory per component
 */
export interface IMixingBatch {
  id: string;
  updated_at: number;
  is_deleted: boolean;
  line_id: string;
  machine_id: string;
  shift_id: string;
  operator_id: string;
  batch_sequence: number;
  mezcladora: string;
  agitador: string;
  // Ingredients per batch
  azucar_kg: number;
  licor_kg: number;
  cocoa_kg: number;
  grasa_vegetal_kg: number;
  lecitina_kg: number;
  reproceso_kg: number;
  // Process
  viscosity_cps: number;
  discharge_temp: number;
  // Calculated totals (auto-sum per spec MF-5)
  mezcladas: number;
  molidas: number;
  reproceso_total: number;
  desperdicio: number;
  // Inventories
  inv_ini_azucar: number;
  inv_ini_licor: number;
  inv_ini_cocoa: number;
  inv_ini_grasa_vegetal: number;
  inv_ini_lecitina: number;
  inv_ini_reproceso: number;
  inv_fin_azucar: number;
  inv_fin_licor: number;
  inv_fin_cocoa: number;
  inv_fin_grasa_vegetal: number;
  inv_fin_lecitina: number;
  inv_fin_reproceso: number;
  consumo_azucar: number;
  consumo_licor: number;
  consumo_cocoa: number;
  consumo_grasa_vegetal: number;
  consumo_lecitina: number;
  consumo_reproceso: number;
}

export type RxMixingBatch = RxDocument<IMixingBatch>;

// ─── Extractor Check (F-PD-18) ──────────────────────────────────────────────────

/**
 * Extractor Check — captures production data for the extractor station (F-PD-18).
 *
 * Fields per spec EF-1 through EF-2:
 * - 8 extractors as on/off toggles
 * - Last cleaning date of Cedazo TT
 */
export interface IExtractorCheck {
  id: string;
  updated_at: number;
  is_deleted: boolean;
  line_id: string;
  machine_id: string;
  shift_id: string;
  operator_id: string;
  // 8 extractors as on/off toggles
  extractor_1_on: boolean;
  extractor_2_on: boolean;
  extractor_3_on: boolean;
  extractor_4_on: boolean;
  extractor_5_on: boolean;
  extractor_6_on: boolean;
  extractor_7_on: boolean;
  extractor_8_on: boolean;
  // Cleaning
  cedazo_tt_last_cleaning: number; // epoch ms
}

export type RxExtractorCheck = RxDocument<IExtractorCheck>;

// ─── Vitamin Kit (F-PD-06) ──────────────────────────────────────────────────────

/**
 * Vitamin Kit — captures production data for the vitamin station (F-PD-06).
 *
 * Fields per spec VF-1 through VF-4:
 * - Up to 3 products per turno
 * - #Orden, #Kit, semi-terminado, ingredients with lotes
 * - Microingredient kits verified by Production AND Quality
 * - Peso báscula vs peso físico
 */
export interface IVitaminKit {
  id: string;
  updated_at: number;
  is_deleted: boolean;
  line_id: string;
  machine_id: string;
  shift_id: string;
  operator_id: string;
  // Product info
  orden: string;
  kit: string;
  semi_terminado: string;
  // Ingredients with lotes (flexible payload)
  ingredients: Array<{
    name: string;
    lote: string;
    quantity_kg: number;
  }>;
  // Verifications
  verif_produccion: boolean; // Verified by Production
  verif_calidad: boolean;    // Verified by Quality
  // Weight
  peso_bascula_kg: number;
  peso_fisico_kg: number;
}

export type RxVitaminKit = RxDocument<IVitaminKit>;

// ─── Quality Inspection ─────────────────────────────────────────────────────────

/**
 * Quality Inspection — captures quality control data at production stations.
 *
 * Fields per spec QC-1 through QC-12:
 * - product_id: the product being inspected
 * - inspection_type: visual, weight, temp, metal_detector (QC-6)
 * - value: the measured value
 * - unit: measurement unit
 * - passed: pass/fail status (QC-10)
 * - defect_id: optional reference to quality_defects catalog (QC-9)
 * - defect_label: denormalized defect label for offline display
 * - defect_severity: denormalized defect severity level
 * - notes: optional inspector notes
 * - line_id, machine_id, shift_session_id: context (QC-4 — uses active shift_session.id)
 * - operator_id: who performed the inspection
 * - standard_min/standard_max: cached weight standards from product_weight_standards (QC-3)
 * - standard_warning: true when standard was missing (QC-8)
 *
 * Uses `updated_at` (not `client_updated_at`) per the new data contract.
 */
export interface IQualityInspection {
  id: string;
  updated_at: number;
  is_deleted: boolean;
  line_id: string;
  machine_id: string;
  shift_session_id: string;  // active shift_session.id, NOT catalog shift
  operator_id: string;
  product_id: string;
  inspection_type: 'visual' | 'weight' | 'temp' | 'metal_detector';
  value: number;
  unit: string;
  passed: boolean;
  defect_id?: string;
  defect_label?: string;
  defect_severity?: string;
  notes?: string;
  standard_min?: number;
  standard_max?: number;
  standard_warning?: boolean;
}

export type RxQualityInspection = RxDocument<IQualityInspection>;

// ─── Defect Log ─────────────────────────────────────────────────────────────────

/**
 * Defect Log — records a specific defect found during quality inspection.
 *
 * Fields:
 * - inspection_id: reference to the quality inspection
 * - defect_id: reference to quality_defects catalog
 * - defect_label: denormalized defect label
 * - defect_severity: critical, major, minor
 * - quantity: number of units affected
 * - notes: additional context
 */
export interface IDefectLog {
  id: string;
  updated_at: number;
  is_deleted: boolean;
  inspection_id: string;
  defect_id: string;
  defect_label: string;
  defect_severity: 'critical' | 'major' | 'minor';
  quantity: number;
  notes?: string;
}

export type RxDefectLog = RxDocument<IDefectLog>;

// ─── Weight Log ─────────────────────────────────────────────────────────────────

/**
 * Weight Log — captures weight measurements during quality inspection.
 *
 * Fields:
 * - inspection_id: reference to the quality inspection
 * - product_id: the product being weighed
 * - weight_kg: measured weight
 * - standard_min_kg: minimum weight from product_weight_standards
 * - standard_max_kg: maximum weight from product_weight_standards
 * - passed: whether weight is within standards
 * - warning: true if standard was missing (QC-8)
 */
export interface IWeightLog {
  id: string;
  updated_at: number;
  is_deleted: boolean;
  inspection_id: string;
  product_id: string;
  weight_kg: number;
  standard_min_kg?: number;
  standard_max_kg?: number;
  passed: boolean;
  warning?: boolean;
}

export type RxWeightLog = RxDocument<IWeightLog>;
