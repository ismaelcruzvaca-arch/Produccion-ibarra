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

import { replicateGraphQL, type ReplicationState } from 'rxdb/plugins/replication-graphql';
import type { RxDatabase } from 'rxdb';

import { nhost, getAuthToken } from './nhostClient';
import {
  toGraphQLAsset,
  fromGraphQLAsset,
  fromGraphQLWorkOrder,
  toGraphQLWorkOrder,
  toGraphQLReport,
  fromGraphQLReport,
  type GraphQLAsset,
  type GraphQLWorkOrder,
  type GraphQLReport,
} from './dto';
import type { IAsset, IWorkOrder, IReport } from '../core/types';
import type { ChocolateIbarraDatabase } from '../data/database';

/**
 * GraphQL endpoint URL for Nhost (Hasura).
 * Format: https://<subdomain>.hasura.app/v1/graphql
 *
 * TODO: Replace with actual values from nhostClient after subdomain is configured.
 */
function getGraphQLUrl(): string {
  // nhost.storage.getUrl() gives the Nhost API URL; append /v1/graphql
  // Since nhostClient uses a placeholder subdomain, we construct the URL directly.
  return 'https://your-nhost-subdomain.hasura.app/v1/graphql';
}

/**
 * Builds the headers object for replication requests.
 * Includes Content-Type and optionally the Bearer auth token.
 *
 * The token is extracted from the Nhost client's session (which handles refresh).
 * Replication uses raw fetch (not nhost.graphql.request) so we must inject manually.
 */
function getHeaders(): Record<string, string> {
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
function pullQueryBuilderAssets(checkpoint: { client_updated_at: number } | null) {
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
    variables: { lastCheckpoint: checkpoint?.client_updated_at ?? 0 },
    headers: getHeaders(),
    url: getGraphQLUrl(),
    fetch: fetch,
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
function pushMutationBuilderAssets(docs: IAsset[]) {
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
    headers: getHeaders(),
    url: getGraphQLUrl(),
    fetch: fetch,
  };
}

// ─── Pull Query Builder (Work Orders) ─────────────────────────────────────────

function pullQueryBuilderWorkOrders(checkpoint: { client_updated_at: number } | null) {
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
    variables: { lastCheckpoint: checkpoint?.client_updated_at ?? 0 },
    headers: getHeaders(),
    url: getGraphQLUrl(),
    fetch: fetch,
  };
}

// ─── Push Mutation Builder (Work Orders Upsert) ────────────────────────────────

function pushMutationBuilderWorkOrders(docs: IWorkOrder[]) {
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
    headers: getHeaders(),
    url: getGraphQLUrl(),
    fetch: fetch,
  };
}

// ─── Pull Query Builder (Reports) ──────────────────────────────────────────────

function pullQueryBuilderReports(checkpoint: { updated_at: number } | null) {
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
    variables: { lastCheckpoint: checkpoint?.updated_at ?? 0 },
    headers: getHeaders(),
    url: getGraphQLUrl(),
    fetch: fetch,
  };
}

// ─── Push Mutation Builder (Reports Upsert) ─────────────────────────────────────

function pushMutationBuilderReports(docs: IReport[]) {
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
    headers: getHeaders(),
    url: getGraphQLUrl(),
    fetch: fetch,
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
  assets: ReplicationState<IAsset, GraphQLAsset>;
  workOrders: ReplicationState<IWorkOrder, GraphQLWorkOrder>;
  reports: ReplicationState<IReport, GraphQLReport>;
}

export function startReplication(db: ChocolateIbarraDatabase): ReplicationStates {
  // ── Assets replication ──────────────────────────────────────────────────────
  const replicationAssets: ReplicationState<IAsset, GraphQLAsset> = replicateGraphQL<
    IAsset,
    GraphQLAsset
  >({
    name: 'assets-graphql-replication',
    collection: db.collections.assets,
    pull: {
      queryBuilder: pullQueryBuilderAssets,
      // modifier: transforms raw GraphQL response before RxDB insertion
      modifier: (doc: GraphQLAsset) => fromGraphQLAsset(doc),
    },
    push: {
      queryBuilder: pushMutationBuilderAssets,
    },
    liveInterval: 30000, // poll every 30 seconds when app is in foreground
    retryTime: 5000, // retry on failure after 5 seconds
    autoStart: true,
    pullBatchSize: 100,
  });

  // ── Work Orders replication ────────────────────────────────────────────────
  const replicationWorkOrders: ReplicationState<IWorkOrder, GraphQLWorkOrder> = replicateGraphQL<
    IWorkOrder,
    GraphQLWorkOrder
  >({
    name: 'work-orders-graphql-replication',
    collection: db.collections.work_orders,
    pull: {
      queryBuilder: pullQueryBuilderWorkOrders,
      modifier: (doc: GraphQLWorkOrder) => fromGraphQLWorkOrder(doc),
    },
    push: {
      queryBuilder: pushMutationBuilderWorkOrders,
    },
    liveInterval: 30000,
    retryTime: 5000,
    autoStart: true,
    pullBatchSize: 100,
  });

  // ── Reports replication ────────────────────────────────────────────────────
  const replicationReports: ReplicationState<IReport, GraphQLReport> = replicateGraphQL<
    IReport,
    GraphQLReport
  >({
    name: 'reports-graphql-replication',
    collection: db.collections.reports,
    pull: {
      queryBuilder: pullQueryBuilderReports,
      modifier: (doc: GraphQLReport) => fromGraphQLReport(doc),
    },
    push: {
      queryBuilder: pushMutationBuilderReports,
    },
    liveInterval: 30000,
    retryTime: 5000,
    autoStart: true,
    pullBatchSize: 100,
  });

  // Asset Types replication would follow the same pattern.
  // TODO: Add asset_types replication once Nhost tables are created.

  return { assets: replicationAssets, workOrders: replicationWorkOrders, reports: replicationReports };
}