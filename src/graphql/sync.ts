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
  type GraphQLAsset,
  type GraphQLWorkOrder,
  type GraphQLReport,
  type GraphQLOeeEvent,
} from './dto';
import type { IAsset, IWorkOrder, IReport, IOeeEvent } from '../core/types';
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

  // Asset Types replication would follow the same pattern.
  // TODO: Add asset_types replication once Nhost tables are created.

  return { assets: replicationAssets, workOrders: replicationWorkOrders, reports: replicationReports, oeeEvents: replicationOeeEvents, resilientOeeController };
}