/**
 * DTO (Data Transfer Object) mappers between RxDB local schema and Nhost GraphQL schema.
 *
 * Pattern: Adapter / Mapper
 * Why:
 * - RxDB/TypeScript uses camelCase property names
 * - GraphQL/Hasura uses snake_case field names
 * - The mapper functions translate between the two formats without leaking
 *   the network schema into local business logic
 *
 * Timestamp mapping:
 * - Local RxDB uses `created_at` and `updated_at` (epoch ms numbers)
 * - Backend Hasura columns may still use `client_updated_at` (BIGINT string)
 * - Mappers handle the local↔backend conversion:
 *   - toGraphQL: local `updated_at` → backend `client_updated_at` (replication checkpoint)
 *   - fromGraphQL: backend `client_updated_at` → local `updated_at`; `created_at` defaults to same value
 *
 * This ensures the local domain model (IAsset, etc.) is never contaminated
 * by network-level naming conventions.
 */

import type {
  IAsset, IAssetType, IWorkOrder, IReport, IOeeEvent,
  ISignature, IToasterLog, IMixingBatch, IExtractorCheck, IVitaminKit,
  IQualityInspection, IDefectLog, IWeightLog,
  IShiftSession, IOperator, IProductWeightStandard,
  IDowntimeConciliation, IPlantConfig, IShiftSummary,
} from '../core/types';

// ─── Asset Mappers ─────────────────────────────────────────────────────────────

/**
 * GraphQL representation of an Asset as returned by Hasura.
 * snake_case field names, client_updated_at as BIGINT string.
 *
 * NOTE: Backend column names stay as `client_updated_at` and `deleted`
 * until Phase 3 backend migrations. The DTO maps between these and
 * the local `created_at`/`updated_at`/`is_deleted` fields.
 */
export interface GraphQLAsset {
  id: string;
  name: string;
  type_id: string;
  status: string;
  location?: string;
  serial_number?: string;
  manufacturer?: string;
  model_number?: string;
  in_service_date?: string; // BIGINT as string from Hasura
  warranty_expiration?: string;
  client_updated_at: string; // BIGINT as string from Hasura (maps to local updated_at)
  deleted: boolean;
}

/**
 * Maps a local RxDB asset to GraphQL input format (snake_case).
 * Used by the push (upsert) handler in sync.ts.
 *
 * @param {IAsset} asset - Local RxDB asset document
 * @returns {Record<string, unknown>} GraphQL-compatible input object
 */
export function toGraphQLAsset(asset: IAsset): Record<string, unknown> {
  return {
    id: asset.id,
    name: asset.name,
    type_id: asset.type_id,
    status: asset.status,
    location: asset.location,
    serial_number: asset.serial_number,
    manufacturer: asset.manufacturer,
    model_number: asset.model_number,
    // Convert epoch ms to BIGINT string for Hasura
    in_service_date: asset.in_service_date?.toString(),
    warranty_expiration: asset.warranty_expiration?.toString(),
    // updated_at maps to backend client_updated_at (replication checkpoint)
    client_updated_at: asset.updated_at.toString(),
    deleted: asset.is_deleted,
  };
}

/**
 * Maps a GraphQL asset response to local RxDB format (camelCase).
 * Used by the pull handler in sync.ts to convert server docs before RxDB insertion.
 *
 * @param {GraphQLAsset} gql - Raw GraphQL response from Hasura
 * @returns {IAsset} Local RxDB-compatible asset document
 */
export function fromGraphQLAsset(gql: GraphQLAsset): IAsset {
  const updatedAt = parseInt(gql.client_updated_at, 10);
  return {
    id: gql.id,
    name: gql.name,
    type_id: gql.type_id,
    status: gql.status as IAsset['status'],
    location: gql.location,
    serial_number: gql.serial_number,
    manufacturer: gql.manufacturer,
    model_number: gql.model_number,
    // Convert BIGINT string back to epoch ms number
    in_service_date: gql.in_service_date ? parseInt(gql.in_service_date, 10) : undefined,
    warranty_expiration: gql.warranty_expiration
      ? parseInt(gql.warranty_expiration, 10)
      : undefined,
    // Backend only has a single timestamp; use it for both locally
    created_at: updatedAt,
    updated_at: updatedAt,
    is_deleted: gql.deleted,
  };
}

// ─── Asset Type Mappers ────────────────────────────────────────────────────────

export interface GraphQLAssetType {
  id: string;
  code: string;
  description: string;
  is_active: boolean;
  client_updated_at: string;
  deleted: boolean;
}

export function toGraphQLAssetType(at: IAssetType): Record<string, unknown> {
  return {
    id: at.id,
    code: at.code,
    description: at.description,
    is_active: at.is_active,
    client_updated_at: at.updated_at.toString(),
    deleted: at.is_deleted,
  };
}

export function fromGraphQLAssetType(gql: GraphQLAssetType): IAssetType {
  const updatedAt = parseInt(gql.client_updated_at, 10);
  return {
    id: gql.id,
    code: gql.code,
    description: gql.description,
    is_active: gql.is_active,
    created_at: updatedAt,
    updated_at: updatedAt,
    is_deleted: gql.deleted,
  };
}

// ─── Work Order Mappers ────────────────────────────────────────────────────────

/**
 * GraphQL representation of a Work Order as returned by Hasura.
 */
export interface GraphQLWorkOrder {
  id: string;
  equipment_id: string;
  description: string;
  status: string;
  priority: string;
  assigned_to?: string;
  scheduled_date?: string;
  completed_date?: string;
  client_updated_at: string;
  deleted: boolean;

