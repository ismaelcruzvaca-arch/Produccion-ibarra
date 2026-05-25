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
 * BIGINT handling:
 * - client_updated_at is stored as a number (milliseconds since epoch) in RxDB
 * - Hasura stores it as BIGINT (string-encoded integer in GraphQL responses)
 * - Mappers handle the number ↔ string conversion explicitly
 *
 * This ensures the local domain model (IAsset, etc.) is never contaminated
 * by network-level naming conventions.
 */

import type {
  IAsset, IAssetType, IWorkOrder, IReport, IOeeEvent,
  IQualityInspection, IDefectLog, IWeightLog, IShiftSession, IOperator,
  IProductWeightStandard,
} from '../core/types';

// ─── Asset Mappers ─────────────────────────────────────────────────────────────

/**
 * GraphQL representation of an Asset as returned by Hasura.
 * snake_case field names, client_updated_at as BIGINT string.
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
  client_updated_at: string; // BIGINT as string from Hasura
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
    // client_updated_at MUST be a string for BIGINT columns in Hasura
    client_updated_at: asset.client_updated_at.toString(),
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
    client_updated_at: parseInt(gql.client_updated_at, 10),
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
    client_updated_at: at.client_updated_at.toString(),
    deleted: at.is_deleted,
  };
}

export function fromGraphQLAssetType(gql: GraphQLAssetType): IAssetType {
  return {
    id: gql.id,
    code: gql.code,
    description: gql.description,
    is_active: gql.is_active,
    client_updated_at: parseInt(gql.client_updated_at, 10),
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
    client_updated_at: wo.client_updated_at.toString(),
    deleted: wo.is_deleted,
  };
}

/**
 * Maps a GraphQL work order response to local RxDB format (camelCase).
 */
export function fromGraphQLWorkOrder(gql: GraphQLWorkOrder): IWorkOrder {
  return {
    id: gql.id,
    equipment_id: gql.equipment_id,
    description: gql.description,
    status: gql.status as IWorkOrder['status'],
    priority: gql.priority as IWorkOrder['priority'],
    assigned_to: gql.assigned_to,
    scheduled_date: gql.scheduled_date ? parseInt(gql.scheduled_date, 10) : undefined,
    completed_date: gql.completed_date ? parseInt(gql.completed_date, 10) : undefined,
    client_updated_at: parseInt(gql.client_updated_at, 10),
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
  return {
    id: gql.id,
    updated_at: parseInt(gql.updated_at, 10),
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
  device_id?: string;
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
  return {
    id: gql.id,
    updated_at: parseInt(gql.updated_at, 10),
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
    device_id: gql.device_id ?? '',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 3: Reconciled Collections — Quality, Shifts, Operators, Weight Standards
// ═══════════════════════════════════════════════════════════════════════════════
// TIMESTAMPTZ handling: Hasura sends ISO 8601 strings, DTOs convert to epoch ms for RxDB.
// Push converts back: epoch ms → ISO 8601 string via .toISOString()
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Quality Inspection Mappers ──────────────────────────────────────────────────

export interface GraphQLQualityInspection {
  id: string;
  machine_id: string;
  inspector_id: string;
  shift_type: string;
  disposition: string;
  notes?: string;
  data_source: string;
  updated_at: string; // TIMESTAMPTZ → ISO 8601 string from Hasura
  // NOTE: device_id, is_deleted son RxDB-only — no existen en Hasura
}

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
    // device_id e is_deleted omitidos — no existen en Hasura
  };
}

export function fromGraphQLQualityInspection(gql: GraphQLQualityInspection): IQualityInspection {
  return {
    id: gql.id,
    machine_id: gql.machine_id,
    inspector_id: gql.inspector_id,
    shift_type: gql.shift_type as IQualityInspection['shift_type'],
    disposition: gql.disposition as IQualityInspection['disposition'],
    notes: gql.notes,
    data_source: gql.data_source as IQualityInspection['data_source'],
    updated_at: new Date(gql.updated_at).getTime(),
    device_id: '', // RxDB-only — no `device_id` en Hasura
    is_deleted: false, // RxDB-only — no `deleted` en Hasura
  };
}

// ─── Defect Log Mappers ──────────────────────────────────────────────────────────

export interface GraphQLDefectLog {
  id: string;
  inspection_id: string;
  severity: string;
  defect_type: string;
  defect_count: number;
  updated_at: string; // TIMESTAMPTZ → ISO 8601
  // NOTE: No `deleted` column in Hasura
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
  return {
    id: gql.id,
    inspection_id: gql.inspection_id,
    severity: gql.severity as IDefectLog['severity'],
    defect_type: gql.defect_type,
    defect_count: gql.defect_count,
    updated_at: new Date(gql.updated_at).getTime(),
    device_id: '', // RxDB-only — not in Hasura
    is_deleted: false, // RxDB-only — not in Hasura
  };
}

// ─── Weight Log Mappers ──────────────────────────────────────────────────────────

export interface GraphQLWeightLog {
  id: string;
  inspection_id: string;
  measured_weight: number;
  updated_at: string; // TIMESTAMPTZ → ISO 8601 string from Hasura
  // NOTE: No `deleted` column in Hasura
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
  return {
    id: gql.id,
    inspection_id: gql.inspection_id,
    measured_weight: gql.measured_weight,
    updated_at: new Date(gql.updated_at).getTime(),
    device_id: '', // RxDB-only — not in Hasura
    is_deleted: false, // RxDB-only — not in Hasura
  };
}

// ─── Shift Session Mappers ───────────────────────────────────────────────────────

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
    updated_at: new Date(gql.updated_at).getTime(),
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
  return {
    id: gql.id,
    full_name: gql.full_name,
    is_active: gql.is_active,
    updated_at: new Date(gql.updated_at).getTime(),
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
  return {
    sku: gql.sku,
    name: gql.name,
    lower_limit: gql.lower_limit,
    upper_limit: gql.upper_limit,
    requires_tare: gql.requires_tare,
    updated_at: new Date(gql.updated_at).getTime(),
    device_id: '',
    is_deleted: false,
  };
}