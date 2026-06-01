/**
 * Shift Summary Repository Hook — CRUD operations on the shift_summary collection.
 *
 * Pattern: Repository + Hook (Anti-Corruption Layer)
 * Why:
 * - UI components must NOT interact with RxDB directly.
 * - Wraps RxDB collection and exposes a clean API.
 *
 * Uses `updated_at` (not `client_updated_at`) matching the newer data contract.
 */

import { useCallback, useMemo } from 'react';
import type { Observable } from 'rxjs';
import type { RxDocument } from 'rxdb';

import { generateUuid } from '../utils/uuid';
import { nowMs } from '../utils/timestamp';
import type { IShiftSummary } from '../core/types';
import { useDatabase } from '../data/DatabaseContext';
import { getDeviceId } from '../sync/deviceId';

export type CreateShiftSummaryPayload = Omit<
  IShiftSummary, 'id' | 'updated_at' | 'is_deleted' | 'device_id'
> & { device_id?: string };

export interface ShiftSummaryRepository {
  /** Emits all non-deleted summaries on change */
  docs$: Observable<RxDocument<IShiftSummary>[]>;

  create: (payload: CreateShiftSummaryPayload) => Promise<RxDocument<IShiftSummary>>;
  update: (id: string, patch: Partial<Omit<IShiftSummary, 'id' | 'shift_session_id'>>) => Promise<RxDocument<IShiftSummary> | null>;
  remove: (id: string) => Promise<void>;
  findById: (id: string) => Promise<RxDocument<IShiftSummary> | null>;
  findBySession: (shiftSessionId: string) => Promise<RxDocument<IShiftSummary> | null>;
}

export function useShiftSummaryRepository(): ShiftSummaryRepository {
  const db = useDatabase();

  const docs$: Observable<RxDocument<IShiftSummary>[]> = useMemo(
    () =>
      db.collections.shift_summary
        .find({ selector: { is_deleted: { $eq: false } } })
        .$,
    [db],
  );

  const create = useCallback(
    async (payload: CreateShiftSummaryPayload) => {
      const deviceId = payload.device_id ?? await getDeviceId();
      const newDoc: IShiftSummary = {
        id: generateUuid(),
        updated_at: nowMs(),
        is_deleted: false,
        device_id: deviceId,
        ...payload,
      };
      const result = await db.collections.shift_summary.insert(newDoc);
      return result as RxDocument<IShiftSummary>;
    },
    [db],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Omit<IShiftSummary, 'id' | 'shift_session_id'>>) => {
      const doc = await db.collections.shift_summary.findOne(id).exec();
      if (!doc) return null;
      await doc.patch({ ...patch, updated_at: nowMs() });
      return doc as RxDocument<IShiftSummary>;
    },
    [db],
  );

  const remove = useCallback(
    async (id: string) => {
      const doc = await db.collections.shift_summary.findOne(id).exec();
      if (!doc) return;
      await doc.patch({ is_deleted: true, updated_at: nowMs() });
    },
    [db],
  );

  const findById = useCallback(
    async (id: string) => {
      const doc = await db.collections.shift_summary.findOne(id).exec();
      return doc as RxDocument<IShiftSummary> | null;
    },
    [db],
  );

  const findBySession = useCallback(
    async (shiftSessionId: string) => {
      const docs = await db.collections.shift_summary
        .find({
          selector: {
            shift_session_id: { $eq: shiftSessionId },
            is_deleted: { $eq: false },
          },
        })
        .exec();
      return (docs.length > 0 ? docs[0] : null) as RxDocument<IShiftSummary> | null;
    },
    [db],
  );

  return useMemo(
    () => ({ docs$, create, update, remove, findById, findBySession }),
    [docs$, create, update, remove, findById, findBySession],
  );
}
