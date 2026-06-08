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
 * - created_at: milliseconds since epoch when the document was first created
 * - updated_at: milliseconds since epoch when the document was last modified (sync checkpoint)
 * - is_deleted: soft-delete flag for sync
 *
 * Pattern: Base Interface Embedding
 * All domain interfaces extend IBaseDocument to inherit these mandatory fields.
 * This ensures consistent structure across all collections and enables
 * generic sync logic (checkpoint-based pull, upsert push, LWW conflict resolution).
 */
export interface IBaseDocument {
  id: string;
  created_at: number;   // epoch ms — document creation time
  updated_at: number;   // epoch ms — last modification (replication checkpoint)
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
  completed_at?: number;           // epoch ms — cuándo finalizó la intervención
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
 */
export interface IReport {
  id: string;
  created_at: number;   // epoch ms
  updated_at: number;   // epoch ms (replication checkpoint)
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
 */
export interface IOeeEvent {
  id: string;
  created_at: number;   // epoch ms
  updated_at: number;   // epoch ms (replication checkpoint)
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
  device_id?: string;
}

export type RxOeeEvent = RxDocument<IOeeEvent>;

// ─── Sync Error (Dead Letter Queue) ─────────────────────────────────────────────

/**
 * Sync Error — quarantined event that failed server-side validation.
 * Stored locally for supervisor review and retry.
 */
export interface ISyncError {
  id: string;
  created_at: number;   // epoch ms
  updated_at: number;   // epoch ms
  is_deleted: boolean;
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
 * Stored in shared `signatures` RxDB collection across all form types.
 */
export interface ISignature {
  id: string;
  created_at: number;   // epoch ms
  updated_at: number;   // epoch ms (replication checkpoint)
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
  created_at: number;   // epoch ms
  updated_at: number;   // epoch ms (replication checkpoint)
  is_deleted: boolean;
  line_id: string;
  machine_id: string;
  shift_id: string;
  operator_id: string;
  batch_number: string;
  temp_superior: number;
  temp_media: number;
  temp_inferior: number;
  rpm: number;
  vapor_pressure: number;
  cacao_crudo_humidity: number;
  cacao_tostado_humidity: number;
  pesadas: number;
  silo: string;
  lotes: string;
  tiempo_muerto_min: number;
  tiempo_muerto_cause: string;
  inv_ini_cascarilla: number;
  inv_ini_polvillo: number;
  inv_ini_granilla: number;
  inv_ini_cacao_crudo: number;
  inv_ini_azucar: number;
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
  created_at: number;   // epoch ms
  updated_at: number;   // epoch ms (replication checkpoint)
  is_deleted: boolean;
  line_id: string;
  machine_id: string;
  shift_id: string;
  operator_id: string;
  batch_sequence: number;
  mezcladora: string;
  agitador: string;
  azucar_kg: number;
  licor_kg: number;
  cocoa_kg: number;
  grasa_vegetal_kg: number;
  lecitina_kg: number;
  reproceso_kg: number;
  viscosity_cps: number;
  discharge_temp: number;
  mezcladas: number;
  molidas: number;
  reproceso_total: number;
  desperdicio: number;
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
  created_at: number;   // epoch ms
  updated_at: number;   // epoch ms (replication checkpoint)
  is_deleted: boolean;
  line_id: string;
  machine_id: string;
  shift_id: string;
  operator_id: string;
  extractor_1_on: boolean;
  extractor_2_on: boolean;
  extractor_3_on: boolean;
  extractor_4_on: boolean;
  extractor_5_on: boolean;
  extractor_6_on: boolean;
  extractor_7_on: boolean;
  extractor_8_on: boolean;
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
  created_at: number;   // epoch ms
  updated_at: number;   // epoch ms (replication checkpoint)
  is_deleted: boolean;
  line_id: string;
  machine_id: string;
  shift_id: string;
  operator_id: string;
  orden: string;
  kit: string;
  semi_terminado: string;
  ingredients: Array<{
    name: string;
    lote: string;
    quantity_kg: number;
  }>;
  verif_produccion: boolean;
  verif_calidad: boolean;
  peso_bascula_kg: number;
  peso_fisico_kg: number;
}

export type RxVitaminKit = RxDocument<IVitaminKit>;

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 3: New Collections — Quality, Shifts, Operators
// ═══════════════════════════════════════════════════════════════════════════════

export type DispositionType = 'liberado' | 'rechazado' | 'reproceso';
export type ShiftType = 'matutino' | 'vespertino' | 'nocturno';
export type DataSourceType = 'vision' | 'manual' | 'hybrid';

// ─── Quality Inspections ─────────────────────────────────────────────────────────

/**
 * Quality Inspection — atomic QC check event aligned with IT-AC-09.
 *
 * Modelo basado en disposición (liberado/rechazado/reproceso) según
 * el formato F-AC-46 (Reporte de Desviación). Los defectos y pesos
 * se registran como hijos 1:N en defect_logs y weight_logs.
 *
 * - data_source: vision (cámaras GEMA-Vision), manual (analista), hybrid
 * - device_id: equipo de inspección para trazabilidad IoT
 * - created_at/updated_at: trazabilidad completa
 */
export interface IQualityInspection {
  id: string;
  created_at: number;   // epoch ms — cuándo se creó la inspección
  updated_at: number;   // epoch ms — última modificación
  is_deleted: boolean;
  machine_id: string;
  inspector_id: string;
  shift_type: ShiftType;
  disposition: DispositionType;
  notes?: string;
  data_source: DataSourceType;
  device_id: string;

