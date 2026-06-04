import React from 'react';
import { create as createRenderer, act } from 'react-test-renderer';
import { useOeeEventsRepository } from '../useOeeEventsRepository';

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

// Create a mock RxDB collection
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
    find: jest.fn((query?: { selector?: Record<string, any> }) => ({
      exec: jest.fn(async () => {
        const allDocs = Array.from(docs.values()).filter(d => !d.is_deleted);
        let results: Record<string, unknown>[] = [];
        if (query?.selector?.shift_id?.$eq) {
          results = allDocs.filter(d => d.shift_id === query.selector!.shift_id.$eq);
        } else if (query?.selector?.machine_id?.$eq) {
          const machineDocs = allDocs.filter(d => d.machine_id === query.selector!.machine_id.$eq);
          if (query?.selector?.event_type?.$eq === 'downtime_start') {
            results = machineDocs
              .filter(d => d.event_type === 'downtime_start')
              .sort((a, b) => (b.timestamp as number) - (a.timestamp as number));
          } else if (query?.selector?.event_type?.$eq === 'downtime_end') {
            results = machineDocs.filter(d => d.event_type === 'downtime_end');
          } else {
            results = machineDocs;
          }
        } else {
          results = allDocs;
        }
        return results.map(doc => ({
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
          cb(Array.from(docs.values()).filter(d => !d.is_deleted));
          return { unsubscribe: jest.fn() };
        }),
      },
    })),
    _docs: docs, // expose for inspection
  };
};

let mockDb: { collections: { oee_events: ReturnType<typeof createMockCollection> } };

jest.mock('../../ui/store/catalogStore', () => ({
  useCatalogStore: jest.fn(),
}));

jest.mock('../../auth/useAuthStore', () => ({
  useAuthStore: jest.fn(),
}));

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

import { useCatalogStore } from '../../ui/store/catalogStore';
import { useAuthStore } from '../../auth/useAuthStore';

describe('useOeeEventsRepository', () => {
  beforeEach(() => {
    mockUuidCounter = 0;
    const mockCollection = createMockCollection();
    mockDb = {
      collections: {
        oee_events: mockCollection,
      },
    };
    (useCatalogStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = {
        selectedLine: 'store-line',
        selectedMachine: 'store-machine',
        selectedShift: 'store-shift',
      };
      return selector ? selector(state) : state;
    });
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = {
        user: { id: 'store-user' },
      };
      return selector ? selector(state) : state;
    });
  });

  it('creates event with fields from stores', async () => {
    const { result } = renderHook(() => useOeeEventsRepository());

    const event = await result.current.createEvent({
      event_type: 'box_count',
      timestamp: 1234567890,
      quantity: 50,
    } as any);

    expect(event.id).toBe('uuid-1');
    expect(event.updated_at).toBe(1234567890);
    expect(event.is_deleted).toBe(false);
    expect(event.event_type).toBe('box_count');
    expect(event.quantity).toBe(50);
    expect(event.line_id).toBe('store-line');
    expect(event.machine_id).toBe('store-machine');
    expect(event.shift_id).toBe('store-shift');
    expect((event as any).operator_id).toBe('store-user');
  });

  it('soft-deletes event on remove', async () => {
    const { result } = renderHook(() => useOeeEventsRepository());

    const event = await result.current.createEvent({
      line_id: 'LINEA-1',
      machine_id: 'CAVEMIL-03',
      shift_id: 'shift-1',
      event_type: 'box_count',
      timestamp: 1234567890,
      quantity: 50,
    });

    await act(async () => {
      await result.current.remove(event.id);
    });

    const found = await result.current.findById(event.id);
    // After soft delete, findById should still find it but with deleted=true
    // The mock's findOne doesn't filter by deleted, so it should return the doc
    expect(found).not.toBeNull();
    expect((found as unknown as Record<string, unknown>).is_deleted).toBe(true);
  });

  it('finds events by shift', async () => {
    const { result } = renderHook(() => useOeeEventsRepository());

    await act(async () => {
      await result.current.createEvent({
        line_id: 'LINEA-1', machine_id: 'CAVEMIL-03',
        shift_id: 'shift-1', event_type: 'box_count', timestamp: 1, quantity: 10,
      });
      await result.current.createEvent({
        line_id: 'LINEA-1', machine_id: 'CAVEMIL-03',
        shift_id: 'shift-2', event_type: 'box_count', timestamp: 2, quantity: 20,
      });
    });

    const shift1Events = await result.current.findByShift('shift-1');
    expect(shift1Events).toHaveLength(1);
    expect((shift1Events[0] as unknown as Record<string, unknown>).shift_id).toBe('shift-1');
  });

  it('finds active downtime', async () => {
    const { result } = renderHook(() => useOeeEventsRepository());

    // Create a downtime_start without downtime_end
    await act(async () => {
      await result.current.createEvent({
        line_id: 'LINEA-1', machine_id: 'CAVEMIL-03',
        shift_id: 'shift-1', event_type: 'downtime_start', timestamp: 1, reason_code: 'FMP',
      });
    });

    const active = await result.current.findActiveDowntime('CAVEMIL-03');
    expect(active).not.toBeNull();
    expect((active as unknown as Record<string, unknown>).event_type).toBe('downtime_start');
  });

  it('does not find closed downtime as active', async () => {
    const { result } = renderHook(() => useOeeEventsRepository());

    let startEvent: Record<string, any>;
    await act(async () => {
      startEvent = await result.current.createEvent({
        line_id: 'LINEA-1', machine_id: 'CAVEMIL-03',
        shift_id: 'shift-1', event_type: 'downtime_start', timestamp: 1, reason_code: 'FMP',
      });
    });

    // Create a downtime_end that closes the start event
    await act(async () => {
      await result.current.createEvent({
        line_id: 'LINEA-1', machine_id: 'CAVEMIL-03',
        shift_id: 'shift-1', event_type: 'downtime_end', timestamp: 2,
        related_event_id: startEvent!.id,
      });
    });

    const active = await result.current.findActiveDowntime('CAVEMIL-03');
    expect(active).toBeNull();
  });
});
