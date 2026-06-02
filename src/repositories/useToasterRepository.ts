/**
 * Toaster Repository Hook — encapsulates all CRUD operations on the toaster_logs collection.
 *
 * Pattern: Repository + Hook (Anti-Corruption Layer)
 * Why:
 * - UI components must NEVER interact with RxDB directly.
 * - The repository wraps the `toaster_logs` RxDB collection and exposes a clean API:
 *     create(), update(), remove(), findById(), findByShift(), findByBatch(), findAll(), docs$
 *
 * Observable pattern:
 * - docs$ is an RxJS Observable<RxDocument<IToasterLog>[]> that emits
 *   the current list of non-deleted toaster logs on every change.
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
import type { IToasterLog } from '../core/types';
import { useDatabase } from '../data/DatabaseContext';

/** Payload for creating a toaster log — omits auto-generated fields. */
export type CreateToasterLogPayload = Omit<
  IToasterLog,
  'id' | 'created_at' | 'updated_at' | 'is_deleted'
>;

export interface ToasterRepository {
  /** Emits the current list of non-deleted toaster logs on every change. */
  docs$: Observable<RxDocument<IToasterLog>[]>;

  /**
   * Creates a new toaster log with auto-generated fields.
   * Sets id (UUID v4), updated_at, and is_deleted=false automatically.
   *
   * @param payload - Toaster log data
   * @returns Promise<RxDocument<IToasterLog>> the newly created document
   */
  create: (payload: CreateToasterLogPayload) => Promise<RxDocument<IToasterLog>>;

  /**
   * Updates an existing toaster log in place.
   * Sets updated_at to trigger sync.
   *
   * @param id - The toaster log UUID
   * @param patch - Partial fields to merge
   * @returns Promise<RxDocument<IToasterLog> | null> the updated document, or null if not found
   */
  update: (
    id: string,
    patch: Partial<Omit<IToasterLog, 'id'>>
  ) => Promise<RxDocument<IToasterLog> | null>;

  /**
   * Soft-deletes a toaster log (sets is_deleted=true, updated_at=now).
   *
   * @param id - The toaster log UUID
   */
  remove: (id: string) => Promise<void>;

  /**
   * Finds a single toaster log by UUID.
   *
   * @param id - The toaster log UUID
   * @returns Promise<RxDocument<IToasterLog> | null>
   */
  findById: (id: string) => Promise<RxDocument<IToasterLog> | null>;

  /**
   * Finds all non-deleted toaster logs for a specific shift.
   *
   * @param shiftId - The shift UUID
   * @returns Promise<RxDocument<IToasterLog>[]>
   */
  findByShift: (shiftId: string) => Promise<RxDocument<IToasterLog>[]>;

  /**
   * Finds a toaster log by shift and batch number.
   *
   * @param shiftId - The shift UUID
   * @param batchNumber - The batch number
   * @returns Promise<RxDocument<IToasterLog> | null>
   */
  findByBatch: (
    shiftId: string,
    batchNumber: string
  ) => Promise<RxDocument<IToasterLog> | null>;

  /**
   * Returns all non-deleted toaster logs (one-shot, not observable).
   *
   * @returns Promise<RxDocument<IToasterLog>[]>
   */
  findAll: () => Promise<RxDocument<IToasterLog>[]>;
}

export function useToasterRepository(): ToasterRepository {
  const db = useDatabase();

  const docs$: Observable<RxDocument<IToasterLog>[]> = useMemo(
    () =>
      db.collections.toaster_logs
        .find({ selector: { is_deleted: { $eq: false } } })
        .$,
    [db]
  );

  const create = useCallback(
    async (payload: CreateToasterLogPayload) => {
      const now = nowMs();
      const newDoc: IToasterLog = {
        id: generateUuid(),
        created_at: now,
        updated_at: now,
        is_deleted: false,
        ...payload,
      };
      const result = await db.collections.toaster_logs.insert(newDoc);
      return result as RxDocument<IToasterLog>;
    },
    [db]
  );

  const update = useCallback(
    async (id: string, patch: Partial<Omit<IToasterLog, 'id'>>) => {
      const doc = await db.collections.toaster_logs.findOne(id).exec();
      if (!doc) return null;

      await doc.patch({
        ...patch,
        updated_at: nowMs(),
      });
      return doc as RxDocument<IToasterLog>;
    },
    [db]
  );

  const remove = useCallback(
    async (id: string) => {
      const doc = await db.collections.toaster_logs.findOne(id).exec();
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
      const doc = await db.collections.toaster_logs.findOne(id).exec();
      return doc as RxDocument<IToasterLog> | null;
    },
    [db]
  );

  const findByShift = useCallback(
    async (shiftId: string) => {
      const docs = await db.collections.toaster_logs
        .find({
          selector: {
            shift_id: { $eq: shiftId },
            is_deleted: { $eq: false },
          },
        })
        .exec();
      return docs as RxDocument<IToasterLog>[];
    },
    [db]
  );

  const findByBatch = useCallback(
    async (shiftId: string, batchNumber: string) => {
      const docs = await db.collections.toaster_logs
        .find({
          selector: {
            shift_id: { $eq: shiftId },
            batch_number: { $eq: batchNumber },
            is_deleted: { $eq: false },
          },
        })
        .exec();
      return (docs[0] ?? null) as RxDocument<IToasterLog> | null;
    },
    [db]
  );

  const findAll = useCallback(async () => {
    const docs = await db.collections.toaster_logs
      .find({ selector: { is_deleted: { $eq: false } } })
      .exec();
    return docs as RxDocument<IToasterLog>[];
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