  // ── Fields from the DB / Hasura schema ──────────────────────────────────────
  inspection_type: string;      // type of inspection (visual, weight, temp, metal_detector)
  passed: boolean;              // pass/fail result
  value: number;                // measured value
  unit: string;                 // unit of measurement
  standard_min?: number;        // weight standard lower limit (weight inspections)
  standard_max?: number;        // weight standard upper limit (weight inspections)
  standard_warning?: boolean;   // warning flag when standard is missing
  product_id: string;           // FK → products
  line_id: string;              // FK → lines
  shift_session_id: string;     // FK → shift_sessions
  operator_id: string;          // FK → operators
  defect_id?: string;           // FK → defect_logs (denormalized)
  defect_label?: string;        // denormalized defect label
  defect_severity?: string;     // denormalized defect severity
}

export type RxQualityInspection = RxDocument<IQualityInspection>;

// ─── Defect Log ─────────────────────────────────────────────────────────────────

/**
 * Defect Log — individual defect entry linked to a quality inspection (IT-AC-09).
 * Severity classification: critical (inocuidad), major, minor.
 * defect_type is free-text (no catalog dependency).
 */
export interface IDefectLog {
  id: string;
  created_at: number;   // epoch ms
  updated_at: number;   // epoch ms (replication checkpoint)
  is_deleted: boolean;
  inspection_id: string;
  severity: 'critical' | 'major' | 'minor';
  defect_type: string;
  defect_count: number;
  device_id: string;
}

export type RxDefectLog = RxDocument<IDefectLog>;

// ─── Weight Log ─────────────────────────────────────────────────────────────────

/**
 * Weight Log — individual weight measurement linked to a quality inspection.
 * Validated against product_weight_standards (IT-AC-09, tabla de pesos).
 */
export interface IWeightLog {
  id: string;
  created_at: number;   // epoch ms
  updated_at: number;   // epoch ms (replication checkpoint)
  is_deleted: boolean;
  inspection_id: string;
  measured_weight: number;
  device_id: string;
}

export type RxWeightLog = RxDocument<IWeightLog>;

// ─── Shift Sessions ──────────────────────────────────────────────────────────────

/**
 * Shift Session — tracks the lifecycle of a production shift.
 *
 * Fields match Hasura production schema:
 * - shift_type (matutino/vespertino/nocturno) instead of shift_id FK
 * - started_at/ended_at for shift boundaries
 * - planned_boxes + product_code from Epicor (migration 013)
 */
export interface IShiftSession {
  id: string;
  created_at: number;   // epoch ms
  updated_at: number;   // epoch ms (replication checkpoint)
  is_deleted: boolean;
  machine_id: string;
  operator_id: string;
  shift_type: ShiftType;
  status: 'active' | 'closed';
  started_at: number;
  ended_at?: number;
  planned_boxes?: number;
  product_code?: string;
  device_id: string;
}

export type RxShiftSession = RxDocument<IShiftSession>;

// ─── Operators ───────────────────────────────────────────────────────────────────

/**
 * Operator — reference table for production operators.
 * id IS the Epicor payroll code (natural key).
 */
export interface IOperator {
  id: string;
  created_at: number;   // epoch ms
  updated_at: number;   // epoch ms (replication checkpoint)
  is_deleted: boolean;
  full_name: string;
  is_active: boolean;
  device_id: string;
}

export type RxOperator = RxDocument<IOperator>;

// ─── Product Weight Standards ───────────────────────────────────────────────────

/**
 * Product Weight Standard — offline cache for weight validation (IT-AC-09).
 * Primary key is `sku` (natural key from Epicor).
 */
export interface IProductWeightStandard {
  sku: string;
  created_at: number;   // epoch ms
  updated_at: number;   // epoch ms (replication checkpoint)
  is_deleted: boolean;
  name: string;
  lower_limit: number;
  upper_limit: number;
  requires_tare: boolean;
  device_id: string;
}

export type RxProductWeightStandard = RxDocument<IProductWeightStandard>;

// ═══════════════════════════════════════════════════════════════════════════════
// Downtime Conciliation — Phase: downtime-conciliation
// ═══════════════════════════════════════════════════════════════════════════════

export type ConciliationStatus = 'pending' | 'reconciled' | 'disputed' | 'escalated';

/**
 * Department Verdict — individual department's sign-off on a conciliation.
 * Each involved department must submit a verdict (agree or dispute) before
 * the conciliation can move to 'reconciled' or 'escalated'.
 */
export interface IDepartmentVerdict {
  department: string;       // e.g., "MTTO", "CALIDAD", "LOGISTICA"
  agreed: boolean;          // true = accept, false = dispute
  notes?: string;           // optional explanation
  signed_by: string;        // user ID who signed
  signed_at: number;        // epoch ms
}

/**
 * Corrective Action — action plan to prevent recurrence of a root cause.
 * Aligned with IT-AC-09 and ISO 9001 corrective action requirements.
 */
export interface ICorrectiveAction {
  description: string;      // what needs to be done
  responsible: string;      // person/role responsible
  department: string;       // owning department
  due_date: number;         // epoch ms — deadline
  status: 'open' | 'in_progress' | 'completed';
}

/**
 * Downtime Conciliation — bridges Production downtime events with Maintenance action.
 *
 * When an operator flags a paro with an MTTO reason, a conciliation record is created.
 * The supervisor reviews at shift-end, diagnoses root cause, and triggers OT via cmms-ibero.
 */
export interface IDowntimeConciliation {
  id: string;
  created_at: number;   // epoch ms
  updated_at: number;   // epoch ms (replication checkpoint)
  is_deleted: boolean;
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