  // wo-lifecycle-outbox: campos desde cmms-ibero
  lifecycle_phase?: string;
  symptom_note?: string;
  cause_note?: string;
  action_note?: string;
  actual_start_at?: string;    // TIMESTAMPTZ → ISO 8601 string from Hasura
  completed_at?: string;       // TIMESTAMPTZ → ISO 8601 string from Hasura
  cmms_wo_id?: string;
}

/**
 * Maps a local RxDB work order to GraphQL input format (snake_case).
 */
export function toGraphQLWorkOrder(wo: IWorkOrder): Record<string, unknown> {
  return {
    id: wo.id,
    equipment_id: wo.equipment_id,
    description: wo.description,
    status: wo.status,
    priority: wo.priority,
    assigned_to: wo.assigned_to,
    scheduled_date: wo.scheduled_date?.toString(),
    completed_date: wo.completed_date?.toString(),
    client_updated_at: wo.updated_at.toString(),
    deleted: wo.is_deleted,

    lifecycle_phase: wo.lifecycle_phase,
    symptom_note: wo.symptom_note,
    cause_note: wo.cause_note,
    action_note: wo.action_note,
    actual_start_at: wo.actual_start_at ? new Date(wo.actual_start_at).toISOString() : undefined,
    completed_at: wo.completed_at ? new Date(wo.completed_at).toISOString() : undefined,
    cmms_wo_id: wo.cmms_wo_id,
  };
}

/**
 * Maps a GraphQL work order response to local RxDB format (camelCase).
 */
export function fromGraphQLWorkOrder(gql: GraphQLWorkOrder): IWorkOrder {
  const updatedAt = parseInt(gql.client_updated_at, 10);
  return {
    id: gql.id,
    equipment_id: gql.equipment_id,
    description: gql.description,
    status: gql.status as IWorkOrder['status'],
    priority: gql.priority as IWorkOrder['priority'],
    assigned_to: gql.assigned_to,
    scheduled_date: gql.scheduled_date ? parseInt(gql.scheduled_date, 10) : undefined,
    completed_date: gql.completed_date ? parseInt(gql.completed_date, 10) : undefined,
    created_at: updatedAt,
    updated_at: updatedAt,
    is_deleted: gql.deleted,

    lifecycle_phase: gql.lifecycle_phase,
    symptom_note: gql.symptom_note,
    cause_note: gql.cause_note,
    action_note: gql.action_note,
    actual_start_at: gql.actual_start_at ? new Date(gql.actual_start_at).getTime() : undefined,
    completed_at: gql.completed_at ? new Date(gql.completed_at).getTime() : undefined,
    cmms_wo_id: gql.cmms_wo_id,
  };
}

// ─── Report Mappers ────────────────────────────────────────────────────────────

/**
 * GraphQL representation of a Report as returned by Hasura.
 */
export interface GraphQLReport {
  id: string;
  updated_at: string; // BIGINT as string from Hasura
  deleted: boolean;
  template_id: string;
  data: {
    line_id: string;
    total_pieces: number;
    rejected_pieces: number;
    downtime_minutes: number;
  };
}

/**
 * Maps a local RxDB report to GraphQL input format (snake_case).
 */
export function toGraphQLReport(report: IReport): Record<string, unknown> {
  return {
    id: report.id,
    updated_at: report.updated_at.toString(),
    deleted: report.is_deleted,
    template_id: report.template_id,
    data: report.data,
  };
}

/**
 * Maps a GraphQL report response to local RxDB format (camelCase).
 */
export function fromGraphQLReport(gql: GraphQLReport): IReport {
  const updatedAt = parseInt(gql.updated_at, 10);
  return {
    id: gql.id,
    created_at: updatedAt,
    updated_at: updatedAt,
    is_deleted: gql.deleted,
    template_id: gql.template_id,
    data: gql.data,
  };
}

// ─── OEE Event Mappers ─────────────────────────────────────────────────────────

export interface GraphQLOeeEvent {
  id: string;
  updated_at: string; // BIGINT as string
  deleted: boolean;
  line_id: string;
  machine_id: string;
  operator_id?: string;
  shift_id: string;
  event_type: string;
  timestamp: string; // BIGINT as string
  reason_code?: string;
  quantity?: number;
  planned_boxes?: number;
  notes?: string;
  is_retroactive?: boolean;
  related_event_id?: string;
  device_id?: string; // optional — not all events require device tracking
}

export function toGraphQLOeeEvent(event: IOeeEvent): Record<string, unknown> {
  return {
    id: event.id,
    updated_at: event.updated_at.toString(),
    deleted: event.is_deleted,
    line_id: event.line_id,
    machine_id: event.machine_id,
    operator_id: event.operator_id,
    shift_id: event.shift_id,
    event_type: event.event_type,
    timestamp: event.timestamp.toString(),
    reason_code: event.reason_code,
    quantity: event.quantity,
    planned_boxes: event.planned_boxes,
    notes: event.notes,
    is_retroactive: event.is_retroactive,
    related_event_id: event.related_event_id,
    device_id: event.device_id,
  };
}

export function fromGraphQLOeeEvent(gql: GraphQLOeeEvent): IOeeEvent {
  const updatedAt = parseInt(gql.updated_at, 10);
  return {
    id: gql.id,
    created_at: updatedAt,
    updated_at: updatedAt,
    is_deleted: gql.deleted,
    line_id: gql.line_id,
    machine_id: gql.machine_id,
    operator_id: gql.operator_id,
    shift_id: gql.shift_id,
    event_type: gql.event_type as IOeeEvent['event_type'],
    timestamp: parseInt(gql.timestamp, 10),
    reason_code: gql.reason_code,
    quantity: gql.quantity,
    planned_boxes: gql.planned_boxes,
    notes: gql.notes,
    is_retroactive: gql.is_retroactive,
    related_event_id: gql.related_event_id,
    device_id: gql.device_id,
  };
}

