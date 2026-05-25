/**
 * GraphQL replication setup for bidirectional sync.
 *
 * Pattern: Replication State Manager
 * Why:
 * - RxDB's replicateGraphQL() provides checkpoint-based pull and upsert push.
 * - A single startReplication() call wires up all collections.
 * - Replication runs in the background (polling) and merges remote docs into local RxDB.
 *
 * Sync strategy:
 * - Pull: Query Hasura for records where client_updated_at > last checkpoint,
 *         ordered ascending. RxDB upserts incoming docs (Last-Write-Wins on timestamps).
 * - Push: Send changed local docs via upsert mutation with on_conflict.
 *         Hasura constraint: <table>_pkey (e.g., assets_pkey, work_orders_pkey).
 * - Conflict resolution: Last-Write-Wins based on client_updated_at.
 *   The server's on_conflict clause updates the row if client_updated_at is newer.
 *
 * Auth: All replication requests use the authenticated user role.
 *       The Authorization: Bearer <token> header is injected via getAuthToken().
 */

import { replicateGraphQL, type RxGraphQLReplicationState } from 'rxdb/plugins/replication-graphql';

import { nhost, getAuthToken } from './nhostClient';
import {
  toGraphQLAsset,
  fromGraphQLAsset,
  fromGraphQLWorkOrder,
  toGraphQLWorkOrder,
  toGraphQLReport,
  fromGraphQLReport,
  toGraphQLOeeEvent,
  fromGraphQLOeeEvent,
  toGraphQLQualityInspection,
  fromGraphQLQualityInspection,
  toGraphQLDefectLog,
  fromGraphQLDefectLog,
  toGraphQLWeightLog,
  fromGraphQLWeightLog,
  toGraphQLShiftSession,
  fromGraphQLShiftSession,
  fromGraphQLOperator,
  fromGraphQLProductWeightStandard,
  type GraphQLAsset,
  type GraphQLWorkOrder,
  type GraphQLReport,
  type GraphQLOeeEvent,
  type GraphQLQualityInspection,
  type GraphQLDefectLog,
  type GraphQLWeightLog,
  type GraphQLShiftSession,
  type GraphQLOperator,
  type GraphQLProductWeightStandard,
} from './dto';
import type { IAsset, IWorkOrder, IReport, IOeeEvent, IQualityInspection, IDefectLog, IWeightLog, IShiftSession, IOperator, IProductWeightStandard } from '../core/types';
import type { ChocolateIbarraDatabase } from '../data/database';
import { createResilientReplication, type ResilientState } from '../sync/resilientReplication';

/**
 * GraphQL endpoint URL for Nhost (Hasura).
 * Format: https://<subdomain>.nhost.run/v1/graphql
 *
 * Uses EXPO_PUBLIC_ env vars so Expo inlines them into the client bundle.
 */
export function getGraphQLUrl(): string {
  const subdomain = process.env.EXPO_PUBLIC_NHOST_SUBDOMAIN ?? 'your-nhost-subdomain';
  return `https://${subdomain}.nhost.run/v1/graphql`;
}

/**
 * Builds the headers object for replication requests.
 * Includes Content-Type and optionally the Bearer auth token.
 *
 * The token is extracted from the Nhost client's session (which handles refresh).
 * Replication uses raw fetch (not nhost.graphql.request) so we must inject manually.
 */
export function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ─── Pull Query Builder (Assets) ───────────────────────────────────────────────

/**
 * Pull handler for assets — fetches records updated after the checkpoint.
 *
 * @param checkpoint - The last synced client_updated_at value (null for initial sync)
 * @returns Query object for replicateGraphQL's queryBuilder
 *
 * Checkpoint strategy:
 * - Initial sync (checkpoint=null): query all records (client_updated_at > 0)
 * - Subsequent syncs: query records where client_updated_at > last checkpoint
 * - Results ordered by client_updated_at ascending to avoid missing updates
 */
