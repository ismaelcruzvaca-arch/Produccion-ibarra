/**
 * T7.4 — useMixingRepository behavioral tests.
 *
 * Spec compliance:
 * - CRUD operations (create, update, remove, findById, findByShift, findByBatch, findAll)
 * - Documents observable docs$
 * - Soft delete pattern
 *
 * Mock pattern mirrors useToasterRepository.test.ts.
 */

import React from 'react';
import { create as createRenderer, act } from 'react-test-renderer';
import { useMixingRepository } from '../useMixingRepository';

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
        if (sel.shift_id?.$eq && sel.batch_sequence?.$eq) {
          results = allDocs.filter(
            (d) => d.shift_id === sel.shift_id.$eq && d.batch_sequence === sel.batch_sequence.$eq
          );
        } else if (sel.shift_id?.$eq) {
          results = allDocs.filter((d) => d.shift_id === sel.shift_id.$eq);
        } else if (sel.batch_sequence?.$eq) {
          results = allDocs.filter((d) => d.batch_sequence === sel.batch_sequence.$eq);
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

let mockDb: { collections: { mixing_batches: ReturnType<typeof createMockCollection> } };

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
  machine_id: 'machine-mixer',
  shift_id: 'shift-1',
  operator_id: 'user-1',
  batch_sequence: 1,
  mezcladora: 'Mezcladora A',
  agitador: 'Agitador 1',
  azucar_kg: 500,
  licor_kg: 200,
  cocoa_kg: 150,
  grasa_vegetal_kg: 100,
  lecitina_kg: 25,
  reproceso_kg: 50,
  viscosity_cps: 4500,
  discharge_temp: 38,
  mezcladas: 1025,
  molidas: 871.25,
  reproceso_total: 50,
  desperdicio: 20.5,
  inv_ini_azucar: 2000,
  inv_ini_licor: 1000,
  inv_ini_cocoa: 800,
  inv_ini_grasa_vegetal: 500,
  inv_ini_lecitina: 200,
  inv_ini_reproceso: 100,
  inv_fin_azucar: 1500,
  inv_fin_licor: 800,
  inv_fin_cocoa: 650,
  inv_fin_grasa_vegetal: 400,
  inv_fin_lecitina: 175,
  inv_fin_reproceso: 50,
  consumo_azucar: 500,
  consumo_licor: 200,
  consumo_cocoa: 150,
  consumo_grasa_vegetal: 100,
  consumo_lecitina: 25,
  consumo_reproceso: 50,
};

