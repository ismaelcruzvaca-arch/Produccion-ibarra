/**
 * Assets Repository Hook — encapsulates all CRUD operations on the assets collection.
 *
 * Pattern: Repository + Hook (Anti-Corruption Layer)
 * Why:
 * - UI components must NEVER interact with RxDB directly.
 *   Direct RxDB access leaks storage concerns into the presentation layer.
 * - A repository wraps RxDB collections and exposes a clean API:
 *     insert(), update(), remove(), findById(), findAll(), docs$
 * - The hook form (useAssetsRepository) integrates with React's lifecycle
 *   and provides the database instance from Context.
 *
 * Observable pattern:
 * - docs$ is an RxJS Observable<RxDocument<IAsset>[]> that emits
 *   the current list of non-deleted assets on every change.
 * - Components subscribe via: repo.docs$.subscribe(assets => ...)
 * - RxDB's $ observable is lazy — it only fires when data actually changes.
 *
 * Soft delete:
 * - remove(id) does NOT purge the document.
 * - It sets deleted=true and client_updated_at=nowMs(), then syncs to server.
 * - This preserves history and enables the server to apply LWW correctly.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Observable } from 'rxjs';
import type { RxDocument } from 'rxdb';

import { generateUuid } from '../utils/uuid';
import { nowMs } from '../utils/timestamp';
import type { IAsset } from '../core/types';
import { useDatabase } from '../data/DatabaseContext';

/**
 * Repository interface — defines the contract exposed to UI components.
 *
 * All timestamps (in_service_date, warranty_expiration, etc.) are epoch ms numbers.
 * The repository manages IBaseDocument fields (id, client_updated_at, deleted)
 * automatically — callers only provide domain fields.
 */
export interface AssetsRepository {
  /** Emits the current list of non-deleted assets on every change. */
  docs$: Observable<RxDocument<IAsset>[]>;

  /**
   * Inserts a new asset.
   * Sets id (UUID v4), client_updated_at, and deleted=false automatically.
   *
   * @param doc - Asset fields (without id, client_updated_at, deleted)
   * @returns Promise<RxDocument<IAsset>> the newly created document
   */
  insert: (
    doc: Omit<IAsset, 'id' | 'client_updated_at' | 'deleted'>
  ) => Promise<RxDocument<IAsset>>;

  /**
   * Updates an existing asset in place.
   * Sets client_updated_at to trigger sync.
   *
   * @param id - The asset UUID
   * @param patch - Partial asset fields to merge
   * @returns Promise<RxDocument<IAsset> | null> the updated document, or null if not found
   */
  update: (
    id: string,
    patch: Partial<Omit<IAsset, 'id'>>
  ) => Promise<RxDocument<IAsset> | null>;

  /**
   * Soft-deletes an asset (sets deleted=true, client_updated_at=now).
   *
   * @param id - The asset UUID
   */
  remove: (id: string) => Promise<void>;

  /**
   * Finds a single asset by UUID.
   *
   * @param id - The asset UUID
   * @returns Promise<RxDocument<IAsset> | null>
   */
  findById: (id: string) => Promise<RxDocument<IAsset> | null>;

  /**
   * Returns all non-deleted assets (one-shot, not observable).
   *
   * @returns Promise<RxDocument<IAsset>[]>
   */
  findAll: () => Promise<RxDocument<IAsset>[]>;
}

/**
 * useAssetsRepository — React hook that provides an AssetsRepository instance.
 *
 * MUST be called inside a <DatabaseProvider> tree (so useDatabase() works).
 *
 * The returned repository uses the RxDB collection from Context.
 * The observable docs$ is created fresh on each call (stable per component instance).
 */
export function useAssetsRepository(): AssetsRepository {
  const db = useDatabase();

  /**
   * Builds the live query observable for non-deleted assets.
   *
   * Pattern: RxDB live query
   * - db.collections.assets.find().$ is an Observable that emits
   *   the full result set on every change to the collection.
   * - We filter out deleted documents in the query.
   * - The observable is garbage-collected when the component unmounts
   *   (RxDB handles subscription cleanup automatically).
   */
  const docs$: Observable<RxDocument<IAsset>[]> = useMemo(
    () =>
      db.collections.assets
        .find({ selector: { deleted: { $eq: false } } })
        .$,
    [db]
  );

  const insert = useCallback(
    async (doc: Omit<IAsset, 'id' | 'client_updated_at' | 'deleted'>) => {
      const now = nowMs();
      const newDoc: IAsset = {
        ...doc,
        id: generateUuid(),
        client_updated_at: now,
        deleted: false,
      };
      const result = await db.collections.assets.insert(newDoc);
      return result as RxDocument<IAsset>;
    },
    [db]
  );

  const update = useCallback(
    async (id: string, patch: Partial<Omit<IAsset, 'id'>>) => {
      const doc = await db.collections.assets.findOne(id).exec();
      if (!doc) return null;

      await doc.patch({
        ...patch,
        client_updated_at: nowMs(),
      });
      return doc as RxDocument<IAsset>;
    },
    [db]
  );

  const remove = useCallback(
    async (id: string) => {
      const doc = await db.collections.assets.findOne(id).exec();
      if (!doc) return;

      // Soft-delete: set deleted flag and update timestamp for sync
      await doc.patch({
        deleted: true,
        client_updated_at: nowMs(),
      });
    },
    [db]
  );

  const findById = useCallback(
    async (id: string) => {
      const doc = await db.collections.assets.findOne(id).exec();
      return doc as RxDocument<IAsset> | null;
    },
    [db]
  );

  const findAll = useCallback(async () => {
    const docs = await db.collections.assets
      .find({ selector: { deleted: { $eq: false } } })
      .exec();
    return docs as RxDocument<IAsset>[];
  }, [db]);

  return { docs$, insert, update, remove, findById, findAll };
}