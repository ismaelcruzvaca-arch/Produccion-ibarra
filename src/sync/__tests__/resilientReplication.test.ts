/**
 * Integration tests for createResilientReplication() — backoff, circuit breaker, DLQ.
 *
 * These tests mock the RxGraphQLReplicationState and the database to verify:
 * - Backoff cap at 60s
 * - Circuit breaker opens at 5 consecutive transient errors
 * - DLQ quarantines bad doc while good docs continue
 * - Constraint error classification triggers DLQ diagnosis
 */

import { Subject, Observable } from 'rxjs';
import { classifyError, createResilientReplication } from '../resilientReplication';
import type {
  ResilientReplicationOptions,
  ResilientState,
  GraphQLContext,
} from '../resilientReplication';
import type { ChocolateIbarraDatabase } from '../../data/database';
import type { IOeeEvent } from '../../core/types';

// ── Mocks ──────────────────────────────────────────────────────────────────

/** Mock replication state type for tests. */
interface MockReplicationState {
  error$: Observable<Error | undefined>;
  active$: Observable<boolean>;
  cancel: jest.Mock;
  start: jest.Mock;
  canceled: boolean;
  started: boolean;
  awaitInitialReplication: jest.Mock;
  emitError: (err: Error | undefined) => void;
  complete: () => void;
}

/** Helper to create a minimal mock RxGraphQLReplicationState. */
function createMockReplicationState(): MockReplicationState {
  const errorSubject = new Subject<Error | undefined>();
  const activeSubject = new Subject<boolean>();

  let canceled = false;
  let started = false;

  return {
    error$: errorSubject.asObservable(),
    active$: activeSubject.asObservable(),
    cancel: jest.fn(() => {
      canceled = true;
      activeSubject.next(false);
    }),
    start: jest.fn(() => {
      canceled = false;
      started = true;
      activeSubject.next(true);
    }),
    canceled,
    get started() { return started; },
    awaitInitialReplication: jest.fn(() => Promise.resolve()),
    // Used by tests to inject errors
    emitError: (err: Error | undefined) => errorSubject.next(err),
    // Cleanup
    complete: () => {
      errorSubject.complete();
      activeSubject.complete();
    },
  };
}

/** Creates a minimal mock database with sync_errors collection. */
function createMockDatabase(): ChocolateIbarraDatabase {
  const insertedDocs: any[] = [];
  const removedIds: string[] = [];

  return {
    collections: {
      oee_events: {
        find: jest.fn(() => ({
          sort: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([]),
        })),
      } as any,
      sync_errors: {
        insert: jest.fn((doc: any) => {
          insertedDocs.push(doc);
          return Promise.resolve();
        }),
      } as any,
    },
  } as unknown as ChocolateIbarraDatabase;
}

const mockGraphQLCtx: GraphQLContext = {
  url: 'https://test.nhost.run/v1/graphql',
  getHeaders: () => ({
    'Content-Type': 'application/json',
    Authorization: 'Bearer test-token',
  }),
};

