/**
 * T8.4 — useVitaminRepository behavioral tests.
 *
 * Spec compliance:
 * - CRUD operations (create, update, remove, findById, findByShift, findAll)
 * - Documents observable docs$
 * - Soft delete pattern
 *
 * Mock pattern mirrors useExtractorRepository.test.ts.
 */

import React from 'react';
import { create as createRenderer, act } from 'react-test-renderer';
import { useVitaminRepository } from '../useVitaminRepository';

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
        if (sel.shift_id?.$eq) {
          results = allDocs.filter((d) => d.shift_id === sel.shift_id.$eq);
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

let mockDb: { collections: { vitamin_kits: ReturnType<typeof createMockCollection> } };

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
  machine_id: 'machine-vitamin',
  shift_id: 'shift-1',
  operator_id: 'user-1',
  orden: 'ORD-001',
  kit: 'KIT-001',
  semi_terminado: 'ST-001',
  ingredients: [
    { name: 'Vitamina A', lote: 'LOTE-A1', quantity_kg: 50 },
    { name: 'Vitamina B', lote: 'LOTE-B1', quantity_kg: 30 },
  ],
  verif_produccion: true,
  verif_calidad: false,
  peso_bascula_kg: 500,
  peso_fisico_kg: 498.5,
};

describe('useVitaminRepository', () => {
  beforeEach(() => {
    mockUuidCounter = 0;
    const mockCollection = createMockCollection();
    mockDb = {
      collections: {
        vitamin_kits: mockCollection,
      },
    };
  });

  // ─── CREATE ─────────────────────────────────────────────────────────────────

  it('creates a vitamin kit with auto-generated fields', async () => {
    const { result } = renderHook(() => useVitaminRepository());

    const doc = await result.current.create(SAMPLE_PAYLOAD);

    expect(doc.id).toBe('uuid-1');
    expect(doc.updated_at).toBe(1234567890);
    expect(doc.is_deleted).toBe(false);
    expect(doc.line_id).toBe('line-1');
    expect(doc.shift_id).toBe('shift-1');
    expect(doc.orden).toBe('ORD-001');
    expect(doc.kit).toBe('KIT-001');
    expect(doc.semi_terminado).toBe('ST-001');
    expect(doc.verif_produccion).toBe(true);
    expect(doc.verif_calidad).toBe(false);
    expect(doc.peso_bascula_kg).toBe(500);
    expect(doc.peso_fisico_kg).toBe(498.5);
    expect(Array.isArray(doc.ingredients)).toBe(true);
    expect((doc.ingredients as Array<{ name: string }>)[0].name).toBe('Vitamina A');
  });

  // ─── FIND BY ID ─────────────────────────────────────────────────────────────

  it('finds a document by id', async () => {
    const { result } = renderHook(() => useVitaminRepository());

    const created = await result.current.create(SAMPLE_PAYLOAD);
    const found = await result.current.findById(created.id);

    expect(found).not.toBeNull();
    expect((found as unknown as Record<string, unknown>).id).toBe(created.id);
  });

  it('returns null when findById finds nothing', async () => {
    const { result } = renderHook(() => useVitaminRepository());
    const found = await result.current.findById('nonexistent');
    expect(found).toBeNull();
  });

  // ─── FIND BY SHIFT ──────────────────────────────────────────────────────────

  it('finds documents by shift_id', async () => {
    const { result } = renderHook(() => useVitaminRepository());

    await act(async () => {
      await result.current.create({ ...SAMPLE_PAYLOAD, shift_id: 'shift-a', kit: 'KIT-A1' });
      await result.current.create({ ...SAMPLE_PAYLOAD, shift_id: 'shift-b', kit: 'KIT-B1' });
      await result.current.create({ ...SAMPLE_PAYLOAD, shift_id: 'shift-a', kit: 'KIT-A2' });
    });

    const shiftADocs = await result.current.findByShift('shift-a');
    expect(shiftADocs).toHaveLength(2);
    shiftADocs.forEach((doc) => {
      expect((doc as unknown as Record<string, unknown>).shift_id).toBe('shift-a');
    });
  });

  it('returns empty array for shift with no documents', async () => {
    const { result } = renderHook(() => useVitaminRepository());
    const docs = await result.current.findByShift('nonexistent');
    expect(docs).toEqual([]);
  });

  // ─── FIND ALL ───────────────────────────────────────────────────────────────

  it('findAll returns all non-deleted documents', async () => {
    const { result } = renderHook(() => useVitaminRepository());

    await act(async () => {
      await result.current.create({ ...SAMPLE_PAYLOAD, kit: 'KIT-001' });
      await result.current.create({ ...SAMPLE_PAYLOAD, kit: 'KIT-002' });
    });

    const all = await result.current.findAll();
    expect(all).toHaveLength(2);
  });

  it('findAll excludes soft-deleted documents', async () => {
    const { result } = renderHook(() => useVitaminRepository());

    const doc = await result.current.create({ ...SAMPLE_PAYLOAD, kit: 'KIT-001' });
    await act(async () => {
      await result.current.remove(doc.id);
    });

    const all = await result.current.findAll();
    expect(all).toHaveLength(0);
  });

  // ─── UPDATE ─────────────────────────────────────────────────────────────────

  it('updates an existing document', async () => {
    const { result } = renderHook(() => useVitaminRepository());

    const doc = await result.current.create(SAMPLE_PAYLOAD);
    const updated = await result.current.update(doc.id, {
      verif_calidad: true,
      peso_fisico_kg: 499,
    });

    expect(updated).not.toBeNull();
    expect((updated as unknown as Record<string, unknown>).verif_calidad).toBe(true);
    expect((updated as unknown as Record<string, unknown>).peso_fisico_kg).toBe(499);
    expect((updated as unknown as Record<string, unknown>).updated_at).toBe(1234567890);
  });

  it('returns null when updating non-existent document', async () => {
    const { result } = renderHook(() => useVitaminRepository());
    const updated = await result.current.update('nonexistent', { verif_calidad: true });
    expect(updated).toBeNull();
  });

  // ─── SOFT DELETE ────────────────────────────────────────────────────────────

  it('soft-deletes a document (sets is_deleted=true)', async () => {
    const { result } = renderHook(() => useVitaminRepository());

    const doc = await result.current.create(SAMPLE_PAYLOAD);
    await act(async () => {
      await result.current.remove(doc.id);
    });

    const found = await result.current.findById(doc.id);
    expect(found).not.toBeNull();
    expect((found as unknown as Record<string, unknown>).is_deleted).toBe(true);
  });

  it('remove is a no-op for non-existent document', async () => {
    const { result } = renderHook(() => useVitaminRepository());
    await expect(result.current.remove('nonexistent')).resolves.not.toThrow();
  });

  // ─── OBSERVABLE ─────────────────────────────────────────────────────────────

  it('docs$ is defined and subscribable', () => {
    const { result } = renderHook(() => useVitaminRepository());
    expect(result.current.docs$).toBeDefined();
    expect(typeof (result.current.docs$ as any).subscribe).toBe('function');
  });

  it('docs$ emits non-deleted documents on subscribe', () => {
    const { result } = renderHook(() => useVitaminRepository());
    const spy = jest.fn();
    const sub = (result.current.docs$ as any).subscribe(spy);

    expect(spy).toHaveBeenCalledTimes(1);
    sub.unsubscribe();
  });
});
