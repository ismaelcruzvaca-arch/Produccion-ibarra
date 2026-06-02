/**
 * Vitamin Repository Hook — encapsulates all CRUD operations on the vitamin_kits collection.
 *
 * Pattern: Repository + Hook (Anti-Corruption Layer)
 * Why:
 * - UI components must NEVER interact with RxDB directly.
 * - The repository wraps the `vitamin_kits` RxDB collection and exposes a clean API:
 *     create(), update(), remove(), findById(), findByShift(), findAll(), docs$
 *
 * Observable pattern:
 * - docs$ is an RxJS Observable<RxDocument<IVitaminKit>[]> that emits
 *   the current list of non-deleted vitamin kits on every change.
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
import type { IVitaminKit } from '../core/types';
import { useDatabase } from '../data/DatabaseContext';

/** Payload for creating a vitamin kit — omits auto-generated fields. */
export type CreateVitaminKitPayload = Omit<
  IVitaminKit,
  'id' | 'updated_at' | 'is_deleted'
>;

export interface VitaminRepository {
  /** Emits the current list of non-deleted vitamin kits on every change. */
  docs$: Observable<RxDocument<IVitaminKit>[]>;

  /**
   * Creates a new vitamin kit with auto-generated fields.
   * Sets id (UUID v4), updated_at, and is_deleted=false automatically.
   *
   * @param payload - Vitamin kit data
   * @returns Promise<RxDocument<IVitaminKit>> the newly created document
   */
  create: (payload: CreateVitaminKitPayload) => Promise<RxDocument<IVitaminKit>>;

  /**
   * Updates an existing vitamin kit in place.
   * Sets updated_at to trigger sync.
   *
   * @param id - The vitamin kit UUID
   * @param patch - Partial fields to merge
   * @returns Promise<RxDocument<IVitaminKit> | null> the updated document, or null if not found
   */
  update: (
    id: string,
    patch: Partial<Omit<IVitaminKit, 'id'>>
  ) => Promise<RxDocument<IVitaminKit> | null>;

  /**
   * Soft-deletes a vitamin kit (sets is_deleted=true, updated_at=now).
   *
   * @param id - The vitamin kit UUID
   */
  remove: (id: string) => Promise<void>;

  /**
   * Finds a single vitamin kit by UUID.
   *
   * @param id - The vitamin kit UUID
   * @returns Promise<RxDocument<IVitaminKit> | null>
   */
  findById: (id: string) => Promise<RxDocument<IVitaminKit> | null>;

  /**
   * Finds all non-deleted vitamin kits for a specific shift.
   *
   * @param shiftId - The shift UUID
   * @returns Promise<RxDocument<IVitaminKit>[]>
   */
  findByShift: (shiftId: string) => Promise<RxDocument<IVitaminKit>[]>;

  /**
   * Returns all non-deleted vitamin kits (one-shot, not observable).
   *
   * @returns Promise<RxDocument<IVitaminKit>[]>
   */
  findAll: () => Promise<RxDocument<IVitaminKit>[]>;
}

export function useVitaminRepository(): VitaminRepository {
  const db = useDatabase();

  const docs$: Observable<RxDocument<IVitaminKit>[]> = useMemo(
    () =>
      db.collections.vitamin_kits
        .find({ selector: { is_deleted: { $eq: false } } })
        .$,
    [db]
  );

  const create = useCallback(
    async (payload: CreateVitaminKitPayload) => {
      const newDoc: IVitaminKit = {
        id: generateUuid(),
        updated_at: nowMs(),
        is_deleted: false,
        ...payload,
      };
      const result = await db.collections.vitamin_kits.insert(newDoc);
      return result as RxDocument<IVitaminKit>;
    },
    [db]
  );

  const update = useCallback(
    async (id: string, patch: Partial<Omit<IVitaminKit, 'id'>>) => {
      const doc = await db.collections.vitamin_kits.findOne(id).exec();
      if (!doc) return null;

      await doc.patch({
        ...patch,
        updated_at: nowMs(),
      });
      return doc as RxDocument<IVitaminKit>;
    },
    [db]
  );

  const remove = useCallback(
    async (id: string) => {
      const doc = await db.collections.vitamin_kits.findOne(id).exec();
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
      const doc = await db.collections.vitamin_kits.findOne(id).exec();
      return doc as RxDocument<IVitaminKit> | null;
    },
    [db]
  );

  const findByShift = useCallback(
    async (shiftId: string) => {
      const docs = await db.collections.vitamin_kits
        .find({
          selector: {
            shift_id: { $eq: shiftId },
            is_deleted: { $eq: false },
          },
        })
        .exec();
      return docs as RxDocument<IVitaminKit>[];
    },
    [db]
  );

  const findAll = useCallback(async () => {
    const docs = await db.collections.vitamin_kits
      .find({ selector: { is_deleted: { $eq: false } } })
      .exec();
    return docs as RxDocument<IVitaminKit>[];
  }, [db]);

  return useMemo(
    () => ({
      docs$,
      create,
      update,
      remove,
      findById,
      findByShift,
      findAll,
    }),
    [docs$, create, update, remove, findById, findByShift, findAll]
  );
}