  conciliation_notes?: string;
  status: ConciliationStatus;

  // OT tracking
  ot_sent: boolean;              // whether oee-trigger was called
  ot_response?: string;          // response from oee-trigger (WO id or error)
  ot_sent_at?: number;

  is_mtto: boolean;              // whether the original reason is MTTO category
  device_id: string;

  // ── Wave 5: RCA + Multi-Department Verdicts ────────────────────────────────

  /** Departments involved in this downtime event (derived from reason_code mapping) */
  involved_departments: string[];           // e.g. ["MTTO", "CALIDAD"]
  /** Per-department verdicts — one entry per involved department */
  verdicts: IDepartmentVerdict[];            // empty until departments sign
  /** RCA method: 5 Whys or Ishikawa diagram */
  analysis_method?: '5whys' | 'ishikawa';
  /** 5 Whys individual fields (flat fields for RxDB compatibility) */
  why_1?: string;
  why_2?: string;
  why_3?: string;
  why_4?: string;
  why_5?: string;
  /** Final root cause summary */
  root_cause?: string;
  /** Corrective action plan to prevent recurrence */
  corrective_action?: ICorrectiveAction;
  /** Epoch ms deadline for escalation (created_at + escalation_hours config) */
  escalation_deadline: number;
  /** Epoch ms when escalation was triggered */
  escalated_at?: number;
  /** Escalation target (manager / department head) */
  escalated_to?: string;
}

export type RxDowntimeConciliation = RxDocument<IDowntimeConciliation>;

/**
 * Plant Config — key-value configuration for plant-level parameters.
 *
 * First key: micro_stop_threshold_min (integer, minutes).
 */
export interface IPlantConfig {
  key: string;         // e.g., 'micro_stop_threshold_min'
  created_at: number;  // epoch ms
  updated_at: number;  // epoch ms (replication checkpoint)
  is_deleted: boolean;
  value: string;       // stored as string, parsed by consumer (e.g., '5')
  description?: string;
  device_id: string;
}

export type RxPlantConfig = RxDocument<IPlantConfig>;

/**
 * Shift Summary — cached aggregates for shift-end reporting.
 * Materialized at shift-end. Non-authoritative — always derivable from oee_events.
 */
export interface IShiftSummary {
  id: string;
  created_at: number;   // epoch ms
  updated_at: number;   // epoch ms (replication checkpoint)
  is_deleted: boolean;
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
  device_id: string;

  // ── Wave 5: Stop Classification ─────────────────────────────────────────────

  /** Per-stop classification from shift close screen */
  classified_stops?: Array<{
    oee_event_id: string;
    classification: 'planned' | 'unplanned';
    explained_missing_boxes?: number;
    notes?: string;
  }>;
}

export type RxShiftSummary = RxDocument<IShiftSummary>;

// ═══════════════════════════════════════════════════════════════════════════════
// Quality-OEE Adapter — conectar-calidad-oee
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Quality Data Provider — interface for providing rejected quantity data
 * from quality inspections to the OEE calculator.
 *
 * Pattern: Adapter / Dependency Inversion
 * Why: Decouples OEE calculation from the quality data source.
 * The concrete implementation reads from RxDB; tests use a mock.
 */
export interface IQualityDataProvider {
  getRejectedQuantity(shiftSessionId: string): Promise<number>;
}