// ─── Signature Mappers ──────────────────────────────────────────────────────────

/**
 * GraphQL representation of a Signature as returned by Hasura.
 */
export interface GraphQLSignature {
  id: string;
  document_type: string;
  document_id: string;
  signer_id?: string;
  signer_name?: string;
  signer_role?: string;
  signed_at: string; // BIGINT as string
  sequence: number;
  is_deleted: boolean;
  created_at: string; // BIGINT as string
  updated_at: string; // BIGINT as string
}

/**
 * Maps a local RxDB signature to GraphQL input format (snake_case).
 */
export function toGraphQLSignature(sig: ISignature): Record<string, unknown> {
  return {
    id: sig.id,
    document_type: sig.document_type,
    document_id: sig.document_id,
    signer_id: sig.signer_id,
    signer_name: sig.signer_name,
    signer_role: sig.signer_role,
    signed_at: sig.signed_at.toString(),
    sequence: sig.sequence,
    is_deleted: sig.is_deleted,
    created_at: sig.created_at.toString(),
    updated_at: sig.updated_at.toString(),
  };
}

/**
 * Maps a GraphQL signature response to local RxDB format (camelCase).
 */
export function fromGraphQLSignature(gql: GraphQLSignature): ISignature {
  return {
    id: gql.id,
    document_type: gql.document_type,
    document_id: gql.document_id,
    signer_id: gql.signer_id ?? '',
    signer_name: gql.signer_name ?? '',
    signer_role: gql.signer_role ?? '',
    signed_at: parseInt(gql.signed_at, 10),
    sequence: gql.sequence,
    created_at: parseInt(gql.created_at, 10),
    updated_at: parseInt(gql.updated_at, 10),
    is_deleted: gql.is_deleted,
  };
}

// ─── Quality Inspection Mappers ─────────────────────────────────────────────────

/**
 * GraphQL representation of a Quality Inspection as returned by Hasura.
 * NOTE: Backend schema (migration 008) differs from local RxDB schema.
 * Fields without a backend equivalent default to sensible values.
 */
export interface GraphQLQualityInspection {
  id: string;
  machine_id: string;
  inspector_id: string;
  shift_type: string;
  disposition: string;
  notes?: string;
  data_source: string;
  updated_at: string; // TIMESTAMPTZ → ISO 8601 string from Hasura
}

/**
 * Maps a local RxDB quality inspection to GraphQL input format.
 * Local fields not in backend (machine_id, inspection_type, value, unit,
 * defect_*, standard_*) are omitted from the push payload.
 */
export function toGraphQLQualityInspection(qi: IQualityInspection): Record<string, unknown> {
  return {
    id: qi.id,
    machine_id: qi.machine_id,
    inspector_id: qi.inspector_id,
    shift_type: qi.shift_type,
    disposition: qi.disposition,
    notes: qi.notes,
    data_source: qi.data_source,
    updated_at: new Date(qi.updated_at).toISOString(),
  };
}

/**
 * Maps a GraphQL quality inspection response to local RxDB format.
 * Backend returns fewer fields; local extras default to safe initial values.
 */
export function fromGraphQLQualityInspection(gql: GraphQLQualityInspection): IQualityInspection {
  const updatedAt = new Date(gql.updated_at).getTime();
  return {
    id: gql.id,
    machine_id: gql.machine_id,
    inspector_id: gql.inspector_id,
    shift_type: gql.shift_type as IQualityInspection['shift_type'],
    disposition: gql.disposition as IQualityInspection['disposition'],
    notes: gql.notes,
    data_source: gql.data_source as IQualityInspection['data_source'],
    created_at: updatedAt,
    updated_at: updatedAt,
    device_id: '',
    is_deleted: false,
    inspection_type: '',
    passed: false,
    value: 0,
    unit: '',
    product_id: '',
    line_id: '',
    shift_session_id: '',
    operator_id: '',
  };
}

// ─── Defect Log Mappers ─────────────────────────────────────────────────────────

/**
 * GraphQL representation of a Defect Log as returned by Hasura.
 */
export interface GraphQLDefectLog {
  id: string;
  inspection_id: string;
  severity: string;
  defect_type: string;
  defect_count: number;
  updated_at: string; // TIMESTAMPTZ → ISO 8601
}

export function toGraphQLDefectLog(dl: IDefectLog): Record<string, unknown> {
  return {
    id: dl.id,
    inspection_id: dl.inspection_id,
    severity: dl.severity,
    defect_type: dl.defect_type,
    defect_count: dl.defect_count,
    updated_at: new Date(dl.updated_at).toISOString(),
  };
}

export function fromGraphQLDefectLog(gql: GraphQLDefectLog): IDefectLog {
  const updatedAt = new Date(gql.updated_at).getTime();
  return {
    id: gql.id,
    inspection_id: gql.inspection_id,
    severity: gql.severity as IDefectLog['severity'],
    defect_type: gql.defect_type,
    defect_count: gql.defect_count,
    created_at: updatedAt,
    updated_at: updatedAt,
    device_id: '',
    is_deleted: false,
  };
}

// ─── Toaster Log Mappers ────────────────────────────────────────────────────────

/**
 * GraphQL representation of a Toaster Log as returned by Hasura.
 */