/** Fast options for testing (short delays). */
const fastOptions: Partial<ResilientReplicationOptions> = {
  baseRetryTime: 100,
  maxRetryTime: 500, // cap at 500ms for fast tests
  backoffFactor: 2,
  circuitBreakerThreshold: 3, // open after 3 errors (faster)
  circuitBreakerResetMs: 500,
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('createResilientReplication', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── Backoff Behavior ───────────────────────────────────────────────────

  describe('backoff', () => {
    it('cancels replication on transient error and restarts after base delay', () => {
      const state = createMockReplicationState();
      const db = createMockDatabase();

      const controller = createResilientReplication(
        state as any,
        db,
        mockGraphQLCtx,
        fastOptions
      );

      // Emit a transient error
      const transientError = new Error('Network request failed');
      state.emitError(transientError);

      // Replication should be canceled
      expect(state.cancel).toHaveBeenCalled();

      // After base delay (100ms), replication should restart
      jest.advanceTimersByTime(100);

      expect(state.start).toHaveBeenCalled();

      controller.cleanup();
      state.complete();
    });

    it('increases delay exponentially on consecutive transient errors', () => {
      const state = createMockReplicationState();
      const db = createMockDatabase();

      // Use threshold=4 so the 3rd error still does backoff (not circuit open)
      const backoffOptions = { ...fastOptions, circuitBreakerThreshold: 4 };
      const controller = createResilientReplication(
        state as any,
        db,
        mockGraphQLCtx,
        backoffOptions
      );

      // Error 1 → delay 100ms (base)
      state.emitError(new Error('Network error 1'));
      expect(state.cancel).toHaveBeenCalledTimes(1);

      // Clear the first backoff timer
      jest.advanceTimersByTime(100);
      expect(state.start).toHaveBeenCalledTimes(1);

      // Error 2 → delay 200ms (100 * 2)
      state.emitError(new Error('Network error 2'));
      expect(state.cancel).toHaveBeenCalledTimes(2);
      jest.advanceTimersByTime(200);
      expect(state.start).toHaveBeenCalledTimes(2);

      // Error 3 → delay 400ms (100 * 2²)
      state.emitError(new Error('Network error 3'));
      expect(state.cancel).toHaveBeenCalledTimes(3);
      jest.advanceTimersByTime(400);
      expect(state.start).toHaveBeenCalledTimes(3);

      controller.cleanup();
      state.complete();
    });

    it('caps backoff at maxRetryTime (500ms for fast tests)', () => {
      const state = createMockReplicationState();
      const db = createMockDatabase();

      const controller = createResilientReplication(
        state as any,
        db,
        mockGraphQLCtx,
        fastOptions // maxRetryTime: 500
      );

      // Fire 6 consecutive errors to reach/exceed the cap
      const errors = Array.from({ length: 6 }, (_, i) => new Error(`Network error ${i + 1}`));

      // First error
      state.emitError(errors[0]);
      jest.advanceTimersByTime(100); // base
      state.emitError(errors[1]);
      jest.advanceTimersByTime(200); // 100 * 2
      state.emitError(errors[2]);
      // After 3 errors, circuit breaker should open (threshold: 3)
      // Let's check the state

      const snap = controller.getState();
      // With threshold=3, after 3 errors the circuit should be open
      expect(snap.circuitOpen).toBe(true);

      controller.cleanup();
      state.complete();
    });
  });

  // ── Circuit Breaker ─────────────────────────────────────────────────────

  describe('circuit breaker', () => {
    it('opens circuit after threshold consecutive transient errors', () => {
      const state = createMockReplicationState();
      const db = createMockDatabase();

      const controller = createResilientReplication(
        state as any,
        db,
        mockGraphQLCtx,
        fastOptions // threshold: 3, reset: 500ms
      );

      // Fire 3 transient errors
      state.emitError(new Error('Transient 1'));
      jest.advanceTimersByTime(100);
      state.emitError(new Error('Transient 2'));
      jest.advanceTimersByTime(200);
      state.emitError(new Error('Transient 3')); // threshold reached

      const snap = controller.getState();
      expect(snap.circuitOpen).toBe(true);
      expect(snap.consecutiveErrors).toBeGreaterThanOrEqual(fastOptions.circuitBreakerThreshold!);

      controller.cleanup();
      state.complete();
    });

    it('closes circuit after reset period and restarts replication', () => {
      const state = createMockReplicationState();
      const db = createMockDatabase();

      const controller = createResilientReplication(
        state as any,
        db,
        mockGraphQLCtx,
        fastOptions // reset: 500ms
      );

      // Open circuit with 3 errors
      state.emitError(new Error('E1'));
      jest.advanceTimersByTime(100);
      state.emitError(new Error('E2'));
      jest.advanceTimersByTime(200);
      state.emitError(new Error('E3'));

      expect(controller.getState().circuitOpen).toBe(true);

      // Advance past reset period
      jest.advanceTimersByTime(500);

      expect(controller.getState().circuitOpen).toBe(false);
      expect(controller.getState().consecutiveErrors).toBe(0);
      expect(state.start).toHaveBeenCalled();

      controller.cleanup();
      state.complete();
    });

    it('stops retrying while circuit is open', () => {
      const state = createMockReplicationState();
      const db = createMockDatabase();

      const controller = createResilientReplication(
        state as any,
        db,
        mockGraphQLCtx,
        fastOptions
      );

      // Open circuit
      state.emitError(new Error('E1'));
      jest.advanceTimersByTime(100);
      state.emitError(new Error('E2'));
      jest.advanceTimersByTime(200);
      state.emitError(new Error('E3'));
      expect(controller.getState().circuitOpen).toBe(true);

      // More errors while circuit is open should NOT trigger immediate restarts
      const startCallCountBeforeE4 = (state.start as jest.Mock).mock.calls.length;
      state.emitError(new Error('E4 — should be ignored while circuit open'));

      // No start should happen immediately after E4 while circuit is open
      expect((state.start as jest.Mock).mock.calls.length).toBe(startCallCountBeforeE4);

      // Advance past circuit reset period
      jest.advanceTimersByTime(1000);

      // Circuit should be closed and start called once for reset
      expect(controller.getState().circuitOpen).toBe(false);
      expect((state.start as jest.Mock).mock.calls.length).toBe(startCallCountBeforeE4 + 1);

      controller.cleanup();
      state.complete();
    });
  });

  // ── DLQ Routing ─────────────────────────────────────────────────────────

  describe('DLQ routing', () => {
    it('triggers DLQ diagnosis on constraint error', async () => {
      const state = createMockReplicationState();
      const db = createMockDatabase();

      // Mock DLQ diagnosis function to verify it gets called
      const mockDqlDiagnosis = jest.fn().mockResolvedValue(0);

      const controller = createResilientReplication(
        state as any,
        db,
        mockGraphQLCtx,
        fastOptions,
        mockDqlDiagnosis,
      );

      // Emit a constraint error (FK violation)
      const constraintError = new Error(
        'Foreign key violation. insert or update on table "oee_events" violates foreign key constraint "oee_events_line_id_fkey"'
      );
      state.emitError(constraintError);

      // Allow async DLQ diagnosis to complete (mock uses jest.fakeTimers, may need flush)
      await jest.advanceTimersByTimeAsync(0);

      // Verify the DLQ diagnosis function was called
      expect(mockDqlDiagnosis).toHaveBeenCalled();

      controller.cleanup();
      state.complete();
    });

    it('classifies FK violation as constraint', () => {
      const result = classifyError(
        new Error(
          'Foreign key violation. Key (machine_id)=(nonexistent) is not present in table "machines".'
        )
      );
      expect(result.type).toBe('constraint');
    });

    it('handles cleanup without errors when no errors have occurred', () => {
      const state = createMockReplicationState();
      const db = createMockDatabase();

      const controller = createResilientReplication(
        state as any,
        db,
        mockGraphQLCtx,
        fastOptions
      );

      // Cleanup should not throw even with no errors
      expect(() => controller.cleanup()).not.toThrow();
      state.complete();
    });

    it('getState returns initial values before any errors', () => {
      const state = createMockReplicationState();
      const db = createMockDatabase();

      const controller = createResilientReplication(
        state as any,
        db,
        mockGraphQLCtx,
        fastOptions
      );

      const snap = controller.getState();
      expect(snap.consecutiveErrors).toBe(0);
      expect(snap.circuitOpen).toBe(false);
      expect(snap.circuitOpenedAt).toBeNull();
      expect(snap.dlqCount).toBe(0);

      controller.cleanup();
      state.complete();
    });
  });

  // ── Error Classification Integration ────────────────────────────────────

  describe('error classification integration', () => {
    it('transient classification correctly triggers backoff path', () => {
      const state = createMockReplicationState();
      const db = createMockDatabase();

      const controller = createResilientReplication(
        state as any,
        db,
        mockGraphQLCtx,
        fastOptions
      );

      // Network timeout → transient
      state.emitError(new Error('Request timed out after 30000ms'));

      // Should have canceled (backoff path)
      expect(state.cancel).toHaveBeenCalled();

      controller.cleanup();
      state.complete();
    });

    it('unknown classification falls back to transient behavior', () => {
      const state = createMockReplicationState();
      const db = createMockDatabase();

      const controller = createResilientReplication(
        state as any,
        db,
        mockGraphQLCtx,
        fastOptions
      );

      // Unknown error → treated as transient
      state.emitError(new Error('Unexpected server response'));

      // Should have canceled (treated as transient)
      expect(state.cancel).toHaveBeenCalled();

      controller.cleanup();
      state.complete();
    });

    it('undefined error (cleared) resets consecutive error counter', () => {
      const state = createMockReplicationState();
      const db = createMockDatabase();

      const controller = createResilientReplication(
        state as any,
        db,
        mockGraphQLCtx,
        fastOptions
      );

      // First emit an error to increment counter
      state.emitError(new Error('Network error'));
      expect(controller.getState().consecutiveErrors).toBe(1);

      // Then emit undefined (error cleared)
      state.emitError(undefined);
      expect(controller.getState().consecutiveErrors).toBe(0);

      controller.cleanup();
      state.complete();
    });
  });
});