function pullQueryBuilderAssets(checkpoint: GraphQLAsset | undefined, _limit: number) {
  return {
    query: `
      query PullAssets($lastCheckpoint: bigint!) {
        assets(
          where: { client_updated_at: { _gt: $lastCheckpoint } },
          order_by: { client_updated_at: asc }
        ) {
          id
          name
          type_id
          status
          location
          serial_number
          manufacturer
          model_number
          in_service_date
          warranty_expiration
          client_updated_at
          deleted
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.client_updated_at ? parseInt(checkpoint.client_updated_at, 10) : 0 },
  };
}

// ─── Push Mutation Builder (Assets Upsert) ────────────────────────────────────

/**
 * Push handler for assets — sends changed documents to server via upsert mutation.
 *
 * Uses Hasura's insert ... on_conflict to handle both inserts and updates.
 * Constraint name: assets_pkey (Hasura standard naming: <table>_pkey)
 *
 * The update_columns array specifies which fields to update on conflict.
 * All mutable fields are included; id and client_updated_at are always updated
 * (client_updated_at drives LWW conflict resolution).
 */
function pushMutationBuilderAssets(docs: any[]) {
  const objects = docs.map(toGraphQLAsset);
  return {
    query: `
      mutation UpsertAssets($objects: [assets_insert_input!]!) {
        insert_assets(
          objects: $objects,
          on_conflict: {
            constraint: assets_pkey,
            update_columns: [
              name,
              type_id,
              status,
              location,
              serial_number,
              manufacturer,
              model_number,
              in_service_date,
              warranty_expiration,
              client_updated_at,
              deleted
            ]
          }
        ) {
          affected_rows
        }
      }
    `,
    variables: { objects },
  };
}

// ─── Pull Query Builder (Work Orders) ─────────────────────────────────────────

function pullQueryBuilderWorkOrders(checkpoint: GraphQLWorkOrder | undefined, _limit: number) {
  return {
    query: `
      query PullWorkOrders($lastCheckpoint: bigint!) {
        work_orders(
          where: { client_updated_at: { _gt: $lastCheckpoint } },
          order_by: { client_updated_at: asc }
        ) {
          id
          equipment_id
          description
          status
          priority
          assigned_to
          scheduled_date
          completed_date
          client_updated_at
          deleted
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.client_updated_at ? parseInt(checkpoint.client_updated_at, 10) : 0 },
  };
}

// ─── Push Mutation Builder (Work Orders Upsert) ────────────────────────────────

function pushMutationBuilderWorkOrders(docs: any[]) {
  const objects = docs.map(toGraphQLWorkOrder);
  return {
    query: `
      mutation UpsertWorkOrders($objects: [work_orders_insert_input!]!) {
        insert_work_orders(
          objects: $objects,
          on_conflict: {
            constraint: work_orders_pkey,
            update_columns: [
              equipment_id,
              description,
              status,
              priority,
              assigned_to,
              scheduled_date,
              completed_date,
              client_updated_at,
              deleted
            ]
          }
        ) {
          affected_rows
        }
      }
    `,
    variables: { objects },
  };
}

// ─── Pull Query Builder (Reports) ──────────────────────────────────────────────

function pullQueryBuilderReports(checkpoint: GraphQLReport | undefined, _limit: number) {
  return {
    query: `
      query PullReports($lastCheckpoint: bigint!) {
        reports(
          where: { updated_at: { _gt: $lastCheckpoint } },
          order_by: { updated_at: asc }
        ) {
          id
          updated_at
          deleted
          template_id
          data
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.updated_at ? parseInt(checkpoint.updated_at, 10) : 0 },
  };
}

// ─── Push Mutation Builder (Reports Upsert) ─────────────────────────────────────

function pushMutationBuilderReports(docs: any[]) {
  const objects = docs.map(toGraphQLReport);
  return {
    query: `
      mutation UpsertReports($objects: [reports_insert_input!]!) {
        insert_reports(
          objects: $objects,
          on_conflict: {
            constraint: reports_pkey,
            update_columns: [
              updated_at,
              deleted,
              template_id,
              data
            ]
          }
        ) {
          affected_rows
        }
      }
    `,
    variables: { objects },
  };
}

// ─── Pull Query Builder (OEE Events) ───────────────────────────────────────────

function pullQueryBuilderOeeEvents(checkpoint: GraphQLOeeEvent | undefined, _limit: number) {
  return {
    query: `
      query PullOeeEvents($lastCheckpoint: bigint!) {
        oee_events(
          where: { updated_at: { _gt: $lastCheckpoint } },
          order_by: { updated_at: asc }
        ) {
          id
          updated_at
          deleted
          line_id
          machine_id
          operator_id
          shift_id
          event_type
          timestamp
          reason_code
          quantity
          planned_boxes
          notes
          is_retroactive
          related_event_id
          device_id
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.updated_at ? parseInt(checkpoint.updated_at, 10) : 0 },
  };
}

// ─── Push Mutation Builder (OEE Events Upsert) ─────────────────────────────────

function pushMutationBuilderOeeEvents(docs: any[]) {
  const objects = docs.map(toGraphQLOeeEvent);
  return {
    query: `
      mutation UpsertOeeEvents($objects: [oee_events_insert_input!]!) {
        insert_oee_events(
          objects: $objects,
          on_conflict: {
            constraint: oee_events_pkey,
            update_columns: [
              updated_at, deleted, line_id, machine_id, operator_id,
              shift_id, event_type, timestamp, reason_code, quantity,
              planned_boxes, notes, is_retroactive, related_event_id, device_id
            ]
          }
        ) {
          affected_rows
        }
      }
    `,
    variables: { objects },
  };
}

// ─── Pull Query Builder (Operators — pull-only) ───────────────────────────────

function pullQueryBuilderOperators(checkpoint: GraphQLOperator | undefined, _limit: number) {
  return {
    query: `
      query PullOperators($lastCheckpoint: timestamptz!) {
        operators(
          where: { updated_at: { _gt: $lastCheckpoint } },
          order_by: { updated_at: asc }
        ) {
          id
          full_name
          is_active
          updated_at
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.updated_at ?? '1970-01-01T00:00:00Z' },
  };
}

// ─── Pull Query Builder (Product Weight Standards — pull-only) ───────────────

function pullQueryBuilderProductWeightStandards(checkpoint: GraphQLProductWeightStandard | undefined, _limit: number) {
  return {
    query: `
      query PullProductWeightStandards($lastCheckpoint: timestamptz!) {
        product_weight_standards(
          where: { updated_at: { _gt: $lastCheckpoint } },
          order_by: { updated_at: asc }
        ) {
          sku
          name
          lower_limit
          upper_limit
          requires_tare
          updated_at
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.updated_at ?? '1970-01-01T00:00:00Z' },
  };
}

// ─── Pull Query Builder (Quality Inspections) ────────────────────────────────

function pullQueryBuilderQualityInspections(checkpoint: GraphQLQualityInspection | undefined, _limit: number) {
  return {
    query: `
      query PullQualityInspections($lastCheckpoint: timestamptz!) {
        quality_inspections(
          where: { updated_at: { _gt: $lastCheckpoint } },
          order_by: { updated_at: asc }
        ) {
          id
          machine_id
          inspector_id
          shift_type
          disposition
          notes
          data_source
          updated_at
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.updated_at ?? '1970-01-01T00:00:00Z' },
  };
}

// ─── Push Mutation Builder (Quality Inspections Upsert) ───────────────────────

function pushMutationBuilderQualityInspections(docs: any[]) {
  const objects = docs.map(toGraphQLQualityInspection);
  return {
    query: `
      mutation UpsertInspections($objects: [quality_inspections_insert_input!]!) {
        insert_quality_inspections(
          objects: $objects,
          on_conflict: {
            constraint: quality_inspections_pkey,
            update_columns: [
              machine_id, inspector_id, shift_type, disposition,
              notes, data_source, updated_at
            ]
          }
        ) { affected_rows }
      }
    `,
    variables: { objects },
  };
}

// ─── Pull Query Builder (Defect Logs) ─────────────────────────────────────────

function pullQueryBuilderDefectLogs(checkpoint: GraphQLDefectLog | undefined, _limit: number) {
  return {
    query: `
      query PullDefectLogs($lastCheckpoint: timestamptz!) {
        defect_logs(
          where: { updated_at: { _gt: $lastCheckpoint } },
          order_by: { updated_at: asc }
        ) {
          id
          inspection_id
          severity
          defect_type
          defect_count
          updated_at
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.updated_at ?? '1970-01-01T00:00:00Z' },
  };
}

// ─── Push Mutation Builder (Defect Logs Upsert) ───────────────────────────────

function pushMutationBuilderDefectLogs(docs: any[]) {
  const objects = docs.map(toGraphQLDefectLog);
  return {
    query: `
      mutation UpsertDefectLogs($objects: [defect_logs_insert_input!]!) {
        insert_defect_logs(
          objects: $objects,
          on_conflict: {
            constraint: defect_logs_pkey,
            update_columns: [
              inspection_id, severity, defect_type, defect_count, updated_at
            ]
          }
        ) { affected_rows }
      }
    `,
    variables: { objects },
  };
}

// ─── Pull Query Builder (Weight Logs) ─────────────────────────────────────────

function pullQueryBuilderWeightLogs(checkpoint: GraphQLWeightLog | undefined, _limit: number) {
  return {
    query: `
      query PullWeightLogs($lastCheckpoint: timestamptz!) {
        weight_logs(
          where: { updated_at: { _gt: $lastCheckpoint } },
          order_by: { updated_at: asc }
        ) {
          id
          inspection_id
          measured_weight
          updated_at
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.updated_at ?? '1970-01-01T00:00:00Z' },
  };
}

// ─── Push Mutation Builder (Weight Logs Upsert) ───────────────────────────────

function pushMutationBuilderWeightLogs(docs: any[]) {
  const objects = docs.map(toGraphQLWeightLog);
  return {
    query: `
      mutation UpsertWeightLogs($objects: [weight_logs_insert_input!]!) {
        insert_weight_logs(
          objects: $objects,
          on_conflict: {
            constraint: weight_logs_pkey,
            update_columns: [
              inspection_id, measured_weight, updated_at
            ]
          }
        ) { affected_rows }
      }
    `,
    variables: { objects },
  };
}

// ─── Pull Query Builder (Shift Sessions) ──────────────────────────────────────

function pullQueryBuilderShiftSessions(checkpoint: GraphQLShiftSession | undefined, _limit: number) {
  return {
    query: `
      query PullShiftSessions($lastCheckpoint: timestamptz!) {
        shift_sessions(
          where: { updated_at: { _gt: $lastCheckpoint } },
          order_by: { updated_at: asc }
        ) {
          id
          machine_id
          operator_id
          shift_type
          status
          started_at
          ended_at
          planned_boxes
          product_code
          updated_at
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.updated_at ?? '1970-01-01T00:00:00Z' },
  };
}

// ─── Push Mutation Builder (Shift Sessions Upsert) ────────────────────────────

function pushMutationBuilderShiftSessions(docs: any[]) {
  const objects = docs.map(toGraphQLShiftSession);
  return {
    query: `
      mutation UpsertShiftSessions($objects: [shift_sessions_insert_input!]!) {
        insert_shift_sessions(
          objects: $objects,
          on_conflict: {
            constraint: shift_sessions_pkey,
            update_columns: [
              machine_id, operator_id, shift_type, status,
              started_at, ended_at, planned_boxes, product_code,
              updated_at
            ]
          }
        ) { affected_rows }
      }
    `,
    variables: { objects },
  };
}

// ─── Replication Start Function ────────────────────────────────────────────────

/**
 * Starts bidirectional GraphQL replication for all collections.
 *
 * Call this AFTER the database is initialized (after getDatabase() resolves).
 * Recommended call site: inside useEffect in the root App component,
 * after <DatabaseProvider> mounts and db is available.
 *
 * @param db - The RxDB database instance (from useDatabase() hook)
 * @returns void — replication runs as a background process
 *
 * @example
 * ```typescript
 * const db = useDatabase();
 *
 * useEffect(() => {
 *   startReplication(db);
 * }, [db]);
 * ```
 */
export interface ReplicationStates {
  assets: RxGraphQLReplicationState<IAsset, GraphQLAsset>;
  workOrders: RxGraphQLReplicationState<IWorkOrder, GraphQLWorkOrder>;
  reports: RxGraphQLReplicationState<IReport, GraphQLReport>;
  oeeEvents: RxGraphQLReplicationState<IOeeEvent, GraphQLOeeEvent>;
  qualityInspections: RxGraphQLReplicationState<IQualityInspection, GraphQLQualityInspection>;
  defectLogs: RxGraphQLReplicationState<IDefectLog, GraphQLDefectLog>;
  weightLogs: RxGraphQLReplicationState<IWeightLog, GraphQLWeightLog>;
  shiftSessions: RxGraphQLReplicationState<IShiftSession, GraphQLShiftSession>;
  operators: RxGraphQLReplicationState<IOperator, GraphQLOperator>;
  productWeightStandards: RxGraphQLReplicationState<IProductWeightStandard, GraphQLProductWeightStandard>;
  /** Resilient replication controller for OEE events (backoff, circuit breaker, DLQ). */
  resilientOeeController?: { cleanup: () => void; getState: () => ResilientState };
}

export function startReplication(db: ChocolateIbarraDatabase): ReplicationStates {
  // ── Assets replication ──────────────────────────────────────────────────────
  let replicationAssets: RxGraphQLReplicationState<IAsset, GraphQLAsset>;
  try {
    replicationAssets = replicateGraphQL<IAsset, GraphQLAsset>({
      replicationIdentifier: 'assets-graphql-replication',
      url: { http: getGraphQLUrl() },
      headers: getHeaders(),
      collection: db.collections.assets,
      pull: {
        queryBuilder: pullQueryBuilderAssets,
        modifier: (doc: GraphQLAsset) => ({ ...fromGraphQLAsset(doc), _deleted: doc.deleted ?? false }),
      },
      push: {
        queryBuilder: pushMutationBuilderAssets,
      },
      live: false, // disable live WebSocket polling to avoid 'ws' module crash in browser
      retryTime: 5000,
      autoStart: true,
    });
  } catch (err) {
    console.warn('Assets replication failed to initialise:', err);
    // Create a minimal stub so the rest of the app doesn't crash
    replicationAssets = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  // ── Work Orders replication ────────────────────────────────────────────────
  let replicationWorkOrders: RxGraphQLReplicationState<IWorkOrder, GraphQLWorkOrder>;
  try {
    replicationWorkOrders = replicateGraphQL<IWorkOrder, GraphQLWorkOrder>({
      replicationIdentifier: 'work-orders-graphql-replication',
      url: { http: getGraphQLUrl() },
      headers: getHeaders(),
      collection: db.collections.work_orders,
      pull: {
        queryBuilder: pullQueryBuilderWorkOrders,
        modifier: (doc: GraphQLWorkOrder) => ({ ...fromGraphQLWorkOrder(doc), _deleted: doc.deleted ?? false }),
      },
      push: {
        queryBuilder: pushMutationBuilderWorkOrders,
      },
      live: false,
      retryTime: 5000,
      autoStart: true,
    });
  } catch (err) {
    console.warn('WorkOrders replication failed to initialise:', err);
    replicationWorkOrders = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  // ── Reports replication ────────────────────────────────────────────────────
  let replicationReports: RxGraphQLReplicationState<IReport, GraphQLReport>;
  try {
    replicationReports = replicateGraphQL<IReport, GraphQLReport>({
      replicationIdentifier: 'reports-graphql-replication',
      url: { http: getGraphQLUrl() },
      headers: getHeaders(),
      collection: db.collections.reports,
      pull: {
        queryBuilder: pullQueryBuilderReports,
        modifier: (doc: GraphQLReport) => ({ ...fromGraphQLReport(doc), _deleted: doc.deleted ?? false }),
      },
      push: {
        queryBuilder: pushMutationBuilderReports,
      },
      live: false,
      retryTime: 5000,
      autoStart: true,
    });
  } catch (err) {
    console.warn('Reports replication failed to initialise:', err);
    replicationReports = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  // ── OEE Events replication ─────────────────────────────────────────────────
  let replicationOeeEvents: RxGraphQLReplicationState<IOeeEvent, GraphQLOeeEvent>;
  let resilientOeeController: { cleanup: () => void; getState: () => ResilientState } | undefined;
  try {
    replicationOeeEvents = replicateGraphQL<IOeeEvent, GraphQLOeeEvent>({
      replicationIdentifier: 'oee-events-graphql-replication',
      url: { http: getGraphQLUrl() },
      headers: getHeaders(),
      collection: db.collections.oee_events,
      pull: {
        queryBuilder: pullQueryBuilderOeeEvents,
        modifier: (doc: GraphQLOeeEvent) => ({ ...fromGraphQLOeeEvent(doc), _deleted: doc.deleted ?? false }),
      },
      push: {
        queryBuilder: pushMutationBuilderOeeEvents,
      },
      live: false, // WebSocket disabled for browser compatibility
      retryTime: 5000,
      autoStart: true,
    });

    // Wrap OEE replication with resilience layer (backoff, circuit breaker, DLQ)
    resilientOeeController = createResilientReplication(
      replicationOeeEvents,
      db,
      { url: getGraphQLUrl(), getHeaders },
    );
  } catch (err) {
    console.warn('OeeEvents replication failed to initialise:', err);
    replicationOeeEvents = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  // ── Operators replication (pull-only) ──────────────────────────────────────
  let replicationOperators: RxGraphQLReplicationState<IOperator, GraphQLOperator>;
  try {
    replicationOperators = replicateGraphQL<IOperator, GraphQLOperator>({
      replicationIdentifier: 'operators-graphql-replication',
      url: { http: getGraphQLUrl() },
      headers: getHeaders(),
      collection: db.collections.operators,
      pull: {
        queryBuilder: pullQueryBuilderOperators,
        modifier: (doc: GraphQLOperator) => ({ ...fromGraphQLOperator(doc), _deleted: false }),
      },
      live: false,
      retryTime: 5000,
      autoStart: true,
    });
  } catch (err) {
    console.warn('Operators replication failed to initialise:', err);
    replicationOperators = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  // ── Product Weight Standards replication (pull-only) ──────────────────────
  let replicationProductWeightStandards: RxGraphQLReplicationState<IProductWeightStandard, GraphQLProductWeightStandard>;
  try {
    replicationProductWeightStandards = replicateGraphQL<IProductWeightStandard, GraphQLProductWeightStandard>({
      replicationIdentifier: 'product-weight-standards-graphql-replication',
      url: { http: getGraphQLUrl() },
      headers: getHeaders(),
      collection: db.collections.product_weight_standards,
      pull: {
        queryBuilder: pullQueryBuilderProductWeightStandards,
        modifier: (doc: GraphQLProductWeightStandard) => ({ ...fromGraphQLProductWeightStandard(doc), _deleted: false }),
      },
      live: false,
      retryTime: 5000,
      autoStart: true,
    });
  } catch (err) {
    console.warn('ProductWeightStandards replication failed to initialise:', err);
    replicationProductWeightStandards = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  // ── Quality Inspections replication ───────────────────────────────────────
  let replicationQualityInspections: RxGraphQLReplicationState<IQualityInspection, GraphQLQualityInspection>;
  try {
    replicationQualityInspections = replicateGraphQL<IQualityInspection, GraphQLQualityInspection>({
      replicationIdentifier: 'quality-inspections-graphql-replication',
      url: { http: getGraphQLUrl() },
      headers: getHeaders(),
      collection: db.collections.quality_inspections,
      pull: {
        queryBuilder: pullQueryBuilderQualityInspections,
        modifier: (doc: GraphQLQualityInspection) => ({ ...fromGraphQLQualityInspection(doc), _deleted: false }),
      },
      push: {
        queryBuilder: pushMutationBuilderQualityInspections,
      },
      live: false,
      retryTime: 5000,
      autoStart: true,
    });
  } catch (err) {
    console.warn('QualityInspections replication failed to initialise:', err);
    replicationQualityInspections = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  // ── Defect Logs replication ──────────────────────────────────────────────
  let replicationDefectLogs: RxGraphQLReplicationState<IDefectLog, GraphQLDefectLog>;
  try {
    replicationDefectLogs = replicateGraphQL<IDefectLog, GraphQLDefectLog>({
      replicationIdentifier: 'defect-logs-graphql-replication',
      url: { http: getGraphQLUrl() },
      headers: getHeaders(),
      collection: db.collections.defect_logs,
      pull: {
        queryBuilder: pullQueryBuilderDefectLogs,
        modifier: (doc: GraphQLDefectLog) => ({ ...fromGraphQLDefectLog(doc), _deleted: false }),
      },
      push: {
        queryBuilder: pushMutationBuilderDefectLogs,
      },
      live: false,
      retryTime: 5000,
      autoStart: true,
    });
  } catch (err) {
    console.warn('DefectLogs replication failed to initialise:', err);
    replicationDefectLogs = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  // ── Weight Logs replication ──────────────────────────────────────────────
  let replicationWeightLogs: RxGraphQLReplicationState<IWeightLog, GraphQLWeightLog>;
  try {
    replicationWeightLogs = replicateGraphQL<IWeightLog, GraphQLWeightLog>({
      replicationIdentifier: 'weight-logs-graphql-replication',
      url: { http: getGraphQLUrl() },
      headers: getHeaders(),
      collection: db.collections.weight_logs,
      pull: {
        queryBuilder: pullQueryBuilderWeightLogs,
        modifier: (doc: GraphQLWeightLog) => ({ ...fromGraphQLWeightLog(doc), _deleted: false }),
      },
      push: {
        queryBuilder: pushMutationBuilderWeightLogs,
      },
      live: false,
      retryTime: 5000,
      autoStart: true,
    });
  } catch (err) {
    console.warn('WeightLogs replication failed to initialise:', err);
    replicationWeightLogs = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  // ── Shift Sessions replication ───────────────────────────────────────────
  let replicationShiftSessions: RxGraphQLReplicationState<IShiftSession, GraphQLShiftSession>;
  try {
    replicationShiftSessions = replicateGraphQL<IShiftSession, GraphQLShiftSession>({
      replicationIdentifier: 'shift-sessions-graphql-replication',
      url: { http: getGraphQLUrl() },
      headers: getHeaders(),
      collection: db.collections.shift_sessions,
      pull: {
        queryBuilder: pullQueryBuilderShiftSessions,
        modifier: (doc: GraphQLShiftSession) => ({ ...fromGraphQLShiftSession(doc), _deleted: false }),
      },
      push: {
        queryBuilder: pushMutationBuilderShiftSessions,
      },
      live: false,
      retryTime: 5000,
      autoStart: true,
    });
  } catch (err) {
    console.warn('ShiftSessions replication failed to initialise:', err);
    replicationShiftSessions = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  return {
    assets: replicationAssets,
    workOrders: replicationWorkOrders,
    reports: replicationReports,
    oeeEvents: replicationOeeEvents,
    qualityInspections: replicationQualityInspections,
    defectLogs: replicationDefectLogs,
    weightLogs: replicationWeightLogs,
    shiftSessions: replicationShiftSessions,
    operators: replicationOperators,
    productWeightStandards: replicationProductWeightStandards,
    resilientOeeController,
  };
}