export interface GraphQLToasterLog {
  id: string;
  line_id: string;
  machine_id: string;
  shift_id: string;
  operator_id: string;
  created_at: string; // BIGINT as string
  updated_at: string; // BIGINT as string
  is_deleted: boolean;
  batch_number: string;
  temp_superior?: number;
  temp_media?: number;
  temp_inferior?: number;
  rpm?: number;
  vapor_pressure?: number;
  cacao_crudo_humidity?: number;
  cacao_tostado_humidity?: number;
  pesadas?: number;
  silo?: string;
  lotes?: string;
  tiempo_muerto_min?: number;
  tiempo_muerto_cause?: string;
  inv_ini_cascarilla?: number;
  inv_ini_polvillo?: number;
  inv_ini_granilla?: number;
  inv_ini_cacao_crudo?: number;
  inv_ini_azucar?: number;
  inv_fin_cascarilla?: number;
  inv_fin_polvillo?: number;
  inv_fin_granilla?: number;
  inv_fin_cacao_crudo?: number;
  inv_fin_azucar?: number;
}

/**
 * Maps a local RxDB toaster log to GraphQL input format.
 */
export function toGraphQLToasterLog(log: IToasterLog): Record<string, unknown> {
  return {
    id: log.id,
    line_id: log.line_id,
    machine_id: log.machine_id,
    shift_id: log.shift_id,
    operator_id: log.operator_id,
    created_at: log.created_at.toString(),
    updated_at: log.updated_at.toString(),
    is_deleted: log.is_deleted,
    batch_number: log.batch_number,
    temp_superior: log.temp_superior,
    temp_media: log.temp_media,
    temp_inferior: log.temp_inferior,
    rpm: log.rpm,
    vapor_pressure: log.vapor_pressure,
    cacao_crudo_humidity: log.cacao_crudo_humidity,
    cacao_tostado_humidity: log.cacao_tostado_humidity,
    pesadas: log.pesadas,
    silo: log.silo,
    lotes: log.lotes,
    tiempo_muerto_min: log.tiempo_muerto_min,
    tiempo_muerto_cause: log.tiempo_muerto_cause,
    inv_ini_cascarilla: log.inv_ini_cascarilla,
    inv_ini_polvillo: log.inv_ini_polvillo,
    inv_ini_granilla: log.inv_ini_granilla,
    inv_ini_cacao_crudo: log.inv_ini_cacao_crudo,
    inv_ini_azucar: log.inv_ini_azucar,
    inv_fin_cascarilla: log.inv_fin_cascarilla,
    inv_fin_polvillo: log.inv_fin_polvillo,
    inv_fin_granilla: log.inv_fin_granilla,
    inv_fin_cacao_crudo: log.inv_fin_cacao_crudo,
    inv_fin_azucar: log.inv_fin_azucar,
  };
}

/**
 * Maps a GraphQL toaster log response to local RxDB format.
 */
export function fromGraphQLToasterLog(gql: GraphQLToasterLog): IToasterLog {
  return {
    id: gql.id,
    line_id: gql.line_id,
    machine_id: gql.machine_id,
    shift_id: gql.shift_id,
    operator_id: gql.operator_id,
    created_at: parseInt(gql.created_at, 10),
    updated_at: parseInt(gql.updated_at, 10),
    is_deleted: gql.is_deleted,
    batch_number: gql.batch_number,
    temp_superior: gql.temp_superior ?? 0,
    temp_media: gql.temp_media ?? 0,
    temp_inferior: gql.temp_inferior ?? 0,
    rpm: gql.rpm ?? 0,
    vapor_pressure: gql.vapor_pressure ?? 0,
    cacao_crudo_humidity: gql.cacao_crudo_humidity ?? 0,
    cacao_tostado_humidity: gql.cacao_tostado_humidity ?? 0,
    pesadas: gql.pesadas ?? 0,
    silo: gql.silo ?? '',
    lotes: gql.lotes ?? '',
    tiempo_muerto_min: gql.tiempo_muerto_min ?? 0,
    tiempo_muerto_cause: gql.tiempo_muerto_cause ?? '',
    inv_ini_cascarilla: gql.inv_ini_cascarilla ?? 0,
    inv_ini_polvillo: gql.inv_ini_polvillo ?? 0,
    inv_ini_granilla: gql.inv_ini_granilla ?? 0,
    inv_ini_cacao_crudo: gql.inv_ini_cacao_crudo ?? 0,
    inv_ini_azucar: gql.inv_ini_azucar ?? 0,
    inv_fin_cascarilla: gql.inv_fin_cascarilla ?? 0,
    inv_fin_polvillo: gql.inv_fin_polvillo ?? 0,
    inv_fin_granilla: gql.inv_fin_granilla ?? 0,
    inv_fin_cacao_crudo: gql.inv_fin_cacao_crudo ?? 0,
    inv_fin_azucar: gql.inv_fin_azucar ?? 0,
  };
}

// ─── Mixing Batch Mappers ───────────────────────────────────────────────────────

/**
 * GraphQL representation of a Mixing Batch as returned by Hasura.
 */
export interface GraphQLMixingBatch {
  id: string;
  line_id: string;
  machine_id: string;
  shift_id: string;
  operator_id: string;
  created_at: string; // BIGINT as string
  updated_at: string; // BIGINT as string
  is_deleted: boolean;
  batch_sequence: number;
  mezcladora?: string;
  agitador?: string;
  azucar_kg?: number;
  licor_kg?: number;
  cocoa_kg?: number;
  grasa_vegetal_kg?: number;
  lecitina_kg?: number;
  reproceso_kg?: number;
  viscosity_cps?: number;
  discharge_temp?: number;
  mezcladas?: number;
  molidas?: number;
  reproceso_total?: number;
  desperdicio?: number;
  inv_ini_azucar?: number;
  inv_ini_licor?: number;
  inv_ini_cocoa?: number;
  inv_ini_grasa_vegetal?: number;
  inv_ini_lecitina?: number;
  inv_ini_reproceso?: number;
  inv_fin_azucar?: number;
  inv_fin_licor?: number;
  inv_fin_cocoa?: number;
  inv_fin_grasa_vegetal?: number;
  inv_fin_lecitina?: number;
  inv_fin_reproceso?: number;
  consumo_azucar?: number;
  consumo_licor?: number;
  consumo_cocoa?: number;
  consumo_grasa_vegetal?: number;
  consumo_lecitina?: number;
  consumo_reproceso?: number;
}

