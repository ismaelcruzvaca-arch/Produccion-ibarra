/**
 * Resilient replication wrapper — exponential backoff, circuit breaker, DLQ routing.
 *
 * Pattern: Decorator / Resilience Layer
 * Why:
 * - OEE events are mission-critical offline-first data. Plain replicateGraphQL
 *   has only fixed retryTime — no exponential backoff, no circuit breaker,
 *   and no dead-letter queue for permanently-failed documents.
 * - This wrapper subscribes to the replication state's error$ observable and:
 *   1. Classifies errors (constraint vs transient vs unknown)
 *   2. Applies exponential backoff for transient errors
 *   3. Opens a circuit breaker after N consecutive transient errors
 *   4. Routes constraint-failing documents to the sync_errors DLQ collection
 * - The wrapper does NOT fork RxDB internals — it decorates the existing
 *   RxGraphQLReplicationState with resilience behavior.
 */

import type { RxGraphQLReplicationState } from 'rxdb/plugins/replication-graphql';
import type { ChocolateIbarraDatabase } from '../data/database';
import type { IOeeEvent, ISyncError } from '../core/types';
import { toGraphQLOeeEvent } from '../graphql/dto';
import { generateUuid } from '../utils/uuid';

// ─── Error Classification ─────────────────────────────────────────────────────

/** Classification result for a replication push error. */
export type ClassifiedError =
  | { type: 'constraint'; message: string; docId: string }
  | { type: 'transient'; message: string }
  | { type: 'unknown'; message: string };

/**
 * Classifies a replication error into constraint, transient, or unknown.
 *
 * Heuristics:
 * - GraphQL constraint/validation errors from Hasura contain keywords like
 *   "foreign key", "constraint", "violates", "duplicate key", "not-null".
 * - Transient errors: network failures, timeouts, 5xx HTTP status.
 * - Unknown: anything that doesn't match the above patterns.
 *
 * @param error - The raw error from RxDB's error$ stream (or any thrown value)
 * @returns ClassifiedError with type, message, and optional docId
 */
export function classifyError(error: unknown): ClassifiedError {
  if (!error) return { type: 'unknown', message: 'No error provided' };
  const message = extractErrorMessage(error);
  const lower = message.toLowerCase();

  // ── Constraint / validation errors (FK violations, unique constraints, not-null) ──
  if (
    lower.includes('foreign key') ||
    lower.includes('constraint') ||
    lower.includes('violates') ||
    lower.includes('duplicate key') ||
    lower.includes('not-null') ||
    lower.includes('violates not-null') ||
    lower.includes('fk_') ||
    lower.includes('_fkey') ||
    lower.includes('check constraint')
  ) {
    // Try to extract a document ID from the error message if present
    const docId = extractDocIdFromError(message);
    return { type: 'constraint', message, docId };
  }

  // ── Transient errors (network, timeout, server unavailable) ──
  if (
    lower.includes('network') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('econnreset') ||
    lower.includes('etimedout') ||
    lower.includes('fetch failed') ||
    lower.includes('abort') ||
    lower.includes('503') ||
    lower.includes('502') ||
    lower.includes('504') ||
    lower.includes('gateway') ||
    lower.includes('unavailable') ||
    lower.includes('dns') ||
    lower.includes('socket')
  ) {
    return { type: 'transient', message };
  }

  // ── Unknown errors ──
  return { type: 'unknown', message };
}

/** Extracts a human-readable error message from any thrown value. */
function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

/** Attempts to extract a document ID from a GraphQL error message. */
function extractDocIdFromError(message: string): string {
  // Try UUID pattern in the message
  const uuidMatch = message.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuidMatch) return uuidMatch[0];

  // Try quoted string that looks like an ID
  const quoteMatch = message.match(/"([^"]+)"/);
  if (quoteMatch && quoteMatch[1].length > 10) return quoteMatch[1];

  return 'unknown-doc';
}

// ─── Backoff & Circuit Breaker State ───────────────────────────────────────────

/** Configuration for the resilient replication wrapper. */
export interface ResilientReplicationOptions {
  /** Base retry interval in milliseconds (default: 5000 = 5s). */
  baseRetryTime: number;
  /** Maximum retry interval cap in milliseconds (default: 60000 = 60s). */
  maxRetryTime: number;
  /** Exponential backoff factor (default: 2). */
  backoffFactor: number;
  /** Number of consecutive transient errors before opening circuit breaker. */
  circuitBreakerThreshold: number;
  /** How long the circuit stays open before resetting (ms, default: 30000 = 30s). */
  circuitBreakerResetMs: number;
}