describe('useMixingRepository', () => {
  beforeEach(() => {
    mockUuidCounter = 0;
    const mockCollection = createMockCollection();
    mockDb = {
      collections: {
        mixing_batches: mockCollection,
      },
    };
  });

  // ─── CREATE ─────────────────────────────────────────────────────────────────

  it('creates a mixing batch with auto-generated fields', async () => {
    const { result } = renderHook(() => useMixingRepository());

    const doc = await result.current.create(SAMPLE_PAYLOAD);

    expect(doc.id).toBe('uuid-1');
    expect(doc.updated_at).toBe(1234567890);
    expect(doc.is_deleted).toBe(false);
    expect(doc.line_id).toBe('line-1');
    expect(doc.shift_id).toBe('shift-1');
    expect(doc.batch_sequence).toBe(1);
    expect(doc.mezcladora).toBe('Mezcladora A');
    expect(doc.agitador).toBe('Agitador 1');
    expect(doc.azucar_kg).toBe(500);
    expect(doc.licor_kg).toBe(200);
    expect(doc.cocoa_kg).toBe(150);
    expect(doc.grasa_vegetal_kg).toBe(100);
    expect(doc.lecitina_kg).toBe(25);
    expect(doc.reproceso_kg).toBe(50);
    expect(doc.viscosity_cps).toBe(4500);
    expect(doc.discharge_temp).toBe(38);
    expect(doc.mezcladas).toBe(1025);
    expect(doc.molidas).toBe(871.25);
    expect(doc.inv_ini_azucar).toBe(2000);
    expect(doc.inv_fin_azucar).toBe(1500);
    expect(doc.consumo_azucar).toBe(500);
  });

  // ─── FIND BY ID ─────────────────────────────────────────────────────────────

  it('finds a document by id', async () => {
    const { result } = renderHook(() => useMixingRepository());

    const created = await result.current.create(SAMPLE_PAYLOAD);
    const found = await result.current.findById(created.id);

    expect(found).not.toBeNull();
    expect((found as unknown as Record<string, unknown>).id).toBe(created.id);
  });

  it('returns null when findById finds nothing', async () => {
    const { result } = renderHook(() => useMixingRepository());
    const found = await result.current.findById('nonexistent');
    expect(found).toBeNull();
  });

  // ─── FIND BY SHIFT ──────────────────────────────────────────────────────────

  it('finds documents by shift_id', async () => {
    const { result } = renderHook(() => useMixingRepository());

    await act(async () => {
      await result.current.create({ ...SAMPLE_PAYLOAD, shift_id: 'shift-a', batch_sequence: 1 });
      await result.current.create({ ...SAMPLE_PAYLOAD, shift_id: 'shift-b', batch_sequence: 2 });
      await result.current.create({ ...SAMPLE_PAYLOAD, shift_id: 'shift-a', batch_sequence: 3 });
    });

    const shiftADocs = await result.current.findByShift('shift-a');
    expect(shiftADocs).toHaveLength(2);
    shiftADocs.forEach((doc) => {
      expect((doc as unknown as Record<string, unknown>).shift_id).toBe('shift-a');
    });
  });

  it('returns empty array for shift with no documents', async () => {
    const { result } = renderHook(() => useMixingRepository());
    const docs = await result.current.findByShift('nonexistent');
    expect(docs).toEqual([]);
  });

  // ─── FIND BY BATCH ──────────────────────────────────────────────────────────

  it('finds a document by shift_id and batch_sequence', async () => {
    const { result } = renderHook(() => useMixingRepository());

    await act(async () => {
      await result.current.create({ ...SAMPLE_PAYLOAD, shift_id: 'shift-x', batch_sequence: 1 });
      await result.current.create({ ...SAMPLE_PAYLOAD, shift_id: 'shift-y', batch_sequence: 2 });
    });

    const found = await result.current.findByBatch('shift-x', 1);
    expect(found).not.toBeNull();
    expect((found as unknown as Record<string, unknown>).batch_sequence).toBe(1);
    expect((found as unknown as Record<string, unknown>).shift_id).toBe('shift-x');
  });

  it('findByBatch returns null when no match', async () => {
    const { result } = renderHook(() => useMixingRepository());
    const found = await result.current.findByBatch('shift-z', 999);
    expect(found).toBeNull();
  });

  // ─── FIND ALL ───────────────────────────────────────────────────────────────

  it('findAll returns all non-deleted documents', async () => {
    const { result } = renderHook(() => useMixingRepository());

    await act(async () => {
      await result.current.create({ ...SAMPLE_PAYLOAD, batch_sequence: 1 });
      await result.current.create({ ...SAMPLE_PAYLOAD, batch_sequence: 2 });
    });

    const all = await result.current.findAll();
    expect(all).toHaveLength(2);
  });

  it('findAll excludes soft-deleted documents', async () => {
    const { result } = renderHook(() => useMixingRepository());

    const doc = await result.current.create({ ...SAMPLE_PAYLOAD, batch_sequence: 1 });
    await act(async () => {
      await result.current.remove(doc.id);
    });

    const all = await result.current.findAll();
    expect(all).toHaveLength(0);
  });

  // ─── UPDATE ─────────────────────────────────────────────────────────────────

  it('updates an existing document', async () => {
    const { result } = renderHook(() => useMixingRepository());

    const doc = await result.current.create(SAMPLE_PAYLOAD);
    const updated = await result.current.update(doc.id, {
      viscosity_cps: 5000,
      discharge_temp: 40,
    });

    expect(updated).not.toBeNull();
    expect((updated as unknown as Record<string, unknown>).viscosity_cps).toBe(5000);
    expect((updated as unknown as Record<string, unknown>).discharge_temp).toBe(40);
    expect((updated as unknown as Record<string, unknown>).updated_at).toBe(1234567890);
  });

  it('returns null when updating non-existent document', async () => {
    const { result } = renderHook(() => useMixingRepository());
    const updated = await result.current.update('nonexistent', { viscosity_cps: 5000 });
    expect(updated).toBeNull();
  });

  // ─── SOFT DELETE ────────────────────────────────────────────────────────────

  it('soft-deletes a document (sets is_deleted=true)', async () => {
    const { result } = renderHook(() => useMixingRepository());

    const doc = await result.current.create(SAMPLE_PAYLOAD);
    await act(async () => {
      await result.current.remove(doc.id);
    });

    const found = await result.current.findById(doc.id);
    expect(found).not.toBeNull();
    expect((found as unknown as Record<string, unknown>).is_deleted).toBe(true);
  });

  it('remove is a no-op for non-existent document', async () => {
    const { result } = renderHook(() => useMixingRepository());
    await expect(result.current.remove('nonexistent')).resolves.not.toThrow();
  });

  // ─── OBSERVABLE ─────────────────────────────────────────────────────────────

  it('docs$ is defined and subscribable', () => {
    const { result } = renderHook(() => useMixingRepository());
    expect(result.current.docs$).toBeDefined();
    expect(typeof (result.current.docs$ as any).subscribe).toBe('function');
  });

  it('docs$ emits non-deleted documents on subscribe', () => {
    const { result } = renderHook(() => useMixingRepository());
    const spy = jest.fn();
    const sub = (result.current.docs$ as any).subscribe(spy);

    expect(spy).toHaveBeenCalledTimes(1);
    sub.unsubscribe();
  });
});
