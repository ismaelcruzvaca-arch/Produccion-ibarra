import React from 'react';
import { create as createRenderer, act } from 'react-test-renderer';
import { useShiftSessionsRepository } from '../useShiftSessionsRepository';

// Mock the database context
jest.mock('../../data/DatabaseContext', () => ({
  useDatabase: () => mockDb,
}));

let mockUuidCounter = 0;

// Mock uuid
jest.mock('../../utils/uuid', () => ({
  generateUuid: () => `uuid-${++mockUuidCounter}`,
}));

// Mock timestamp
jest.mock('../../utils/timestamp', () => ({
  nowMs: () => 1234567890,
}));

// Mock deviceId
jest.mock('../../sync/deviceId', () => ({
  getDeviceId: jest.fn().mockResolvedValue('device-test-1'),
  getDeviceIdSync: jest.fn().mockReturnValue('device-test-1'),
}));

// Create a mock RxDB collection for shift_sessions
const createMockCollection = () => {
  const docs = new Map<string, Record<string, unknown>>();
  let nextId = 1;

  return {
    insert: jest.fn(async (doc: Record<string, unknown>) => {
      const id = (doc.id as string) || `doc-${nextId++}`;
      const stored = { ...doc, id, toJSON: () => ({ ...doc, id }) };
      docs.set(id, stored);
      return stored;
    }),
    findOne: jest.fn((id: string) => ({
      exec: jest.fn(async () => {
        const doc = docs.get(id);
        if (!doc) return null;
        return {
          ...doc,
          get: (field: string) => doc[field],
          patch: jest.fn(async (patch: Record<string, unknown>) => {
            Object.assign(doc, patch);
            return doc;
          }),
        };
      }),
    })),
    find: jest.fn((query?: { selector?: Record<string, any>; sort?: any }) => ({
      exec: jest.fn(async () => {
        const allDocs = Array.from(docs.values()).filter(
          (d) => !d.is_deleted,
        );
        let results: Record<string, unknown>[] = [...allDocs];

        if (query?.selector) {
          const sel = query.selector;
          if (sel.machine_id?.$eq) {
            results = results.filter(
              (d) => d.machine_id === sel.machine_id.$eq,
            );
          }
          if (sel.status?.$eq) {
            results = results.filter((d) => d.status === sel.status.$eq);
          }
          if (sel.is_deleted?.$eq !== undefined) {
            results = results.filter(
              (d) => d.is_deleted === sel.is_deleted.$eq,
            );
          }
        }

        // Sort by started_at desc if specified
        const sortConfig = Array.isArray(query?.sort)
          ? query.sort[0]
          : query?.sort;
        if (sortConfig?.started_at === 'desc') {
          results.sort(
            (a, b) =>
              (b.started_at as number) - (a.started_at as number),
          );
        }

        return results.map((doc) => ({
          ...doc,
          get: (field: string) => doc[field],
          patch: jest.fn(async (patch: Record<string, unknown>) => {
            Object.assign(doc, patch);
            return doc;
          }),
        }));
      }),
      $: {
        subscribe: jest.fn((cb: (docs: unknown[]) => void) => {
          cb(Array.from(docs.values()).filter((d) => !d.is_deleted));
          return { unsubscribe: jest.fn() };
        }),
      },
    })),
    _docs: docs,
  };
};

let mockDb: {
  collections: {
    shift_sessions: ReturnType<typeof createMockCollection>;
  };
};

// Custom renderHook that works without @testing-library/react-native
function renderHook<T>(hook: () => T): { result: { current: T } } {
  const result = { current: undefined as unknown as T };

  function TestComponent() {
    result.current = hook();
    return null;
  }

  createRenderer(React.createElement(TestComponent, null));
  return { result };
}