const DEFAULT_OPTIONS: ResilientReplicationOptions = {
  baseRetryTime: 5000,
  maxRetryTime: 60000,
  backoffFactor: 2,
  circuitBreakerThreshold: 5,
  circuitBreakerResetMs: 30000,
};

/** Exposed state for monitoring and debugging. */
export interface ResilientState {
  consecutiveErrors: number;
  currentDelay: number;
  circuitOpen: boolean;
  circuitOpenedAt: number | null;
  lastError: string | null;
  dlqCount: number;
}

// ─── Individual Doc Pusher (for DLQ diagnosis) ─────────────────────────────────

/** GraphQL endpoint + headers provider (supplied by sync.ts to avoid circular deps). */
export interface GraphQLContext {
  url: string;
  getHeaders: () => Record<string, string>;
}

/**
 * Pushes a single OEE event document to Hasura via the upsert mutation.
 * Used during DLQ diagnosis to identify which document is causing the failure.
 *
 * @returns true if the push succeeded, false if it failed (error details logged)
 */
async function tryPushSingleOeeEvent(
  doc: IOeeEvent,
  gqlCtx: GraphQLContext
): Promise<boolean> {
  const gqlDoc = toGraphQLOeeEvent(doc);

  const query = `
    mutation UpsertSingleOeeEventDiagnosis($objects: [oee_events_insert_input!]!) {
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
  `;

  try {
    const response = await fetch(gqlCtx.url, {
      method: 'POST',
      headers: gqlCtx.getHeaders(),
      body: JSON.stringify({ query, variables: { objects: [gqlDoc] } }),
    });

    if (!response.ok) {
      console.warn(
        `[resilientReplication] Push for doc ${doc.id} failed with HTTP ${response.status}`
      );
      return false;
    }

    const json = await response.json();

    if (json.errors && json.errors.length > 0) {
      console.warn(
        `[resilientReplication] Push for doc ${doc.id} returned GraphQL errors:`,
        json.errors
      );
      return false;
    }

    return true;
  } catch (err) {
    console.warn(`[resilientReplication] Push for doc ${doc.id} threw:`, err);
    return false;
  }
}

// ─── DLQ Routing ───────────────────────────────────────────────────────────────

/**
 * Finds all pending OEE events (non-deleted), pushes each individually,
 * and quarantines the ones that fail.
 *
 * Strategy:
 * 1. Query all non-deleted oee_events docs
 * 2. For each doc, attempt an individual push
 * 3. If push succeeds: doc was already synced or syncs now → move to next
 * 4. If push fails: classify the error, quarantine to sync_errors, remove from oee_events
 * 5. Return count of quarantined docs
 */
async function runDLQDiagnosis(
  db: ChocolateIbarraDatabase,
  gqlCtx: GraphQLContext
): Promise<number> {
  const collection = db.collections.oee_events;
  const syncErrors = db.collections.sync_errors;

  // Find all non-deleted OEE events ordered by timestamp
  const pendingDocs = await collection
    .find({ selector: { is_deleted: { $eq: false } }, sort: [{ timestamp: 'asc' }] })
    .exec();

  if (pendingDocs.length === 0) return 0;

  console.info(
    `[resilientReplication] DLQ diagnosis: checking ${pendingDocs.length} pending OEE events`
  );

  let quarantined = 0;

  for (const rxDoc of pendingDocs) {
    const doc = rxDoc.toJSON() as unknown as IOeeEvent;

    const success = await tryPushSingleOeeEvent(doc, gqlCtx);

    if (!success) {
      // Quarantine: insert into sync_errors, then remove from oee_events
      const now = Date.now();
      const syncError: ISyncError = {
        id: generateUuid(),
        created_at: now,
        updated_at: now,
        is_deleted: false,
        id_evento: doc.id,
        payload_original: doc as unknown as Record<string, unknown>,
        mensaje_error: `Constraint/validation error during DLQ diagnosis — doc quarantined at ${now}`,
        fecha: now,
      };

      try {
        await syncErrors.insert(syncError);
        await rxDoc.remove(); // hard-remove the bad doc so it stops blocking the queue
        quarantined++;
        console.warn(
          `[resilientReplication] Doc ${doc.id} quarantined to sync_errors`
        );
      } catch (err) {
        console.error(
          `[resilientReplication] Failed to quarantine doc ${doc.id}:`,
          err
        );
      }
    }
  }

  console.info(
    `[resilientReplication] DLQ diagnosis complete: ${quarantined} doc(s) quarantined, ${pendingDocs.length - quarantined} OK`
  );

  return quarantined;
}