/**
 * Maps a local RxDB mixing batch to GraphQL input format.
 */
export function toGraphQLMixingBatch(batch: IMixingBatch): Record<string, unknown> {
  return {
    id: batch.id,
    line_id: batch.line_id,
    machine_id: batch.machine_id,
    shift_id: batch.shift_id,
    operator_id: batch.operator_id,
    created_at: batch.created_at.toString(),
    updated_at: batch.updated_at.toString(),
    is_deleted: batch.is_deleted,
    batch_sequence: batch.batch_sequence,
    mezcladora: batch.mezcladora,
    agitador: batch.agitador,
    azucar_kg: batch.azucar_kg,
    licor_kg: batch.licor_kg,
    cocoa_kg: batch.cocoa_kg,
    grasa_vegetal_kg: batch.grasa_vegetal_kg,
    lecitina_kg: batch.lecitina_kg,
    reproceso_kg: batch.reproceso_kg,
    viscosity_cps: batch.viscosity_cps,
    discharge_temp: batch.discharge_temp,
    mezcladas: batch.mezcladas,
    molidas: batch.molidas,
    reproceso_total: batch.reproceso_total,
    desperdicio: batch.desperdicio,
    inv_ini_azucar: batch.inv_ini_azucar,
    inv_ini_licor: batch.inv_ini_licor,
    inv_ini_cocoa: batch.inv_ini_cocoa,
    inv_ini_grasa_vegetal: batch.inv_ini_grasa_vegetal,
    inv_ini_lecitina: batch.inv_ini_lecitina,
    inv_ini_reproceso: batch.inv_ini_reproceso,
    inv_fin_azucar: batch.inv_fin_azucar,
    inv_fin_licor: batch.inv_fin_licor,
    inv_fin_cocoa: batch.inv_fin_cocoa,
    inv_fin_grasa_vegetal: batch.inv_fin_grasa_vegetal,
    inv_fin_lecitina: batch.inv_fin_lecitina,
    inv_fin_reproceso: batch.inv_fin_reproceso,
    consumo_azucar: batch.consumo_azucar,
    consumo_licor: batch.consumo_licor,
    consumo_cocoa: batch.consumo_cocoa,
    consumo_grasa_vegetal: batch.consumo_grasa_vegetal,
    consumo_lecitina: batch.consumo_lecitina,
    consumo_reproceso: batch.consumo_reproceso,
  };
}

/**
 * Maps a GraphQL mixing batch response to local RxDB format.
 */
export function fromGraphQLMixingBatch(gql: GraphQLMixingBatch): IMixingBatch {
  return {
    id: gql.id,
    line_id: gql.line_id,
    machine_id: gql.machine_id,
    shift_id: gql.shift_id,
    operator_id: gql.operator_id,
    created_at: parseInt(gql.created_at, 10),
    updated_at: parseInt(gql.updated_at, 10),
    is_deleted: gql.is_deleted,
    batch_sequence: gql.batch_sequence,
    mezcladora: gql.mezcladora ?? '',
    agitador: gql.agitador ?? '',
    azucar_kg: gql.azucar_kg ?? 0,
    licor_kg: gql.licor_kg ?? 0,
    cocoa_kg: gql.cocoa_kg ?? 0,
    grasa_vegetal_kg: gql.grasa_vegetal_kg ?? 0,
    lecitina_kg: gql.lecitina_kg ?? 0,
    reproceso_kg: gql.reproceso_kg ?? 0,
    viscosity_cps: gql.viscosity_cps ?? 0,
    discharge_temp: gql.discharge_temp ?? 0,
    mezcladas: gql.mezcladas ?? 0,
    molidas: gql.molidas ?? 0,
    reproceso_total: gql.reproceso_total ?? 0,
    desperdicio: gql.desperdicio ?? 0,
    inv_ini_azucar: gql.inv_ini_azucar ?? 0,
    inv_ini_licor: gql.inv_ini_licor ?? 0,
    inv_ini_cocoa: gql.inv_ini_cocoa ?? 0,
    inv_ini_grasa_vegetal: gql.inv_ini_grasa_vegetal ?? 0,
    inv_ini_lecitina: gql.inv_ini_lecitina ?? 0,
    inv_ini_reproceso: gql.inv_ini_reproceso ?? 0,
    inv_fin_azucar: gql.inv_fin_azucar ?? 0,
    inv_fin_licor: gql.inv_fin_licor ?? 0,
    inv_fin_cocoa: gql.inv_fin_cocoa ?? 0,
    inv_fin_grasa_vegetal: gql.inv_fin_grasa_vegetal ?? 0,
    inv_fin_lecitina: gql.inv_fin_lecitina ?? 0,
    inv_fin_reproceso: gql.inv_fin_reproceso ?? 0,
    consumo_azucar: gql.consumo_azucar ?? 0,
    consumo_licor: gql.consumo_licor ?? 0,
    consumo_cocoa: gql.consumo_cocoa ?? 0,
    consumo_grasa_vegetal: gql.consumo_grasa_vegetal ?? 0,
    consumo_lecitina: gql.consumo_lecitina ?? 0,
    consumo_reproceso: gql.consumo_reproceso ?? 0,
  };
}

// ─── Extractor Check Mappers ────────────────────────────────────────────────────