describe('useShiftSessionsRepository', () => {
  beforeEach(() => {
    mockUuidCounter = 0;
    const mockCollection = createMockCollection();
    mockDb = {
      collections: {
        shift_sessions: mockCollection,
      },
    };
  });

  // ─── Create ─────────────────────────────────────────────────────────────

  it('creates a shift session with required fields', async () => {
    const { result } = renderHook(() => useShiftSessionsRepository());

    const session = await result.current.create({
      machine_id: 'CAVEMIL-03',
      operator_id: 'user-1',
      shift_type: 'matutino',
      started_at: 1234567890,
      planned_boxes: 5000,
      status: 'active',
    });

    expect(session).toBeTruthy();
    expect((session as unknown as Record<string, unknown>).id).toBe('uuid-1');
    expect((session as unknown as Record<string, unknown>).updated_at).toBe(1234567890);
    expect((session as unknown as Record<string, unknown>).is_deleted).toBe(false);
    expect((session as unknown as Record<string, unknown>).machine_id).toBe('CAVEMIL-03');
    expect((session as unknown as Record<string, unknown>).operator_id).toBe('user-1');
    expect((session as unknown as Record<string, unknown>).shift_type).toBe('matutino');
    expect((session as unknown as Record<string, unknown>).started_at).toBe(1234567890);
    expect((session as unknown as Record<string, unknown>).planned_boxes).toBe(5000);
    expect((session as unknown as Record<string, unknown>).status).toBe('active');
    expect((session as unknown as Record<string, unknown>).device_id).toBe('device-test-1');
  });

  it('creates a session with optional product_code', async () => {
    const { result } = renderHook(() => useShiftSessionsRepository());

    const session = await result.current.create({
      machine_id: 'CAVEMIL-03',
      operator_id: 'user-1',
      shift_type: 'vespertino',
      started_at: 1234567890,
      planned_boxes: 5000,
      status: 'active',
      product_code: 'CHO-123',
    });

    expect((session as unknown as Record<string, unknown>).product_code).toBe('CHO-123');
  });

  // ─── FindById ───────────────────────────────────────────────────────────

  it('finds a session by id', async () => {
    const { result } = renderHook(() => useShiftSessionsRepository());

    const created = await result.current.create({
      machine_id: 'CAVEMIL-03',
      operator_id: 'user-1',
      shift_type: 'matutino',
      started_at: 1234567890,
      planned_boxes: 5000,
      status: 'active',
    });

    const id = (created as unknown as Record<string, unknown>).id as string;
    const found = await result.current.findById(id);

    expect(found).not.toBeNull();
    expect((found as unknown as Record<string, unknown>).id).toBe(id);
  });

  it('returns null for non-existent id', async () => {
    const { result } = renderHook(() => useShiftSessionsRepository());

    const found = await result.current.findById('non-existent');
    expect(found).toBeNull();
  });

  // ─── Update ─────────────────────────────────────────────────────────────

  it('updates a session with patch', async () => {
    const { result } = renderHook(() => useShiftSessionsRepository());

    const created = await result.current.create({
      machine_id: 'CAVEMIL-03',
      operator_id: 'user-1',
      shift_type: 'matutino',
      started_at: 1234567890,
      planned_boxes: 5000,
      status: 'active',
    });

    const id = (created as unknown as Record<string, unknown>).id as string;

    await act(async () => {
      await result.current.update(id, {
        planned_boxes: 6000,
      });
    });

    const updated = await result.current.findById(id);
    expect((updated as unknown as Record<string, unknown>).planned_boxes).toBe(6000);
    expect((updated as unknown as Record<string, unknown>).updated_at).toBe(1234567890);
  });

  it('returns null when updating non-existent session', async () => {
    const { result } = renderHook(() => useShiftSessionsRepository());

    const updated = await result.current.update('non-existent', {
      planned_boxes: 6000,
    });

    expect(updated).toBeNull();
  });

  // ─── Soft-delete (remove) ───────────────────────────────────────────────

  it('soft-deletes a session on remove', async () => {
    const { result } = renderHook(() => useShiftSessionsRepository());

    const created = await result.current.create({
      machine_id: 'CAVEMIL-03',
      operator_id: 'user-1',
      shift_type: 'matutino',
      started_at: 1234567890,
      planned_boxes: 5000,
      status: 'active',
    });

    const id = (created as unknown as Record<string, unknown>).id as string;

    await act(async () => {
      await result.current.remove(id);
    });

    const removed = await result.current.findById(id);
    expect(removed).not.toBeNull();
    expect((removed as unknown as Record<string, unknown>).is_deleted).toBe(true);
  });

  it('does nothing when removing non-existent session', async () => {
    const { result } = renderHook(() => useShiftSessionsRepository());

    await expect(
      result.current.remove('non-existent'),
    ).resolves.not.toThrow();
  });

  // ─── FindActiveByMachine ────────────────────────────────────────────────

  it('finds active session by machine', async () => {
    const { result } = renderHook(() => useShiftSessionsRepository());

    await act(async () => {
      await result.current.create({
        machine_id: 'CAVEMIL-03',
        operator_id: 'user-1',
        shift_type: 'matutino',
        started_at: 1000,
        planned_boxes: 5000,
        status: 'active',
      });
    });

    const active = await result.current.findActiveByMachine('CAVEMIL-03');
    expect(active).not.toBeNull();
    expect((active as unknown as Record<string, unknown>).machine_id).toBe('CAVEMIL-03');
    expect((active as unknown as Record<string, unknown>).status).toBe('active');
  });

  it('returns null when no active session for machine', async () => {
    const { result } = renderHook(() => useShiftSessionsRepository());

    const active = await result.current.findActiveByMachine('OTHER-MACHINE');
    expect(active).toBeNull();
  });

  it('does not return closed sessions from findActiveByMachine', async () => {
    const { result } = renderHook(() => useShiftSessionsRepository());

    await act(async () => {
      await result.current.create({
        machine_id: 'CAVEMIL-03',
        operator_id: 'user-1',
        shift_type: 'matutino',
        started_at: 1000,
        planned_boxes: 5000,
        status: 'closed',
      });
    });

    const active = await result.current.findActiveByMachine('CAVEMIL-03');
    expect(active).toBeNull();
  });

  it('returns the most recent active session by started_at', async () => {
    const { result } = renderHook(() => useShiftSessionsRepository());

    await act(async () => {
      // Insert two active sessions — the mock sorts by started_at desc
      // and returns the first one (most recent)
      await result.current.create({
        machine_id: 'CAVEMIL-03',
        operator_id: 'user-1',
        shift_type: 'matutino',
        started_at: 1000,
        planned_boxes: 5000,
        status: 'active',
      });
      await result.current.create({
        machine_id: 'CAVEMIL-03',
        operator_id: 'user-1',
        shift_type: 'vespertino',
        started_at: 2000,
        planned_boxes: 6000,
        status: 'active',
      });
    });

    const active = await result.current.findActiveByMachine('CAVEMIL-03');
    expect(active).not.toBeNull();
    // Should return the most recent (started_at=2000)
    expect((active as unknown as Record<string, unknown>).started_at).toBe(2000);
    expect((active as unknown as Record<string, unknown>).shift_type).toBe('vespertino');
  });

  // ─── FindByStatus ───────────────────────────────────────────────────────

  it('finds all active sessions', async () => {
    const { result } = renderHook(() => useShiftSessionsRepository());

    await act(async () => {
      await result.current.create({
        machine_id: 'CAVEMIL-03',
        operator_id: 'user-1',
        shift_type: 'matutino',
        started_at: 1000,
        planned_boxes: 5000,
        status: 'active',
      });
      await result.current.create({
        machine_id: 'CAVEMIL-04',
        operator_id: 'user-2',
        shift_type: 'vespertino',
        started_at: 2000,
        planned_boxes: 6000,
        status: 'active',
      });
    });

    const activeSessions = await result.current.findByStatus('active');
    expect(activeSessions).toHaveLength(2);
  });

  it('finds all closed sessions', async () => {
    const { result } = renderHook(() => useShiftSessionsRepository());

    await act(async () => {
      await result.current.create({
        machine_id: 'CAVEMIL-03',
        operator_id: 'user-1',
        shift_type: 'matutino',
        started_at: 1000,
        planned_boxes: 5000,
        status: 'active',
      });
      await result.current.create({
        machine_id: 'CAVEMIL-04',
        operator_id: 'user-2',
        shift_type: 'vespertino',
        started_at: 2000,
        planned_boxes: 6000,
        status: 'closed',
      });
    });

    const closedSessions = await result.current.findByStatus('closed');
    expect(closedSessions).toHaveLength(1);
    expect((closedSessions[0] as unknown as Record<string, unknown>).status).toBe('closed');
  });

  it('soft-deleted sessions do not appear in findByStatus', async () => {
    const { result } = renderHook(() => useShiftSessionsRepository());

    let sessionId: string;
    await act(async () => {
      const created = await result.current.create({
        machine_id: 'CAVEMIL-03',
        operator_id: 'user-1',
        shift_type: 'matutino',
        started_at: 1000,
        planned_boxes: 5000,
        status: 'active',
      });
      sessionId = (created as unknown as Record<string, unknown>).id as string;
    });

    await act(async () => {
      await result.current.remove(sessionId!);
    });

    const activeSessions = await result.current.findByStatus('active');
    expect(activeSessions).toHaveLength(0);
  });
});