// ─── Resilient Replication Factory ─────────────────────────────────────────────

/**
 * Wraps an RxDB GraphQL replication state with resilience behaviors:
 * - Exponential backoff on transient errors (base 5s, cap 60s, factor 2)
 * - Circuit breaker (opens after N consecutive transient errors, resets after 30s)
 * - Dead-Letter Queue routing (constraint errors trigger individual doc diagnosis
 *   and quarantine of bad docs to sync_errors collection)
 *
 * The wrapper subscribes to the replication's error$ stream and manages
 * its own backoff/circuit state. It calls cancel()/start() on the underlying
 * replication state to enforce delays.
 *
 * @param replicationState - The RxGraphQLReplicationState from replicateGraphQL()
 * @param db - The RxDB database instance (to access oee_events and sync_errors)
 * @param gqlCtx - GraphQL endpoint URL and headers getter
 * @param options - Optional overrides for backoff/circuit breaker parameters
 * @returns Controller with cleanup() and getState()
 */
export function createResilientReplication<CheckpointType = unknown>(
  replicationState: RxGraphQLReplicationState<IOeeEvent, CheckpointType>,
  db: ChocolateIbarraDatabase,
  gqlCtx: GraphQLContext,
  options: Partial<ResilientReplicationOptions> = {}
): { cleanup: () => void; getState: () => ResilientState } {
  const opts: ResilientReplicationOptions = { ...DEFAULT_OPTIONS, ...options };

  // ── Mutable resilience state ──
  const state: ResilientState = {
    consecutiveErrors: 0,
    currentDelay: opts.baseRetryTime,
    circuitOpen: false,
    circuitOpenedAt: null,
    lastError: null,
    dlqCount: 0,
  };

  let backoffTimer: ReturnType<typeof setTimeout> | null = null;
  let circuitTimer: ReturnType<typeof setTimeout> | null = null;
  let isCleanedUp = false;

  /**
   * Stops the underlying replication and starts a backoff timer.
   * After the delay, restarts replication (unless circuit is open).
   */
  function scheduleBackoff(): void {
    if (isCleanedUp) return;

    // Cancel the replication to pause pushes
    try {
      replicationState.cancel();
    } catch {
      // Replication may already be canceled
    }

    // Clear any existing timer
    if (backoffTimer) {
      clearTimeout(backoffTimer);
      backoffTimer = null;
    }

    const delay = state.currentDelay;

    console.info(
      `[resilientReplication] Backoff: waiting ${delay}ms before retry ` +
        `(consecutive errors: ${state.consecutiveErrors}, circuit: ${state.circuitOpen ? 'OPEN' : 'CLOSED'})`
    );

    backoffTimer = setTimeout(() => {
      backoffTimer = null;
      if (isCleanedUp || state.circuitOpen) return;

      try {
        replicationState.start();
      } catch {
        // Start may fail if already started
      }
    }, delay);
  }

  /**
   * Opens the circuit breaker: prevents all retries for the reset period.
   * After resetMs, closes the circuit and restarts replication.
   */
  function openCircuit(): void {
    if (isCleanedUp || state.circuitOpen) return;

    state.circuitOpen = true;
    state.circuitOpenedAt = Date.now();

    console.warn(
      `[resilientReplication] Circuit breaker OPEN — pausing for ${opts.circuitBreakerResetMs}ms ` +
        `(${state.consecutiveErrors} consecutive transient errors)`
    );

    // Cancel replication
    try {
      replicationState.cancel();
    } catch {
      // Already canceled
    }

    // Clear backoff timer
    if (backoffTimer) {
      clearTimeout(backoffTimer);
      backoffTimer = null;
    }

    // Schedule circuit reset
    circuitTimer = setTimeout(() => {
      circuitTimer = null;
      if (isCleanedUp) return;

      state.circuitOpen = false;
      state.circuitOpenedAt = null;
      state.consecutiveErrors = 0;
      state.currentDelay = opts.baseRetryTime;
      state.lastError = null;

      console.info('[resilientReplication] Circuit breaker CLOSED — resuming replication');

      try {
        replicationState.start();
      } catch {
        // Start may fail
      }
    }, opts.circuitBreakerResetMs);
  }

  /** Closes the circuit breaker early (e.g., manual retry). */
  function closeCircuit(): void {
    if (!state.circuitOpen) return;

    if (circuitTimer) {
      clearTimeout(circuitTimer);
      circuitTimer = null;
    }

    state.circuitOpen = false;
    state.circuitOpenedAt = null;
    state.consecutiveErrors = 0;
    state.currentDelay = opts.baseRetryTime;
    state.lastError = null;

    console.info('[resilientReplication] Circuit breaker manually CLOSED');

    try {
      replicationState.start();
    } catch {
      // Start may fail
    }
  }

  /** Handles a transient error: increments counter, increases delay, checks circuit. */
  function handleTransientError(): void {
    state.consecutiveErrors++;
    state.currentDelay = Math.min(
      opts.maxRetryTime,
      opts.baseRetryTime * Math.pow(opts.backoffFactor, state.consecutiveErrors - 1)
    );

    if (state.consecutiveErrors >= opts.circuitBreakerThreshold) {
      openCircuit();
    } else {
      scheduleBackoff();
    }
  }

  /** Handles a constraint error: triggers DLQ diagnosis to quarantine bad docs. */
  async function handleConstraintError(): Promise<void> {
    console.warn(
      '[resilientReplication] Constraint error detected — running DLQ diagnosis'
    );

    try {
      // Cancel replication so we can work on the queue safely
      try {
        replicationState.cancel();
      } catch {
        // Already canceled
      }

      const quarantined = await runDLQDiagnosis(db, gqlCtx);
      state.dlqCount += quarantined;

      // Reset error state and resume replication
      state.consecutiveErrors = 0;
      state.currentDelay = opts.baseRetryTime;
      state.lastError = null;

      if (state.circuitOpen) {
        closeCircuit();
      } else {
        try {
          replicationState.start();
        } catch {
          // Start may fail if already started
        }
      }
    } catch (err) {
      console.error('[resilientReplication] DLQ diagnosis failed:', err);
      // Fall back to treating as transient
      state.lastError = err instanceof Error ? err.message : String(err);
      handleTransientError();
    }
  }

  // ── Subscribe to error$ stream ──
  const errorSub = replicationState.error$.subscribe((error: Error | undefined) => {
    if (isCleanedUp) return;
    if (!error) {
      // error$ emits undefined when error is cleared — treat as recovery
      if (state.consecutiveErrors > 0) {
        state.consecutiveErrors = 0;
        state.currentDelay = opts.baseRetryTime;
        console.info('[resilientReplication] Error cleared, resetting backoff');
      }
      return;
    }

    const classification = classifyError(error);
    state.lastError = classification.message;

    console.warn(
      `[resilientReplication] Error classified as "${classification.type}": ${classification.message}`
    );

    switch (classification.type) {
      case 'transient':
        handleTransientError();
        break;

      case 'constraint':
        // Fire-and-forget: DLQ diagnosis runs asynchronously
        handleConstraintError().catch((err) => {
          console.error('[resilientReplication] Unhandled DLQ error:', err);
        });
        break;

      case 'unknown':
      default:
        // Treat unknown as transient for safety — retry with backoff
        console.warn(
          '[resilientReplication] Unknown error treated as transient for safety'
        );
        handleTransientError();
        break;
    }
  });

  // ── Return controller ──
  return {
    /** Clean up all subscriptions and timers. Call on unmount / app close. */
    cleanup: () => {
      isCleanedUp = true;
      errorSub.unsubscribe();
      if (backoffTimer) {
        clearTimeout(backoffTimer);
        backoffTimer = null;
      }
      if (circuitTimer) {
        clearTimeout(circuitTimer);
        circuitTimer = null;
      }
    },

    /** Returns a snapshot of the current resilience state (for debugging/monitoring). */
    getState: (): ResilientState => ({ ...state }),
  };
}
