/**
 * Mixing Repository Hook — encapsulates all CRUD operations on the mixing_batches collection.
 *
 * Pattern: Repository + Hook (Anti-Corruption Layer)
 * Why:
 * - UI components must NEVER interact with RxDB directly.
 * - The repository wraps the `mixing_batches` RxDB collection and exposes a clean API:
 *     create(), update(), remove(), findById(), findByShift(), findByBatch(), findAll(), docs$
 *
 * Observable pattern:
 * - docs$ is an RxJS Observable<RxDocument<IMixingBatch>[]> that emits
 *   the current list of non-deleted mixing batches on every change.
 *
 * Soft delete:
 * - remove(id) does NOT purge the document.
 * - It sets is_deleted=true and updated_at=nowMs(), then syncs to server.
 */

import { useCallback, useMemo } from 'react';
import type { Observable } from 'rxjs';
import type { RxDocument } from 'rxdb';

import { generateUuid } from '../utils/uuid';
import { nowMs } from '../utils/timestamp';
import type { IMixingBatch } from '../core/types';
import { useDatabase } from '../data/DatabaseContext';

/** Payload for creating a mixing batch — omits auto-generated fields. */
export type CreateMixingBatchPayload = Omit<
  IMixingBatch,
  'id' | 'created_at' | 'updated_at' | 'is_deleted'
>;

export interface MixingRepository {
  /** Emits the current list of non-deleted mixing batches on every change. */
  docs$: Observable<RxDocument<IMixingBatch>[]>;

  /**
   * Creates a new mixing batch with auto-generated fields.
   * Sets id (UUID v4), updated_at, and is_deleted=false automatically.
   *
   * @param payload - Mixing batch data
   * @returns Promise<RxDocument<IMixingBatch>> the newly created document
   */
  create: (payload: CreateMixingBatchPayload) => Promise<RxDocument<IMixingBatch>>;

  /**
   * Updates an existing mixing batch in place.
   * Sets updated_at to trigger sync.
   *
   * @param id - The mixing batch UUID
   * @param patch - Partial fields to merge
   * @returns Promise<RxDocument<IMixingBatch> | null> the updated document, or null if not found
   */
  update: (
    id: string,
    patch: Partial<Omit<IMixingBatch, 'id'>>
  ) => Promise<RxDocument<IMixingBatch> | null>;

  /**
   * Soft-deletes a mixing batch (sets is_deleted=true, updated_at=now).
   *
   * @param id - The mixing batch UUID
   */
  remove: (id: string) => Promise<void>;

  /**
   * Finds a single mixing batch by UUID.
   *
   * @param id - The mixing batch UUID
   * @returns Promise<RxDocument<IMixingBatch> | null>
   */
  findById: (id: string) => Promise<RxDocument<IMixingBatch> | null>;

  /**
   * Finds all non-deleted mixing batches for a specific shift.
   *
   * @param shiftId - The shift UUID
   * @returns Promise<RxDocument<IMixingBatch>[]>
   */
  findByShift: (shiftId: string) => Promise<RxDocument<IMixingBatch>[]>;

  /**
   * Finds a mixing batch by shift and batch sequence.
   *
   * @param shiftId - The shift UUID
   * @param batchSequence - The batch sequence number
   * @returns Promise<RxDocument<IMixingBatch> | null>
   */
  findByBatch: (
    shiftId: string,
    batchSequence: number
  ) => Promise<RxDocument<IMixingBatch> | null>;

  /**
   * Returns all non-deleted mixing batches (one-shot, not observable).
   *
   * @returns Promise<RxDocument<IMixingBatch>[]>
   */
  findAll: () => Promise<RxDocument<IMixingBatch>[]>;
}

export function useMixingRepository(): MixingRepository {
  const db = useDatabase();

  const docs$: Observable<RxDocument<IMixingBatch>[]> = useMemo(
    () =>
      db.collections.mixing_batches
        .find({ selector: { is_deleted: { $eq: false } } })
        .$,
    [db]
  );

  const create = useCallback(
    async (payload: CreateMixingBatchPayload) => {
      const now = nowMs();
      const newDoc: IMixingBatch = {
        id: generateUuid(),
        created_at: now,
        updated_at: now,
        is_deleted: false,
        ...payload,
      };
      const result = await db.collections.mixing_batches.insert(newDoc);
      return result as RxDocument<IMixingBatch>;
    },
    [db]
  );

  const update = useCallback(
    async (id: string, patch: Partial<Omit<IMixingBatch, 'id'>>) => {
      const doc = await db.collections.mixing_batches.findOne(id).exec();
      if (!doc) return null;

      await doc.patch({
        ...patch,
        updated_at: nowMs(),
      });
      return doc as RxDocument<IMixingBatch>;
    },
    [db]
  );

  const remove = useCallback(
    async (id: string) => {
      const doc = await db.collections.mixing_batches.findOne(id).exec();
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
      const doc = await db.collections.mixing_batches.findOne(id).exec();
      return doc as RxDocument<IMixingBatch> | null;
    },
    [db]
  );

  const findByShift = useCallback(
    async (shiftId: string) => {
      const docs = await db.collections.mixing_batches
        .find({
          selector: {
            shift_id: { $eq: shiftId },
            is_deleted: { $eq: false },
          },
        })
        .exec();
      return docs as RxDocument<IMixingBatch>[];
    },
    [db]
  );

  const findByBatch = useCallback(
    async (shiftId: string, batchSequence: number) => {
      const docs = await db.collections.mixing_batches
        .find({
          selector: {
            shift_id: { $eq: shiftId },
            batch_sequence: { $eq: batchSequence },
            is_deleted: { $eq: false },
          },
        })
        .exec();
      return (docs[0] ?? null) as RxDocument<IMixingBatch> | null;
    },
    [db]
  );

  const findAll = useCallback(async () => {
    const docs = await db.collections.mixing_batches
      .find({ selector: { is_deleted: { $eq: false } } })
      .exec();
    return docs as RxDocument<IMixingBatch>[];
  }, [db]);

  return useMemo(
    () => ({
      docs$,
      create,
      update,
      remove,
      findById,
      findByShift,
      findByBatch,
      findAll,
    }),
    [docs$, create, update, remove, findById, findByShift, findByBatch, findAll]
  );
}