/**
 * GraphQL representation of an Extractor Check as returned by Hasura.
 */
export interface GraphQLExtractorCheck {
  id: string;
  line_id: string;
  machine_id: string;
  shift_id: string;
  operator_id: string;
  created_at: string; // BIGINT as string
  updated_at: string; // BIGINT as string
  is_deleted: boolean;
  extractor_1_on: boolean;
  extractor_2_on: boolean;
  extractor_3_on: boolean;
  extractor_4_on: boolean;
  extractor_5_on: boolean;
  extractor_6_on: boolean;
  extractor_7_on: boolean;
  extractor_8_on: boolean;
  cedazo_tt_last_cleaning?: string; // BIGINT as string
}

/**
 * Maps a local RxDB extractor check to GraphQL input format.
 */
export function toGraphQLExtractorCheck(check: IExtractorCheck): Record<string, unknown> {
  return {
    id: check.id,
    line_id: check.line_id,
    machine_id: check.machine_id,
    shift_id: check.shift_id,
    operator_id: check.operator_id,
    created_at: check.created_at.toString(),
    updated_at: check.updated_at.toString(),
    is_deleted: check.is_deleted,
    extractor_1_on: check.extractor_1_on,
    extractor_2_on: check.extractor_2_on,
    extractor_3_on: check.extractor_3_on,
    extractor_4_on: check.extractor_4_on,
    extractor_5_on: check.extractor_5_on,
    extractor_6_on: check.extractor_6_on,
    extractor_7_on: check.extractor_7_on,
    extractor_8_on: check.extractor_8_on,
    cedazo_tt_last_cleaning: check.cedazo_tt_last_cleaning?.toString(),
  };
}

/**
 * Maps a GraphQL extractor check response to local RxDB format.
 */
export function fromGraphQLExtractorCheck(gql: GraphQLExtractorCheck): IExtractorCheck {
  return {
    id: gql.id,
    line_id: gql.line_id,
    machine_id: gql.machine_id,
    shift_id: gql.shift_id,
    operator_id: gql.operator_id,
    created_at: parseInt(gql.created_at, 10),
    updated_at: parseInt(gql.updated_at, 10),
    is_deleted: gql.is_deleted,
    extractor_1_on: gql.extractor_1_on,
    extractor_2_on: gql.extractor_2_on,
    extractor_3_on: gql.extractor_3_on,
    extractor_4_on: gql.extractor_4_on,
    extractor_5_on: gql.extractor_5_on,
    extractor_6_on: gql.extractor_6_on,
    extractor_7_on: gql.extractor_7_on,
    extractor_8_on: gql.extractor_8_on,
    cedazo_tt_last_cleaning: gql.cedazo_tt_last_cleaning ? parseInt(gql.cedazo_tt_last_cleaning, 10) : 0,
  };
}

// ─── Vitamin Kit Mappers ────────────────────────────────────────────────────────

/**
 * GraphQL representation of a Vitamin Kit as returned by Hasura.
 * ingredients is stored as JSONB in the backend and passed through as-is.
 */
export interface GraphQLVitaminKit {
  id: string;
  line_id: string;
  machine_id: string;
  shift_id: string;
  operator_id: string;
  created_at: string; // BIGINT as string
  updated_at: string; // BIGINT as string
  is_deleted: boolean;
  orden: string;
  kit: string;
  semi_terminado: string;
  ingredients: Array<{ name: string; lote: string; quantity_kg: number }>;
  verif_produccion: boolean;
  verif_calidad: boolean;
  peso_bascula_kg?: number;
  peso_fisico_kg?: number;
}

/**
 * Maps a local RxDB vitamin kit to GraphQL input format.
 */
export function toGraphQLVitaminKit(kit: IVitaminKit): Record<string, unknown> {
  return {
    id: kit.id,
    line_id: kit.line_id,
    machine_id: kit.machine_id,
    shift_id: kit.shift_id,
    operator_id: kit.operator_id,
    created_at: kit.created_at.toString(),
    updated_at: kit.updated_at.toString(),
    is_deleted: kit.is_deleted,
    orden: kit.orden,
    kit: kit.kit,
    semi_terminado: kit.semi_terminado,
    ingredients: kit.ingredients,
    verif_produccion: kit.verif_produccion,
    verif_calidad: kit.verif_calidad,
    peso_bascula_kg: kit.peso_bascula_kg,
    peso_fisico_kg: kit.peso_fisico_kg,
  };
}

/**
 * Maps a GraphQL vitamin kit response to local RxDB format.
 */
export function fromGraphQLVitaminKit(gql: GraphQLVitaminKit): IVitaminKit {
  return {
    id: gql.id,
    line_id: gql.line_id,
    machine_id: gql.machine_id,
    shift_id: gql.shift_id,
    operator_id: gql.operator_id,
    created_at: parseInt(gql.created_at, 10),
    updated_at: parseInt(gql.updated_at, 10),
    is_deleted: gql.is_deleted,
    orden: gql.orden,
    kit: gql.kit,
    semi_terminado: gql.semi_terminado,
    ingredients: gql.ingredients,
    verif_produccion: gql.verif_produccion,
    verif_calidad: gql.verif_calidad,
    peso_bascula_kg: gql.peso_bascula_kg ?? 0,
    peso_fisico_kg: gql.peso_fisico_kg ?? 0,
  };
}

// ─── Weight Log Mappers ─────────────────────────────────────────────────────────

/**
 * GraphQL representation of a Weight Log as returned by Hasura.
 */
export interface GraphQLWeightLog {
  id: string;
  inspection_id: string;
  measured_weight: number;
  updated_at: string; // TIMESTAMPTZ → ISO 8601
}

