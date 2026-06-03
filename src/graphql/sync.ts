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

import { getAuthToken } from './nhostClient';
import {
  toGraphQLOeeEvent,
  fromGraphQLOeeEvent,
  toGraphQLSignature,
  fromGraphQLSignature,
  toGraphQLQualityInspection,
  fromGraphQLQualityInspection,
  toGraphQLDefectLog,
  fromGraphQLDefectLog,
  toGraphQLWeightLog,
  fromGraphQLWeightLog,
  type GraphQLOeeEvent,
  type GraphQLSignature,
  type GraphQLQualityInspection,
  type GraphQLDefectLog,
  type GraphQLWeightLog,
} from './dto';
import type { IOeeEvent, ISignature, IQualityInspection, IDefectLog, IWeightLog } from '../core/types';
import type { ChocolateIbarraDatabase } from '../data/database';
import { createResilientReplication, runDLQDiagnosis, type ResilientState } from '../sync/resilientReplication';

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

// ─── Pull Query Builder (Signatures) ──────────────────────────────────────────

function pullQueryBuilderSignatures(checkpoint: GraphQLSignature | undefined, _limit: number) {
  return {
    query: `
      query PullSignatures($lastCheckpoint: bigint!) {
        signatures(
          where: { updated_at: { _gt: $lastCheckpoint } },
          order_by: { updated_at: asc }
        ) {
          id
          document_type
          document_id
          signer_id
          signer_name
          signer_role
          signed_at
          sequence
          is_deleted
          created_at
          updated_at
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.updated_at ? parseInt(checkpoint.updated_at, 10) : 0 },
  };
}

// ─── Push Mutation Builder (Signatures Upsert) ─────────────────────────────────

function pushMutationBuilderSignatures(docs: any[]) {
  const objects = docs.map(toGraphQLSignature);
  return {
    query: `
      mutation UpsertSignatures($objects: [signatures_insert_input!]!) {
        insert_signatures(
          objects: $objects,
          on_conflict: {
            constraint: signatures_pkey,
            update_columns: [
              document_type, document_id, signer_id, signer_name,
              signer_role, signed_at, sequence, is_deleted,
              created_at, updated_at
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

// ─── Pull Query Builder (Quality Inspections) ─────────────────────────────────

function pullQueryBuilderQualityInspections(checkpoint: GraphQLQualityInspection | undefined, _limit: number) {
  return {
    query: `
      query PullQualityInspections($lastCheckpoint: bigint!) {
        quality_inspections(
          where: { updated_at: { _gt: $lastCheckpoint } },
          order_by: { updated_at: asc }
        ) {
          id
          line_id
          operator_id
          shift_id
          product_code
          result
          notes
          created_at
          updated_at
          is_deleted
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.updated_at ? parseInt(checkpoint.updated_at, 10) : 0 },
  };
}

// ─── Push Mutation Builder (Quality Inspections Upsert) ───────────────────────

function pushMutationBuilderQualityInspections(docs: any[]) {
  const objects = docs.map(toGraphQLQualityInspection);
  return {
    query: `
      mutation UpsertQualityInspections($objects: [quality_inspections_insert_input!]!) {
        insert_quality_inspections(
          objects: $objects,
          on_conflict: {
            constraint: quality_inspections_pkey,
            update_columns: [
              line_id, operator_id, shift_id, product_code,
              result, notes, is_deleted
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

// ─── Pull Query Builder (Defect Logs) ─────────────────────────────────────────

function pullQueryBuilderDefectLogs(checkpoint: GraphQLDefectLog | undefined, _limit: number) {
  return {
    query: `
      query PullDefectLogs($lastCheckpoint: bigint!) {
        defect_logs(
          where: { updated_at: { _gt: $lastCheckpoint } },
          order_by: { updated_at: asc }
        ) {
          id
          inspection_id
          defect_type
          defect_code
          quantity
          severity
          notes
          registered_at
          updated_at
          is_deleted
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.updated_at ? parseInt(checkpoint.updated_at, 10) : 0 },
  };
}

// ─── Push Mutation Builder (Defect Logs Upsert) ────────────────────────────────

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
              inspection_id, defect_type, defect_code, quantity,
              severity, notes, is_deleted
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

// ─── Pull Query Builder (Weight Logs) ─────────────────────────────────────────

function pullQueryBuilderWeightLogs(checkpoint: GraphQLWeightLog | undefined, _limit: number) {
  return {
    query: `
      query PullWeightLogs($lastCheckpoint: bigint!) {
        weight_logs(
          where: { updated_at: { _gt: $lastCheckpoint } },
          order_by: { updated_at: asc }
        ) {
          id
          inspection_id
          product_code
          target_weight
          actual_weight
          tolerance
          result
          registered_at
          updated_at
          is_deleted
        }
      }
    `,
    variables: { lastCheckpoint: checkpoint?.updated_at ? parseInt(checkpoint.updated_at, 10) : 0 },
  };
}

// ─── Push Mutation Builder (Weight Logs Upsert) ────────────────────────────────

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
              inspection_id, product_code, target_weight,
              actual_weight, result, is_deleted
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
  oeeEvents: RxGraphQLReplicationState<IOeeEvent, GraphQLOeeEvent>;
  signatures: RxGraphQLReplicationState<ISignature, GraphQLSignature>;
  qualityInspections: RxGraphQLReplicationState<IQualityInspection, GraphQLQualityInspection>;
  defectLogs: RxGraphQLReplicationState<IDefectLog, GraphQLDefectLog>;
  weightLogs: RxGraphQLReplicationState<IWeightLog, GraphQLWeightLog>;
  /** Resilient replication controller for OEE events (backoff, circuit breaker, DLQ). */
  resilientOeeController?: { cleanup: () => void; getState: () => ResilientState };
  /** Resilient replication controller for signatures (backoff + circuit breaker only). */
  resilientSignaturesController?: { cleanup: () => void; getState: () => ResilientState };
  /** Resilient replication controller for quality inspections (backoff + circuit breaker only). */
  resilientQualityInspectionsController?: { cleanup: () => void; getState: () => ResilientState };
  /** Resilient replication controller for defect logs (backoff + circuit breaker only). */
  resilientDefectLogsController?: { cleanup: () => void; getState: () => ResilientState };
  /** Resilient replication controller for weight logs (backoff + circuit breaker only). */
  resilientWeightLogsController?: { cleanup: () => void; getState: () => ResilientState };
}

export function startReplication(db: ChocolateIbarraDatabase): ReplicationStates {
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
      undefined,
      runDLQDiagnosis,
    );
  } catch (err) {
    console.warn('OeeEvents replication failed to initialise:', err);
    replicationOeeEvents = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  // ── Signatures replication ─────────────────────────────────────────────────
  let replicationSignatures: RxGraphQLReplicationState<ISignature, GraphQLSignature>;
  let resilientSignaturesController: { cleanup: () => void; getState: () => ResilientState } | undefined;
  try {
    replicationSignatures = replicateGraphQL<ISignature, GraphQLSignature>({
      replicationIdentifier: 'signatures-graphql-replication',
      url: { http: getGraphQLUrl() },
      headers: getHeaders(),
      collection: db.collections.signatures,
      pull: {
        queryBuilder: pullQueryBuilderSignatures,
        modifier: (doc: GraphQLSignature) => ({ ...fromGraphQLSignature(doc), _deleted: doc.is_deleted ?? false }),
      },
      push: {
        queryBuilder: pushMutationBuilderSignatures,
      },
      live: false,
      autoStart: true,
    });

    // Wrap with resilience (backoff + circuit breaker, no DLQ)
    resilientSignaturesController = createResilientReplication(
      replicationSignatures,
      db,
      { url: getGraphQLUrl(), getHeaders },
    );
  } catch (err) {
    console.warn('Signatures replication failed to initialise:', err);
    replicationSignatures = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  // ── Quality Inspections replication ────────────────────────────────────────
  let replicationQualityInspections: RxGraphQLReplicationState<IQualityInspection, GraphQLQualityInspection>;
  let resilientQualityInspectionsController: { cleanup: () => void; getState: () => ResilientState } | undefined;
  try {
    replicationQualityInspections = replicateGraphQL<IQualityInspection, GraphQLQualityInspection>({
      replicationIdentifier: 'quality-inspections-graphql-replication',
      url: { http: getGraphQLUrl() },
      headers: getHeaders(),
      collection: db.collections.quality_inspections,
      pull: {
        queryBuilder: pullQueryBuilderQualityInspections,
        modifier: (doc: GraphQLQualityInspection) => ({ ...fromGraphQLQualityInspection(doc), _deleted: doc.is_deleted ?? false }),
      },
      push: {
        queryBuilder: pushMutationBuilderQualityInspections,
      },
      live: false,
      autoStart: true,
    });

    // Wrap with resilience (backoff + circuit breaker, no DLQ)
    resilientQualityInspectionsController = createResilientReplication(
      replicationQualityInspections,
      db,
      { url: getGraphQLUrl(), getHeaders },
    );
  } catch (err) {
    console.warn('QualityInspections replication failed to initialise:', err);
    replicationQualityInspections = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  // ── Defect Logs replication ────────────────────────────────────────────────
  let replicationDefectLogs: RxGraphQLReplicationState<IDefectLog, GraphQLDefectLog>;
  let resilientDefectLogsController: { cleanup: () => void; getState: () => ResilientState } | undefined;
  try {
    replicationDefectLogs = replicateGraphQL<IDefectLog, GraphQLDefectLog>({
      replicationIdentifier: 'defect-logs-graphql-replication',
      url: { http: getGraphQLUrl() },
      headers: getHeaders(),
      collection: db.collections.defect_logs,
      pull: {
        queryBuilder: pullQueryBuilderDefectLogs,
        modifier: (doc: GraphQLDefectLog) => ({ ...fromGraphQLDefectLog(doc), _deleted: doc.is_deleted ?? false }),
      },
      push: {
        queryBuilder: pushMutationBuilderDefectLogs,
      },
      live: false,
      autoStart: true,
    });

    // Wrap with resilience (backoff + circuit breaker, no DLQ)
    resilientDefectLogsController = createResilientReplication(
      replicationDefectLogs,
      db,
      { url: getGraphQLUrl(), getHeaders },
    );
  } catch (err) {
    console.warn('DefectLogs replication failed to initialise:', err);
    replicationDefectLogs = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  // ── Weight Logs replication ────────────────────────────────────────────────
  let replicationWeightLogs: RxGraphQLReplicationState<IWeightLog, GraphQLWeightLog>;
  let resilientWeightLogsController: { cleanup: () => void; getState: () => ResilientState } | undefined;
  try {
    replicationWeightLogs = replicateGraphQL<IWeightLog, GraphQLWeightLog>({
      replicationIdentifier: 'weight-logs-graphql-replication',
      url: { http: getGraphQLUrl() },
      headers: getHeaders(),
      collection: db.collections.weight_logs,
      pull: {
        queryBuilder: pullQueryBuilderWeightLogs,
        modifier: (doc: GraphQLWeightLog) => ({ ...fromGraphQLWeightLog(doc), _deleted: doc.is_deleted ?? false }),
      },
      push: {
        queryBuilder: pushMutationBuilderWeightLogs,
      },
      live: false,
      autoStart: true,
    });

    // Wrap with resilience (backoff + circuit breaker, no DLQ)
    resilientWeightLogsController = createResilientReplication(
      replicationWeightLogs,
      db,
      { url: getGraphQLUrl(), getHeaders },
    );
  } catch (err) {
    console.warn('WeightLogs replication failed to initialise:', err);
    replicationWeightLogs = { canceled: false, awaitInitialReplication: () => Promise.resolve() } as any;
  }

  return {
    oeeEvents: replicationOeeEvents,
    signatures: replicationSignatures,
    qualityInspections: replicationQualityInspections,
    defectLogs: replicationDefectLogs,
    weightLogs: replicationWeightLogs,
    resilientOeeController,
    resilientSignaturesController,
    resilientQualityInspectionsController,
    resilientDefectLogsController,
    resilientWeightLogsController,
  };
}