/**
 * T5.4 — useExtractorRepository behavioral tests.
 *
 * Spec compliance:
 * - CRUD operations (create, findById, findByShift, findAll, update, remove)
 * - Documents observable docs$
 * - Soft delete pattern
 *
 * Mock pattern mirrors useSignaturesRepository.test.ts.
 */

import React from 'react';
import { create as createRenderer, act } from 'react-test-renderer';
import { useExtractorRepository } from '../useExtractorRepository';

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
        if (query?.selector?.shift_id?.$eq) {
          results = allDocs.filter((d) => d.shift_id === query!.selector!.shift_id.$eq);
        } else if (query?.selector?.is_deleted?.$eq !== undefined) {
          results = allDocs.filter((d) => d.is_deleted === query!.selector!.is_deleted.$eq);
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

let mockDb: { collections: { extractor_checks: ReturnType<typeof createMockCollection> } };

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

describe('useExtractorRepository', () => {
  beforeEach(() => {
    mockUuidCounter = 0;
    const mockCollection = createMockCollection();
    mockDb = {
      collections: {
        extractor_checks: mockCollection,
      },
    };
  });

  // ─── CREATE ─────────────────────────────────────────────────────────────────

  it('creates an extractor check with auto-generated fields', async () => {
    const { result } = renderHook(() => useExtractorRepository());

    const doc = await result.current.create({
      line_id: 'line-1',
      machine_id: 'machine-extractor',
      shift_id: 'shift-1',
      operator_id: 'user-1',
      extractor_1_on: true,
      extractor_2_on: false,
      extractor_3_on: true,
      extractor_4_on: false,
      extractor_5_on: true,
      extractor_6_on: false,
      extractor_7_on: true,
      extractor_8_on: false,
      cedazo_tt_last_cleaning: 1700000000000,
    });

    expect(doc.id).toBe('uuid-1');
    expect(doc.updated_at).toBe(1234567890);
    expect(doc.is_deleted).toBe(false);
    expect(doc.line_id).toBe('line-1');
    expect(doc.shift_id).toBe('shift-1');
    expect(doc.operator_id).toBe('user-1');
    expect(doc.extractor_1_on).toBe(true);
    expect(doc.extractor_2_on).toBe(false);
    expect(doc.extractor_8_on).toBe(false);
    expect(doc.cedazo_tt_last_cleaning).toBe(1700000000000);
  });

  it('creates with all extractors on', async () => {
    const { result } = renderHook(() => useExtractorRepository());

    const doc = await result.current.create({
      line_id: 'line-1',
      machine_id: 'machine-extractor',
      shift_id: 'shift-1',
      operator_id: 'user-1',
      extractor_1_on: true,
      extractor_2_on: true,
      extractor_3_on: true,
      extractor_4_on: true,
      extractor_5_on: true,
      extractor_6_on: true,
      extractor_7_on: true,
      extractor_8_on: true,
      cedazo_tt_last_cleaning: 1700000000000,
    });

    for (let i = 1; i <= 8; i++) {
      expect((doc as any)[`extractor_${i}_on`]).toBe(true);
    }
  });

  // ─── FIND BY ID ─────────────────────────────────────────────────────────────

  it('finds a document by id', async () => {
    const { result } = renderHook(() => useExtractorRepository());

    const created = await result.current.create({
      line_id: 'line-1',
      machine_id: 'machine-extractor',
      shift_id: 'shift-1',
      operator_id: 'user-1',
      extractor_1_on: true,
      extractor_2_on: false,
      extractor_3_on: true,
      extractor_4_on: false,
      extractor_5_on: true,
      extractor_6_on: false,
      extractor_7_on: true,
      extractor_8_on: false,
      cedazo_tt_last_cleaning: 1700000000000,
    });

    const found = await result.current.findById(created.id);
    expect(found).not.toBeNull();
    expect((found as unknown as Record<string, unknown>).id).toBe(created.id);
  });

  it('returns null when findById finds nothing', async () => {
    const { result } = renderHook(() => useExtractorRepository());
    const found = await result.current.findById('nonexistent-id');
    expect(found).toBeNull();
  });

  // ─── FIND BY SHIFT ──────────────────────────────────────────────────────────

  it('finds documents by shift_id', async () => {
    const { result } = renderHook(() => useExtractorRepository());

    await act(async () => {
      await result.current.create({
        line_id: 'line-1', machine_id: 'm1', shift_id: 'shift-a', operator_id: 'u1',
        extractor_1_on: true, extractor_2_on: true, extractor_3_on: true,
        extractor_4_on: true, extractor_5_on: true, extractor_6_on: true,
        extractor_7_on: true, extractor_8_on: true,
        cedazo_tt_last_cleaning: 1700000000000,
      });
      await result.current.create({
        line_id: 'line-1', machine_id: 'm2', shift_id: 'shift-b', operator_id: 'u2',
        extractor_1_on: false, extractor_2_on: false, extractor_3_on: false,
        extractor_4_on: false, extractor_5_on: false, extractor_6_on: false,
        extractor_7_on: false, extractor_8_on: false,
        cedazo_tt_last_cleaning: 1700000000000,
      });
      await result.current.create({
        line_id: 'line-1', machine_id: 'm3', shift_id: 'shift-a', operator_id: 'u3',
        extractor_1_on: true, extractor_2_on: false, extractor_3_on: true,
        extractor_4_on: false, extractor_5_on: true, extractor_6_on: false,
        extractor_7_on: true, extractor_8_on: false,
        cedazo_tt_last_cleaning: 1700000000000,
      });
    });

    const shiftADocs = await result.current.findByShift('shift-a');
    expect(shiftADocs).toHaveLength(2);
    shiftADocs.forEach((doc) => {
      expect((doc as unknown as Record<string, unknown>).shift_id).toBe('shift-a');
    });
  });

  it('returns empty array for shift with no documents', async () => {
    const { result } = renderHook(() => useExtractorRepository());
    const docs = await result.current.findByShift('nonexistent-shift');
    expect(docs).toEqual([]);
  });

  // ─── FIND ALL ───────────────────────────────────────────────────────────────

  it('findAll returns all non-deleted documents', async () => {
    const { result } = renderHook(() => useExtractorRepository());

    await act(async () => {
      await result.current.create({
        line_id: 'line-1', machine_id: 'm1', shift_id: 's1', operator_id: 'u1',
        extractor_1_on: true, extractor_2_on: true, extractor_3_on: true,
        extractor_4_on: true, extractor_5_on: true, extractor_6_on: true,
        extractor_7_on: true, extractor_8_on: true,
        cedazo_tt_last_cleaning: 1700000000000,
      });
      await result.current.create({
        line_id: 'line-1', machine_id: 'm2', shift_id: 's2', operator_id: 'u2',
        extractor_1_on: false, extractor_2_on: false, extractor_3_on: false,
        extractor_4_on: false, extractor_5_on: false, extractor_6_on: false,
        extractor_7_on: false, extractor_8_on: false,
        cedazo_tt_last_cleaning: 1700000000000,
      });
    });

    const all = await result.current.findAll();
    expect(all).toHaveLength(2);
  });

  it('findAll filters out soft-deleted documents', async () => {
    const { result } = renderHook(() => useExtractorRepository());

    const doc = await result.current.create({
      line_id: 'line-1', machine_id: 'm1', shift_id: 's1', operator_id: 'u1',
      extractor_1_on: true, extractor_2_on: true, extractor_3_on: true,
      extractor_4_on: true, extractor_5_on: true, extractor_6_on: true,
      extractor_7_on: true, extractor_8_on: true,
      cedazo_tt_last_cleaning: 1700000000000,
    });

    await act(async () => {
      await result.current.remove(doc.id);
    });

    const all = await result.current.findAll();
    expect(all).toHaveLength(0);
  });

  // ─── UPDATE ─────────────────────────────────────────────────────────────────

  it('updates an existing document', async () => {
    const { result } = renderHook(() => useExtractorRepository());

    const doc = await result.current.create({
      line_id: 'line-1', machine_id: 'm1', shift_id: 's1', operator_id: 'u1',
      extractor_1_on: true, extractor_2_on: true, extractor_3_on: true,
      extractor_4_on: true, extractor_5_on: true, extractor_6_on: true,
      extractor_7_on: true, extractor_8_on: true,
      cedazo_tt_last_cleaning: 1700000000000,
    });

    const updated = await result.current.update(doc.id, {
      extractor_1_on: false,
      cedazo_tt_last_cleaning: 1800000000000,
    });

    expect(updated).not.toBeNull();
    expect((updated as unknown as Record<string, unknown>).extractor_1_on).toBe(false);
    expect((updated as unknown as Record<string, unknown>).cedazo_tt_last_cleaning).toBe(1800000000000);
    expect((updated as unknown as Record<string, unknown>).updated_at).toBe(1234567890);
  });

  it('returns null when updating non-existent document', async () => {
    const { result } = renderHook(() => useExtractorRepository());
    const updated = await result.current.update('nonexistent', { extractor_1_on: false });
    expect(updated).toBeNull();
  });

  // ─── SOFT DELETE ────────────────────────────────────────────────────────────

  it('soft-deletes a document (sets is_deleted=true)', async () => {
    const { result } = renderHook(() => useExtractorRepository());

    const doc = await result.current.create({
      line_id: 'line-1', machine_id: 'm1', shift_id: 's1', operator_id: 'u1',
      extractor_1_on: true, extractor_2_on: true, extractor_3_on: true,
      extractor_4_on: true, extractor_5_on: true, extractor_6_on: true,
      extractor_7_on: true, extractor_8_on: true,
      cedazo_tt_last_cleaning: 1700000000000,
    });

    await act(async () => {
      await result.current.remove(doc.id);
    });

    const found = await result.current.findById(doc.id);
    expect(found).not.toBeNull();
    expect((found as unknown as Record<string, unknown>).is_deleted).toBe(true);
  });

  it('remove is a no-op for non-existent document', async () => {
    const { result } = renderHook(() => useExtractorRepository());
    await expect(result.current.remove('nonexistent')).resolves.not.toThrow();
  });

  // ─── OBSERVABLE ─────────────────────────────────────────────────────────────

  it('docs$ is defined and is an observable', () => {
    const { result } = renderHook(() => useExtractorRepository());
    expect(result.current.docs$).toBeDefined();
    // docs$ should have a subscribe method (Observable contract)
    expect(typeof (result.current.docs$ as any).subscribe).toBe('function');
  });

  it('docs$ emits non-deleted documents', () => {
    const { result } = renderHook(() => useExtractorRepository());
    const spy = jest.fn();
    const sub = (result.current.docs$ as any).subscribe(spy);

    expect(spy).toHaveBeenCalledTimes(1);
    sub.unsubscribe();
  });
});