export function toGraphQLWeightLog(wl: IWeightLog): Record<string, unknown> {
  return {
    id: wl.id,
    inspection_id: wl.inspection_id,
    measured_weight: wl.measured_weight,
    updated_at: new Date(wl.updated_at).toISOString(),
  };
}

export function fromGraphQLWeightLog(gql: GraphQLWeightLog): IWeightLog {
  const updatedAt = new Date(gql.updated_at).getTime();
  return {
    id: gql.id,
    inspection_id: gql.inspection_id,
    measured_weight: gql.measured_weight,
    created_at: updatedAt,
    updated_at: updatedAt,
    device_id: '',
    is_deleted: false,
  };
}

export interface GraphQLShiftSession {
  id: string;
  machine_id: string;
  operator_id: string;
  shift_type: string;
  status: string;
  started_at: string; // TIMESTAMPTZ → ISO 8601 string from Hasura
  ended_at?: string; // TIMESTAMPTZ → ISO 8601 string from Hasura
  planned_boxes?: number;
  product_code?: string;
  updated_at: string; // TIMESTAMPTZ → ISO 8601 string from Hasura
  // NOTE: No `deleted` column in Hasura — is_deleted is RxDB-only
}

export function toGraphQLShiftSession(ss: IShiftSession): Record<string, unknown> {
  return {
    id: ss.id,
    machine_id: ss.machine_id,
    operator_id: ss.operator_id,
    shift_type: ss.shift_type,
    status: ss.status,
    started_at: new Date(ss.started_at).toISOString(),
    ended_at: ss.ended_at ? new Date(ss.ended_at).toISOString() : undefined,
    planned_boxes: ss.planned_boxes,
    product_code: ss.product_code,
    updated_at: new Date(ss.updated_at).toISOString(),
    // device_id e is_deleted omitidos — no existen en Hasura
  };
}

export function fromGraphQLShiftSession(gql: GraphQLShiftSession): IShiftSession {
  const updatedAt = new Date(gql.updated_at).getTime();
  return {
    id: gql.id,
    machine_id: gql.machine_id,
    operator_id: gql.operator_id,
    shift_type: gql.shift_type as IShiftSession['shift_type'],
    status: gql.status as IShiftSession['status'],
    started_at: new Date(gql.started_at).getTime(),
    ended_at: gql.ended_at ? new Date(gql.ended_at).getTime() : undefined,
    planned_boxes: gql.planned_boxes,
    product_code: gql.product_code,
    created_at: updatedAt,
    updated_at: updatedAt,
    device_id: '', // RxDB-only — not in Hasura
    is_deleted: false,
  };
}

// ─── Operator Mappers ────────────────────────────────────────────────────────────

export interface GraphQLOperator {
  id: string;
  full_name: string;
  is_active: boolean;
  updated_at: string; // TIMESTAMPTZ → ISO 8601 string from Hasura
}

export function toGraphQLOperator(op: IOperator): Record<string, unknown> {
  return {
    id: op.id,
    full_name: op.full_name,
    is_active: op.is_active,
    updated_at: new Date(op.updated_at).toISOString(),
  };
}

export function fromGraphQLOperator(gql: GraphQLOperator): IOperator {
  const updatedAt = new Date(gql.updated_at).getTime();
  return {
    id: gql.id,
    full_name: gql.full_name,
    is_active: gql.is_active,
    created_at: updatedAt,
    updated_at: updatedAt,
    device_id: '',
    is_deleted: false,
  };
}

// ─── Product Weight Standard Mappers ─────────────────────────────────────────────


export interface GraphQLProductWeightStandard {
  sku: string;
  name: string;
  lower_limit: number;
  upper_limit: number;
  requires_tare: boolean;
  updated_at: string; // TIMESTAMPTZ → ISO 8601 string from Hasura
}

export function toGraphQLProductWeightStandard(pws: IProductWeightStandard): Record<string, unknown> {
  return {
    sku: pws.sku,
    name: pws.name,
    lower_limit: pws.lower_limit,
    upper_limit: pws.upper_limit,
    requires_tare: pws.requires_tare,
    updated_at: new Date(pws.updated_at).toISOString(),
  };
}

