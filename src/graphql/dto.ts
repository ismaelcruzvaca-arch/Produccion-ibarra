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

import type { IAsset, IAssetType, IWorkOrder, IReport, IOeeEvent } from '../core/types';

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
    deleted: asset.deleted,
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
    deleted: gql.deleted,
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
    deleted: at.deleted,
  };
}

export function fromGraphQLAssetType(gql: GraphQLAssetType): IAssetType {
  return {
    id: gql.id,
    code: gql.code,
    description: gql.description,
    is_active: gql.is_active,
    client_updated_at: parseInt(gql.client_updated_at, 10),
    deleted: gql.deleted,
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
    deleted: wo.deleted,
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
    deleted: gql.deleted,
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
    deleted: report.deleted,
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
    deleted: gql.deleted,
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
    deleted: event.deleted,
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
    deleted: gql.deleted,
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