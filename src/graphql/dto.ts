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

import type { IAsset, IAssetType, IWorkOrder, IReport, IOeeEvent, ISignature, IQualityInspection, IDefectLog, IWeightLog } from '../core/types';

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
  line_id: string;
  operator_id?: string;
  shift_id?: string;
  product_code?: string;
  result: string; // 'pass' | 'fail'
  notes?: string;
  created_at: string; // BIGINT as string
  updated_at: string; // BIGINT as string
  is_deleted: boolean;
}

/**
 * Maps a local RxDB quality inspection to GraphQL input format.
 * Local fields not in backend (machine_id, inspection_type, value, unit,
 * defect_*, standard_*) are omitted from the push payload.
 */
export function toGraphQLQualityInspection(insp: IQualityInspection): Record<string, unknown> {
  return {
    id: insp.id,
    line_id: insp.line_id,
    operator_id: insp.operator_id,
    shift_id: insp.shift_session_id,
    product_code: insp.product_id,
    result: insp.passed ? 'pass' : 'fail',
    notes: insp.notes,
    created_at: insp.created_at.toString(),
    updated_at: insp.updated_at.toString(),
    is_deleted: insp.is_deleted,
  };
}

/**
 * Maps a GraphQL quality inspection response to local RxDB format.
 * Backend returns fewer fields; local extras default to safe initial values.
 */
export function fromGraphQLQualityInspection(gql: GraphQLQualityInspection): IQualityInspection {
  return {
    id: gql.id,
    line_id: gql.line_id,
    machine_id: '', // not tracked in backend yet
    shift_session_id: gql.shift_id ?? '',
    operator_id: gql.operator_id ?? '',
    product_id: gql.product_code ?? '',
    inspection_type: 'visual', // default — not in backend schema
    value: 0, // default — not in backend schema
    unit: '', // default — not in backend schema
    passed: gql.result === 'pass',
    defect_id: undefined,
    defect_label: undefined,
    defect_severity: undefined,
    notes: gql.notes,
    standard_min: undefined,
    standard_max: undefined,
    standard_warning: undefined,
    created_at: parseInt(gql.created_at, 10),
    updated_at: parseInt(gql.updated_at, 10),
    is_deleted: gql.is_deleted,
  };
}

// ─── Defect Log Mappers ─────────────────────────────────────────────────────────

/**
 * GraphQL representation of a Defect Log as returned by Hasura.
 */
export interface GraphQLDefectLog {
  id: string;
  inspection_id: string;
  defect_type?: string;
  defect_code?: string;
  quantity: number;
  severity: string; // 'low' | 'medium' | 'high' | 'critical'
  notes?: string;
  registered_at: string; // BIGINT as string
  updated_at: string; // BIGINT as string
  is_deleted: boolean;
}

/**
 * Maps a local RxDB defect log to GraphQL input format.
 * Local defect_id → backend defect_type, defect_label → defect_code.
 */
export function toGraphQLDefectLog(dlog: IDefectLog): Record<string, unknown> {
  return {
    id: dlog.id,
    inspection_id: dlog.inspection_id,
    defect_type: dlog.defect_id,
    defect_code: dlog.defect_label,
    quantity: dlog.quantity,
    severity: dlog.defect_severity,
    notes: dlog.notes,
    registered_at: dlog.created_at.toString(),
    updated_at: dlog.updated_at.toString(),
    is_deleted: dlog.is_deleted,
  };
}

/**
 * Maps a GraphQL defect log response to local RxDB format.
 * Backend defect_type → local defect_id, defect_code → defect_label.
 */
export function fromGraphQLDefectLog(gql: GraphQLDefectLog): IDefectLog {
  return {
    id: gql.id,
    inspection_id: gql.inspection_id,
    defect_id: gql.defect_type ?? '',
    defect_label: gql.defect_code ?? '',
    defect_severity: gql.severity as IDefectLog['defect_severity'],
    quantity: gql.quantity,
    notes: gql.notes,
    created_at: parseInt(gql.registered_at, 10),
    updated_at: parseInt(gql.updated_at, 10),
    is_deleted: gql.is_deleted,
  };
}

// ─── Weight Log Mappers ─────────────────────────────────────────────────────────

/**
 * GraphQL representation of a Weight Log as returned by Hasura.
 */
export interface GraphQLWeightLog {
  id: string;
  inspection_id: string;
  product_code?: string;
  target_weight: number; // numeric(10,2)
  actual_weight: number; // numeric(10,2)
  tolerance?: number; // numeric(10,2)
  unit?: string;
  result: string; // 'pass' | 'fail'
  registered_at: string; // BIGINT as string
  updated_at: string; // BIGINT as string
  is_deleted: boolean;
}

/**
 * Maps a local RxDB weight log to GraphQL input format.
 * Local weight_kg → backend actual_weight; standard_min_kg → target_weight.
 */
export function toGraphQLWeightLog(wlog: IWeightLog): Record<string, unknown> {
  return {
    id: wlog.id,
    inspection_id: wlog.inspection_id,
    product_code: wlog.product_id,
    target_weight: wlog.standard_min_kg ?? wlog.weight_kg,
    actual_weight: wlog.weight_kg,
    result: wlog.passed ? 'pass' : 'fail',
    registered_at: wlog.created_at.toString(),
    updated_at: wlog.updated_at.toString(),
    is_deleted: wlog.is_deleted,
  };
}

/**
 * Maps a GraphQL weight log response to local RxDB format.
 * Backend actual_weight → local weight_kg; target_weight → standard_min_kg;
 * target_weight + tolerance → standard_max_kg.
 */
export function fromGraphQLWeightLog(gql: GraphQLWeightLog): IWeightLog {
  const minKg = gql.target_weight;
  const maxKg = gql.tolerance ? gql.target_weight + gql.tolerance : undefined;
  return {
    id: gql.id,
    inspection_id: gql.inspection_id,
    product_id: gql.product_code ?? '',
    weight_kg: gql.actual_weight,
    standard_min_kg: minKg,
    standard_max_kg: maxKg,
    passed: gql.result === 'pass',
    warning: false, // default — not tracked in backend
    created_at: parseInt(gql.registered_at, 10),
    updated_at: parseInt(gql.updated_at, 10),
    is_deleted: gql.is_deleted,
  };
}