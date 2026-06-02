/**
 * Extractor Repository Hook — encapsulates all CRUD operations on the extractor_checks collection.
 *
 * Pattern: Repository + Hook (Anti-Corruption Layer)
 * Why:
 * - UI components must NEVER interact with RxDB directly.
 * - The repository wraps the `extractor_checks` RxDB collection and exposes a clean API:
 *     create(), update(), remove(), findById(), findByShift(), findAll(), docs$
 *
 * Observable pattern:
 * - docs$ is an RxJS Observable<RxDocument<IExtractorCheck>[]> that emits
 *   the current list of non-deleted extractor checks on every change.
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
import type { IExtractorCheck } from '../core/types';
import { useDatabase } from '../data/DatabaseContext';

/** Payload for creating an extractor check — omits auto-generated fields. */
export type CreateExtractorCheckPayload = Omit<
  IExtractorCheck,
  'id' | 'updated_at' | 'is_deleted'
>;

export interface ExtractorRepository {
  /** Emits the current list of non-deleted extractor checks on every change. */
  docs$: Observable<RxDocument<IExtractorCheck>[]>;

  /**
   * Creates a new extractor check with auto-generated fields.
   * Sets id (UUID v4), updated_at, and is_deleted=false automatically.
   *
   * @param payload - Extractor check data
   * @returns Promise<RxDocument<IExtractorCheck>> the newly created document
   */
  create: (payload: CreateExtractorCheckPayload) => Promise<RxDocument<IExtractorCheck>>;

  /**
   * Updates an existing extractor check in place.
   * Sets updated_at to trigger sync.
   *
   * @param id - The extractor check UUID
   * @param patch - Partial fields to merge
   * @returns Promise<RxDocument<IExtractorCheck> | null> the updated document, or null if not found
   */
  update: (
    id: string,
    patch: Partial<Omit<IExtractorCheck, 'id'>>
  ) => Promise<RxDocument<IExtractorCheck> | null>;

  /**
   * Soft-deletes an extractor check (sets is_deleted=true, updated_at=now).
   *
   * @param id - The extractor check UUID
   */
  remove: (id: string) => Promise<void>;

  /**
   * Finds a single extractor check by UUID.
   *
   * @param id - The extractor check UUID
   * @returns Promise<RxDocument<IExtractorCheck> | null>
   */
  findById: (id: string) => Promise<RxDocument<IExtractorCheck> | null>;

  /**
   * Finds all non-deleted extractor checks for a specific shift.
   *
   * @param shiftId - The shift UUID
   * @returns Promise<RxDocument<IExtractorCheck>[]>
   */
  findByShift: (shiftId: string) => Promise<RxDocument<IExtractorCheck>[]>;

  /**
   * Returns all non-deleted extractor checks (one-shot, not observable).
   *
   * @returns Promise<RxDocument<IExtractorCheck>[]>
   */
  findAll: () => Promise<RxDocument<IExtractorCheck>[]>;
}

export function useExtractorRepository(): ExtractorRepository {
  const db = useDatabase();

  const docs$: Observable<RxDocument<IExtractorCheck>[]> = useMemo(
    () =>
      db.collections.extractor_checks
        .find({ selector: { is_deleted: { $eq: false } } })
        .$,
    [db]
  );

  const create = useCallback(
    async (payload: CreateExtractorCheckPayload) => {
      const newDoc: IExtractorCheck = {
        id: generateUuid(),
        updated_at: nowMs(),
        is_deleted: false,
        ...payload,
      };
      const result = await db.collections.extractor_checks.insert(newDoc);
      return result as RxDocument<IExtractorCheck>;
    },
    [db]
  );

  const update = useCallback(
    async (id: string, patch: Partial<Omit<IExtractorCheck, 'id'>>) => {
      const doc = await db.collections.extractor_checks.findOne(id).exec();
      if (!doc) return null;

      await doc.patch({
        ...patch,
        updated_at: nowMs(),
      });
      return doc as RxDocument<IExtractorCheck>;
    },
    [db]
  );

  const remove = useCallback(
    async (id: string) => {
      const doc = await db.collections.extractor_checks.findOne(id).exec();
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
      const doc = await db.collections.extractor_checks.findOne(id).exec();
      return doc as RxDocument<IExtractorCheck> | null;
    },
    [db]
  );

  const findByShift = useCallback(
    async (shiftId: string) => {
      const docs = await db.collections.extractor_checks
        .find({
          selector: {
            shift_id: { $eq: shiftId },
            is_deleted: { $eq: false },
          },
        })
        .exec();
      return docs as RxDocument<IExtractorCheck>[];
    },
    [db]
  );

  const findAll = useCallback(async () => {
    const docs = await db.collections.extractor_checks
      .find({ selector: { is_deleted: { $eq: false } } })
      .exec();
    return docs as RxDocument<IExtractorCheck>[];
  }, [db]);

  return useMemo(
    () => ({ docs$, create, update, remove, findById, findByShift, findAll }),
    [docs$, create, update, remove, findById, findByShift, findAll]
  );
}