export function fromGraphQLProductWeightStandard(gql: GraphQLProductWeightStandard): IProductWeightStandard {
  const updatedAt = new Date(gql.updated_at).getTime();
  return {
    sku: gql.sku,
    name: gql.name,
    lower_limit: gql.lower_limit,
    upper_limit: gql.upper_limit,
    requires_tare: gql.requires_tare,
    created_at: updatedAt,
    updated_at: updatedAt,
    device_id: '',
    is_deleted: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Downtime Conciliation — Phase: downtime-conciliation
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Downtime Conciliation Mappers ─────────────────────────────────────────────


export interface GraphQLDowntimeConciliation {
  id: string;
  oee_event_id: string;
  shift_session_id?: string;
  machine_id: string;
  reason_code: string;
  duration_min?: number;
  diagnosed_code?: string;
  diagnosed_by?: string;
  diagnosed_at?: string; // TIMESTAMPTZ → ISO 8601
  conciliated: boolean;
  conciliated_code?: string;
  conciliated_macro?: string;
  conciliated_by_prod?: string;
  conciliated_by_mtto?: string;
  conciliated_at?: string;
  conciliation_notes?: string;
  status: string;
  ot_sent: boolean;
  ot_response?: string;
  ot_sent_at?: string;
  is_mtto: boolean;
  updated_at: string; // TIMESTAMPTZ → ISO 8601
  // NOTE: device_id, is_deleted are RxDB-only
}

export function toGraphQLDowntimeConciliation(dc: IDowntimeConciliation): Record<string, unknown> {
  return {
    id: dc.id,
    oee_event_id: dc.oee_event_id,
    shift_session_id: dc.shift_session_id,
    machine_id: dc.machine_id,
    reason_code: dc.reason_code,
    duration_min: dc.duration_min,
    diagnosed_code: dc.diagnosed_code,
    diagnosed_by: dc.diagnosed_by,
    diagnosed_at: dc.diagnosed_at ? new Date(dc.diagnosed_at).toISOString() : undefined,
    conciliated: dc.conciliated,
    conciliated_code: dc.conciliated_code,
    conciliated_macro: dc.conciliated_macro,
    conciliated_by_prod: dc.conciliated_by_prod,
    conciliated_by_mtto: dc.conciliated_by_mtto,
    conciliated_at: dc.conciliated_at ? new Date(dc.conciliated_at).toISOString() : undefined,
    conciliation_notes: dc.conciliation_notes,
    status: dc.status,
    ot_sent: dc.ot_sent,
    ot_response: dc.ot_response,
    ot_sent_at: dc.ot_sent_at ? new Date(dc.ot_sent_at).toISOString() : undefined,
    is_mtto: dc.is_mtto,
    updated_at: new Date(dc.updated_at).toISOString(),
  };
}

export function fromGraphQLDowntimeConciliation(gql: GraphQLDowntimeConciliation): IDowntimeConciliation {
  const updatedAt = new Date(gql.updated_at).getTime();
  return {
    id: gql.id,
    oee_event_id: gql.oee_event_id,
    shift_session_id: gql.shift_session_id,
    machine_id: gql.machine_id,
    reason_code: gql.reason_code,
    duration_min: gql.duration_min,
    diagnosed_code: gql.diagnosed_code,
    diagnosed_by: gql.diagnosed_by,
    diagnosed_at: gql.diagnosed_at ? new Date(gql.diagnosed_at).getTime() : undefined,
    conciliated: gql.conciliated,
    conciliated_code: gql.conciliated_code,
    conciliated_macro: gql.conciliated_macro,
    conciliated_by_prod: gql.conciliated_by_prod,
    conciliated_by_mtto: gql.conciliated_by_mtto,
    conciliated_at: gql.conciliated_at ? new Date(gql.conciliated_at).getTime() : undefined,
    conciliation_notes: gql.conciliation_notes,
    status: gql.status as IDowntimeConciliation['status'],
    ot_sent: gql.ot_sent,
    ot_response: gql.ot_response,
    ot_sent_at: gql.ot_sent_at ? new Date(gql.ot_sent_at).getTime() : undefined,
    is_mtto: gql.is_mtto,
    created_at: updatedAt,
    updated_at: updatedAt,
    device_id: '', // RxDB-only
    is_deleted: false, // RxDB-only
    involved_departments: [],
    verdicts: [],
    escalation_deadline: 0,
  };
}

// ─── Plant Config Mappers ──────────────────────────────────────────────────────

export interface GraphQLPlantConfig {
  key: string;
  value: string;
  description?: string;
  updated_at: string; // TIMESTAMPTZ → ISO 8601
}

export function toGraphQLPlantConfig(pc: IPlantConfig): Record<string, unknown> {
  return {
    key: pc.key,
    value: pc.value,
    description: pc.description,
    updated_at: new Date(pc.updated_at).toISOString(),
  };
}

export function fromGraphQLPlantConfig(gql: GraphQLPlantConfig): IPlantConfig {
  const updatedAt = new Date(gql.updated_at).getTime();
  return {
    key: gql.key,
    value: gql.value,
    description: gql.description,
    created_at: updatedAt,
    updated_at: updatedAt,
    device_id: '',
    is_deleted: false,
  };
}

// ─── Shift Summary Mappers ─────────────────────────────────────────────────────

export interface GraphQLShiftSummary {
  id: string;
  shift_session_id: string;
  total_planned_min: number;
  total_downtime_min: number;
  total_micro_stop_min: number;
  total_mtto_min: number;
  total_prod_min: number;
  total_boxes: number;
  total_rejects: number;
  performance_pct?: number;
  has_pending_conciliation: boolean;
  updated_at: string; // TIMESTAMPTZ → ISO 8601
}

export function toGraphQLShiftSummary(ss: IShiftSummary): Record<string, unknown> {
  return {
    id: ss.id,
    shift_session_id: ss.shift_session_id,
    total_planned_min: ss.total_planned_min,
    total_downtime_min: ss.total_downtime_min,
    total_micro_stop_min: ss.total_micro_stop_min,
    total_mtto_min: ss.total_mtto_min,
    total_prod_min: ss.total_prod_min,
    total_boxes: ss.total_boxes,
    total_rejects: ss.total_rejects,
    performance_pct: ss.performance_pct,
    has_pending_conciliation: ss.has_pending_conciliation,
    updated_at: new Date(ss.updated_at).toISOString(),
  };
}

export function fromGraphQLShiftSummary(gql: GraphQLShiftSummary): IShiftSummary {
  const updatedAt = new Date(gql.updated_at).getTime();
  return {
    id: gql.id,
    shift_session_id: gql.shift_session_id,
    total_planned_min: gql.total_planned_min,
    total_downtime_min: gql.total_downtime_min,
    total_micro_stop_min: gql.total_micro_stop_min,
    total_mtto_min: gql.total_mtto_min,
    total_prod_min: gql.total_prod_min,
    total_boxes: gql.total_boxes,
    total_rejects: gql.total_rejects,
    performance_pct: gql.performance_pct,
    has_pending_conciliation: gql.has_pending_conciliation,
    created_at: updatedAt,
    updated_at: updatedAt,
    device_id: '',
    is_deleted: false,
  };
}