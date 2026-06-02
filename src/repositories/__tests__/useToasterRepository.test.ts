/**
 * T6.4 — useToasterRepository behavioral tests.
 *
 * Spec compliance:
 * - CRUD operations (create, update, remove, findById, findByShift, findByBatch, findAll)
 * - Documents observable docs$
 * - Soft delete pattern
 *
 * Mock pattern mirrors useSignaturesRepository.test.ts.
 */

import React from 'react';
import { create as createRenderer, act } from 'react-test-renderer';
import { useToasterRepository } from '../useToasterRepository';

// Mock the database context
jest.mock('../../data/DatabaseContext', () => ({
  useDatabase: () => mockDb,
}));

let mockUuidCounter = 0;

jest.mock('../../utils/uuid', () => ({
  generateUuid: () => `uuid-${++mockUuidCounter}`,
}));

jest.mock('../../utils/timestamp', () => ({
  nowMs: () => 1234567890,
}));

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
        const stored = docs.get(id);
        if (!stored) return null;
        const execResult: Record<string, unknown> = {};
        // Define getters on execResult that delegate to the stored doc
        Object.keys(stored).forEach((key) => {
          Object.defineProperty(execResult, key, {
            get: () => stored[key],
            enumerable: true,
            configurable: true,
          });
        });
        execResult.get = (field: string) => stored[field];
        execResult.patch = jest.fn(async (patch: Record<string, unknown>) => {
          Object.assign(stored, patch);
          return execResult;
        });
        return execResult;
      }),
    })),
    find: jest.fn((query?: { selector?: Record<string, any> }) => ({
      exec: jest.fn(async () => {
        const allDocs = Array.from(docs.values()).filter((d) => !d.is_deleted);
        let results: Record<string, unknown>[] = [];
        const sel = query?.selector ?? {};
        if (sel.shift_id?.$eq && sel.batch_number?.$eq) {
          results = allDocs.filter(
            (d) => d.shift_id === sel.shift_id.$eq && d.batch_number === sel.batch_number.$eq
          );
        } else if (sel.shift_id?.$eq) {
          results = allDocs.filter((d) => d.shift_id === sel.shift_id.$eq);
        } else if (sel.batch_number?.$eq) {
          results = allDocs.filter((d) => d.batch_number === sel.batch_number.$eq);
        } else if (sel.is_deleted?.$eq !== undefined) {
          results = allDocs.filter((d) => d.is_deleted === sel.is_deleted.$eq);
        } else {
          results = allDocs;
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

let mockDb: { collections: { toaster_logs: ReturnType<typeof createMockCollection> } };

// Custom renderHook without @testing-library/react-native
function renderHook<T>(hook: () => T): { result: { current: T } } {
  const result = { current: undefined as unknown as T };

  function TestComponent() {
    result.current = hook();
    return null;
  }

  createRenderer(React.createElement(TestComponent, null));
  return { result };
}

const SAMPLE_PAYLOAD = {
  line_id: 'line-1',
  machine_id: 'machine-toaster',
  shift_id: 'shift-1',
  operator_id: 'user-1',
  batch_number: 'B001',
  temp_superior: 180,
  temp_media: 175,
  temp_inferior: 170,
  rpm: 1200,
  vapor_pressure: 5.5,
  cacao_crudo_humidity: 7.2,
  cacao_tostado_humidity: 3.1,
  pesadas: 10,
  silo: 'A',
  lotes: 'L123',
  tiempo_muerto_min: 15,
  tiempo_muerto_cause: 'Mantenimiento programado',
  inv_ini_cascarilla: 100,
  inv_ini_polvillo: 50,
  inv_ini_granilla: 75,
  inv_ini_cacao_crudo: 500,
  inv_ini_azucar: 200,
  inv_fin_cascarilla: 80,
  inv_fin_polvillo: 35,
  inv_fin_granilla: 60,
  inv_fin_cacao_crudo: 420,
  inv_fin_azucar: 170,
};

describe('useToasterRepository', () => {
  beforeEach(() => {
    mockUuidCounter = 0;
    const mockCollection = createMockCollection();
    mockDb = {
      collections: {
        toaster_logs: mockCollection,
      },
    };
  });

  // ─── CREATE ─────────────────────────────────────────────────────────────────

  it('creates a toaster log with auto-generated fields', async () => {
    const { result } = renderHook(() => useToasterRepository());

    const doc = await result.current.create(SAMPLE_PAYLOAD);

    expect(doc.id).toBe('uuid-1');
    expect(doc.updated_at).toBe(1234567890);
    expect(doc.is_deleted).toBe(false);
    expect(doc.line_id).toBe('line-1');
    expect(doc.shift_id).toBe('shift-1');
    expect(doc.batch_number).toBe('B001');
    expect(doc.temp_superior).toBe(180);
    expect(doc.temp_media).toBe(175);
    expect(doc.temp_inferior).toBe(170);
    expect(doc.rpm).toBe(1200);
    expect(doc.vapor_pressure).toBe(5.5);
    expect(doc.cacao_crudo_humidity).toBe(7.2);
    expect(doc.cacao_tostado_humidity).toBe(3.1);
    expect(doc.pesadas).toBe(10);
    expect(doc.silo).toBe('A');
    expect(doc.lotes).toBe('L123');
    expect(doc.tiempo_muerto_min).toBe(15);
    expect(doc.tiempo_muerto_cause).toBe('Mantenimiento programado');
    expect(doc.inv_ini_cascarilla).toBe(100);
    expect(doc.inv_ini_polvillo).toBe(50);
    expect(doc.inv_fin_azucar).toBe(170);
  });

  // ─── FIND BY ID ─────────────────────────────────────────────────────────────

  it('finds a document by id', async () => {
    const { result } = renderHook(() => useToasterRepository());

    const created = await result.current.create(SAMPLE_PAYLOAD);
    const found = await result.current.findById(created.id);

    expect(found).not.toBeNull();
    expect((found as unknown as Record<string, unknown>).id).toBe(created.id);
  });

  it('returns null when findById finds nothing', async () => {
    const { result } = renderHook(() => useToasterRepository());
    const found = await result.current.findById('nonexistent');
    expect(found).toBeNull();
  });

  // ─── FIND BY SHIFT ──────────────────────────────────────────────────────────

  it('finds documents by shift_id', async () => {
    const { result } = renderHook(() => useToasterRepository());

    await act(async () => {
      await result.current.create({ ...SAMPLE_PAYLOAD, shift_id: 'shift-a', batch_number: 'B001' });
      await result.current.create({ ...SAMPLE_PAYLOAD, shift_id: 'shift-b', batch_number: 'B002' });
      await result.current.create({ ...SAMPLE_PAYLOAD, shift_id: 'shift-a', batch_number: 'B003' });
    });

    const shiftADocs = await result.current.findByShift('shift-a');
    expect(shiftADocs).toHaveLength(2);
    shiftADocs.forEach((doc) => {
      expect((doc as unknown as Record<string, unknown>).shift_id).toBe('shift-a');
    });
  });

  it('returns empty array for shift with no documents', async () => {
    const { result } = renderHook(() => useToasterRepository());
    const docs = await result.current.findByShift('nonexistent');
    expect(docs).toEqual([]);
  });

  // ─── FIND BY BATCH ──────────────────────────────────────────────────────────

  it('finds a document by shift_id and batch_number', async () => {
    const { result } = renderHook(() => useToasterRepository());

    await act(async () => {
      await result.current.create({ ...SAMPLE_PAYLOAD, shift_id: 'shift-x', batch_number: 'B100' });
      await result.current.create({ ...SAMPLE_PAYLOAD, shift_id: 'shift-y', batch_number: 'B200' });
    });

    const found = await result.current.findByBatch('shift-x', 'B100');
    expect(found).not.toBeNull();
    expect((found as unknown as Record<string, unknown>).batch_number).toBe('B100');
    expect((found as unknown as Record<string, unknown>).shift_id).toBe('shift-x');
  });

  it('findByBatch returns null when no match', async () => {
    const { result } = renderHook(() => useToasterRepository());
    const found = await result.current.findByBatch('shift-z', 'B999');
    expect(found).toBeNull();
  });

  // ─── FIND ALL ───────────────────────────────────────────────────────────────

  it('findAll returns all non-deleted documents', async () => {
    const { result } = renderHook(() => useToasterRepository());

    await act(async () => {
      await result.current.create({ ...SAMPLE_PAYLOAD, batch_number: 'B001' });
      await result.current.create({ ...SAMPLE_PAYLOAD, batch_number: 'B002' });
    });

    const all = await result.current.findAll();
    expect(all).toHaveLength(2);
  });

  it('findAll excludes soft-deleted documents', async () => {
    const { result } = renderHook(() => useToasterRepository());

    const doc = await result.current.create({ ...SAMPLE_PAYLOAD, batch_number: 'B001' });
    await act(async () => {
      await result.current.remove(doc.id);
    });

    const all = await result.current.findAll();
    expect(all).toHaveLength(0);
  });

  // ─── UPDATE ─────────────────────────────────────────────────────────────────

  it('updates an existing document', async () => {
    const { result } = renderHook(() => useToasterRepository());

    const doc = await result.current.create(SAMPLE_PAYLOAD);
    const updated = await result.current.update(doc.id, {
      temp_superior: 190,
      rpm: 1300,
    });

    expect(updated).not.toBeNull();
    expect((updated as unknown as Record<string, unknown>).temp_superior).toBe(190);
    expect((updated as unknown as Record<string, unknown>).rpm).toBe(1300);
    expect((updated as unknown as Record<string, unknown>).updated_at).toBe(1234567890);
  });

  it('returns null when updating non-existent document', async () => {
    const { result } = renderHook(() => useToasterRepository());
    const updated = await result.current.update('nonexistent', { temp_superior: 190 });
    expect(updated).toBeNull();
  });

  // ─── SOFT DELETE ────────────────────────────────────────────────────────────

  it('soft-deletes a document (sets is_deleted=true)', async () => {
    const { result } = renderHook(() => useToasterRepository());

    const doc = await result.current.create(SAMPLE_PAYLOAD);
    await act(async () => {
      await result.current.remove(doc.id);
    });

    const found = await result.current.findById(doc.id);
    expect(found).not.toBeNull();
    expect((found as unknown as Record<string, unknown>).is_deleted).toBe(true);
  });

  it('remove is a no-op for non-existent document', async () => {
    const { result } = renderHook(() => useToasterRepository());
    await expect(result.current.remove('nonexistent')).resolves.not.toThrow();
  });

  // ─── OBSERVABLE ─────────────────────────────────────────────────────────────

  it('docs$ is defined and subscribable', () => {
    const { result } = renderHook(() => useToasterRepository());
    expect(result.current.docs$).toBeDefined();
    expect(typeof (result.current.docs$ as any).subscribe).toBe('function');
  });

  it('docs$ emits non-deleted documents on subscribe', () => {
    const { result } = renderHook(() => useToasterRepository());
    const spy = jest.fn();
    const sub = (result.current.docs$ as any).subscribe(spy);

    expect(spy).toHaveBeenCalledTimes(1);
    sub.unsubscribe();
  });
});
