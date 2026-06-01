/**
 * Signatures Repository Hook — encapsulates all CRUD operations on the signatures collection.
 *
 * Pattern: Repository + Hook (Anti-Corruption Layer)
 * Why:
 * - UI components must NEVER interact with RxDB directly.
 * - The repository wraps the `signatures` RxDB collection and exposes a clean API:
 *     create(), update(), remove(), findById(), findByDocument(), findByDocumentType(), findAll(), docs$
 * - The hook form integrates with React's lifecycle and provides the database
 *   instance from Context.
 *
 * Observable pattern:
 * - docs$ is an RxJS Observable<RxDocument<ISignature>[]> that emits
 *   the current list of non-deleted signatures on every change.
 *
 * Soft delete:
 * - remove(id) does NOT purge the document.
 * - It sets is_deleted=true and updated_at=nowMs(), then syncs to server.
 *
 * Shared collection:
 * - The `signatures` collection serves ALL form types discriminated by `document_type`.
 */

import { useCallback, useMemo } from 'react';
import type { Observable } from 'rxjs';
import type { RxDocument } from 'rxdb';

import { generateUuid } from '../utils/uuid';
import { nowMs } from '../utils/timestamp';
import type { ISignature } from '../core/types';
import { useDatabase } from '../data/DatabaseContext';

/** Payload for creating a signature — omits auto-generated fields. */
export type CreateSignaturePayload = Omit<ISignature, 'id' | 'updated_at' | 'is_deleted' | 'signed_at'>;

export interface SignaturesRepository {
  /** Emits the current list of non-deleted signatures on every change. */
  docs$: Observable<RxDocument<ISignature>[]>;

  /**
   * Creates a new signature with auto-generated fields.
   * Sets id (UUID v4), updated_at, is_deleted=false, and signed_at automatically.
   *
   * @param payload - Signature data (document_type, document_id, signer info, sequence)
   * @returns Promise<RxDocument<ISignature>> the newly created document
   */
  create: (payload: CreateSignaturePayload) => Promise<RxDocument<ISignature>>;

  /**
   * Updates an existing signature in place.
   * Sets updated_at to trigger sync.
   *
   * @param id - The signature UUID
   * @param patch - Partial signature fields to merge
   * @returns Promise<RxDocument<ISignature> | null> the updated document, or null if not found
   */
  update: (
    id: string,
    patch: Partial<Omit<ISignature, 'id'>>
  ) => Promise<RxDocument<ISignature> | null>;

  /**
   * Soft-deletes a signature (sets is_deleted=true, updated_at=now).
   *
   * @param id - The signature UUID
   */
  remove: (id: string) => Promise<void>;

  /**
   * Finds a single signature by UUID.
   *
   * @param id - The signature UUID
   * @returns Promise<RxDocument<ISignature> | null>
   */
  findById: (id: string) => Promise<RxDocument<ISignature> | null>;

  /**
   * Finds all non-deleted signatures for a specific document.
   * Ordered by sequence ascending.
   *
   * @param documentId - The document UUID
   * @returns Promise<RxDocument<ISignature>[]>
   */
  findByDocument: (documentId: string) => Promise<RxDocument<ISignature>[]>;

  /**
   * Finds all non-deleted signatures of a specific document_type.
   *
   * @param documentType - e.g. 'oee_report', 'toaster_log', 'quality_inspection'
   * @returns Promise<RxDocument<ISignature>[]>
   */
  findByDocumentType: (documentType: string) => Promise<RxDocument<ISignature>[]>;

  /**
   * Returns all non-deleted signatures (one-shot, not observable).
   *
   * @returns Promise<RxDocument<ISignature>[]>
   */
  findAll: () => Promise<RxDocument<ISignature>[]>;
}

export function useSignaturesRepository(): SignaturesRepository {
  const db = useDatabase();

  const docs$: Observable<RxDocument<ISignature>[]> = useMemo(
    () =>
      db.collections.signatures
        .find({ selector: { is_deleted: { $eq: false } } })
        .$,
    [db]
  );

  const create = useCallback(
    async (payload: CreateSignaturePayload) => {
      const newDoc: ISignature = {
        id: generateUuid(),
        updated_at: nowMs(),
        is_deleted: false,
        signed_at: nowMs(),
        ...payload,
      };
      const result = await db.collections.signatures.insert(newDoc);
      return result as RxDocument<ISignature>;
    },
    [db]
  );

  const update = useCallback(
    async (id: string, patch: Partial<Omit<ISignature, 'id'>>) => {
      const doc = await db.collections.signatures.findOne(id).exec();
      if (!doc) return null;

      await doc.patch({
        ...patch,
        updated_at: nowMs(),
      });
      return doc as RxDocument<ISignature>;
    },
    [db]
  );

  const remove = useCallback(
    async (id: string) => {
      const doc = await db.collections.signatures.findOne(id).exec();
      if (!doc) return;

      await doc.patch({
        is_deleted: true,
        updated_at: nowMs(),
      });
    },
    [db]
  );

  const findById = useCallback(
    async (id: string) => {
      const doc = await db.collections.signatures.findOne(id).exec();
      return doc as RxDocument<ISignature> | null;
    },
    [db]
  );

  const findByDocument = useCallback(
    async (documentId: string) => {
      const docs = await db.collections.signatures
        .find({
          selector: {
            document_id: { $eq: documentId },
            is_deleted: { $eq: false },
          },
        })
        .exec();
      return docs as RxDocument<ISignature>[];
    },
    [db]
  );

  const findByDocumentType = useCallback(
    async (documentType: string) => {
      const docs = await db.collections.signatures
        .find({
          selector: {
            document_type: { $eq: documentType },
            is_deleted: { $eq: false },
          },
        })
        .exec();
      return docs as RxDocument<ISignature>[];
    },
    [db]
  );

  const findAll = useCallback(async () => {
    const docs = await db.collections.signatures
      .find({ selector: { is_deleted: { $eq: false } } })
      .exec();
    return docs as RxDocument<ISignature>[];
  }, [db]);

  return useMemo(
    () => ({ docs$, create, update, remove, findById, findByDocument, findByDocumentType, findAll }),
    [docs$, create, update, remove, findById, findByDocument, findByDocumentType, findAll]
  );
}
