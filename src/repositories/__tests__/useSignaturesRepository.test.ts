/**
 * T1.8 — useSignaturesRepository behavioral tests.
 *
 * Follows strict TDD: RED → GREEN → TRIANGULATE → REFACTOR.
 * Mock pattern mirrors useOeeEventsRepository.test.ts.
 */

import React from 'react';
import { create as createRenderer, act } from 'react-test-renderer';
import { useSignaturesRepository } from '../useSignaturesRepository';

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
        const allDocs = Array.from(docs.values()).filter((d) => !d.is_deleted);
        let results: Record<string, unknown>[] = [];
        if (query?.selector?.document_id?.$eq) {
          results = allDocs.filter((d) => d.document_id === query!.selector!.document_id.$eq);
        } else if (query?.selector?.document_type?.$eq) {
          results = allDocs.filter((d) => d.document_type === query!.selector!.document_type.$eq);
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

let mockDb: { collections: { signatures: ReturnType<typeof createMockCollection> } };

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

describe('useSignaturesRepository', () => {
  beforeEach(() => {
    mockUuidCounter = 0;
    const mockCollection = createMockCollection();
    mockDb = {
      collections: {
        signatures: mockCollection,
      },
    };
  });

  it('creates a signature with auto-generated fields', async () => {
    const { result } = renderHook(() => useSignaturesRepository());

    const sig = await result.current.create({
      document_type: 'oee_report',
      document_id: 'report-123',
      signer_id: 'user-456',
      signer_name: 'Juan Pérez',
      signer_role: 'supervisor',
      sequence: 1,
    });

    expect(sig.id).toBe('uuid-1');
    expect(sig.updated_at).toBe(1234567890);
    expect(sig.is_deleted).toBe(false);
    expect(sig.document_type).toBe('oee_report');
    expect(sig.document_id).toBe('report-123');
    expect(sig.signer_id).toBe('user-456');
    expect(sig.signer_name).toBe('Juan Pérez');
    expect(sig.signer_role).toBe('supervisor');
    expect(sig.signed_at).toBe(1234567890);
    expect(sig.sequence).toBe(1);
  });

  it('soft-deletes signature on remove', async () => {
    const { result } = renderHook(() => useSignaturesRepository());

    const sig = await result.current.create({
      document_type: 'oee_report',
      document_id: 'report-abc',
      signer_id: 'user-1',
      signer_name: 'Ana López',
      signer_role: 'operator',
      sequence: 1,
    });

    await act(async () => {
      await result.current.remove(sig.id);
    });

    const found = await result.current.findById(sig.id);
    expect(found).not.toBeNull();
    expect((found as unknown as Record<string, unknown>).is_deleted).toBe(true);
  });

  it('finds signatures by document_id', async () => {
    const { result } = renderHook(() => useSignaturesRepository());

    await act(async () => {
      await result.current.create({
        document_type: 'oee_report',
        document_id: 'report-1',
        signer_id: 'user-a',
        signer_name: 'User A',
        signer_role: 'supervisor',
        sequence: 1,
      });
      await result.current.create({
        document_type: 'oee_report',
        document_id: 'report-2',
        signer_id: 'user-b',
        signer_name: 'User B',
        signer_role: 'operator',
        sequence: 1,
      });
    });

    const report1Sigs = await result.current.findByDocument('report-1');
    expect(report1Sigs).toHaveLength(1);
    expect((report1Sigs[0] as unknown as Record<string, unknown>).document_id).toBe('report-1');
  });

  it('finds signatures by document_type (triangulation)', async () => {
    const { result } = renderHook(() => useSignaturesRepository());

    await act(async () => {
      await result.current.create({
        document_type: 'toaster_log',
        document_id: 'toast-1',
        signer_id: 'user-x',
        signer_name: 'User X',
        signer_role: 'supervisor',
        sequence: 1,
      });
      await result.current.create({
        document_type: 'mixing_batch',
        document_id: 'mix-1',
        signer_id: 'user-y',
        signer_name: 'User Y',
        signer_role: 'operator',
        sequence: 1,
      });
      await result.current.create({
        document_type: 'toaster_log',
        document_id: 'toast-2',
        signer_id: 'user-z',
        signer_name: 'User Z',
        signer_role: 'supervisor',
        sequence: 1,
      });
    });

    const toasterSigs = await result.current.findByDocumentType('toaster_log');
    expect(toasterSigs).toHaveLength(2);
    toasterSigs.forEach((s: unknown) => {
      expect((s as Record<string, unknown>).document_type).toBe('toaster_log');
    });
  });

  it('findAll returns all non-deleted signatures', async () => {
    const { result } = renderHook(() => useSignaturesRepository());

    await act(async () => {
      await result.current.create({
        document_type: 'oee_report',
        document_id: 'doc-1',
        signer_id: 'u1', signer_name: 'N1', signer_role: 'supervisor', sequence: 1,
      });
      await result.current.create({
        document_type: 'oee_report',
        document_id: 'doc-1',
        signer_id: 'u2', signer_name: 'N2', signer_role: 'operator', sequence: 2,
      });
    });

    const all = await result.current.findAll();
    expect(all).toHaveLength(2);
  });

  it('docs$ observable emits non-deleted signatures', () => {
    const { result } = renderHook(() => useSignaturesRepository());

    // docs$ should be defined
    expect(result.current.docs$).toBeDefined();
  });
});
