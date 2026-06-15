/**
 * Shift Sessions Repository Hook — CRUD operations on the shift_sessions collection.
 *
 * Pattern: Repository + Hook (Anti-Corruption Layer)
 * Why:
 * - UI components must NOT interact with RxDB directly.
 * - Wraps RxDB collection and exposes a clean API.
 *
 * Fields match Hasura: shift_type (string), started_at/ended_at, planned_boxes, product_code.
 * No more line_id, supervisor_id, notes.
 *
 * Uses `updated_at` (not `client_updated_at`) matching the newer data contract.
 */

import { useCallback, useMemo } from 'react';
import type { Observable } from 'rxjs';
import type { RxDocument } from 'rxdb';

import { generateUuid } from '../utils/uuid';
import { nowMs } from '../utils/timestamp';
import type { IShiftSession } from '../core/types';
import { useDatabase } from '../data/DatabaseContext';
import { getDeviceId } from '../sync/deviceId';

export type CreateShiftSessionPayload = Omit<
  IShiftSession, 'id' | 'updated_at' | 'is_deleted' | 'device_id' | 'operator_id'
> & { device_id?: string; operator_id?: string | null };

export interface ShiftSessionsRepository {
  /** Emits all non-deleted sessions on change */
  docs$: Observable<RxDocument<IShiftSession>[]>;

  create: (payload: CreateShiftSessionPayload) => Promise<RxDocument<IShiftSession>>;
  update: (id: string, patch: Partial<Omit<IShiftSession, 'id'>>) => Promise<RxDocument<IShiftSession> | null>;
  remove: (id: string) => Promise<void>;
  findById: (id: string) => Promise<RxDocument<IShiftSession> | null>;
  findActiveByMachine: (machineId: string) => Promise<RxDocument<IShiftSession> | null>;
  /** Returns the single most recent active session across all machines (backbone context). */
  findActive: () => Promise<RxDocument<IShiftSession> | null>;
  findByStatus: (status: 'active' | 'closed') => Promise<RxDocument<IShiftSession>[]>;
}

export function useShiftSessionsRepository(): ShiftSessionsRepository {
  const db = useDatabase();

  const docs$: Observable<RxDocument<IShiftSession>[]> = useMemo(
    () =>
      db.collections.shift_sessions
        .find({ selector: { is_deleted: { $eq: false } } })
        .$,
    [db],
  );

  const create = useCallback(
    async (payload: CreateShiftSessionPayload) => {
      const deviceId = payload.device_id ?? await getDeviceId();
      const operatorId = payload.operator_id ?? null;
      const newDoc: IShiftSession = {
        id: generateUuid(),
        updated_at: nowMs(),
        is_deleted: false,
        device_id: deviceId,
        ...payload,
        operator_id: operatorId,
      };
      const result = await db.collections.shift_sessions.insert(newDoc);
      return result as RxDocument<IShiftSession>;
    },
    [db],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Omit<IShiftSession, 'id'>>) => {
      const doc = await db.collections.shift_sessions.findOne(id).exec();
      if (!doc) return null;
      // Closed sessions are immutable
      const status = doc.get('status') as string;
      if (status === 'closed') {
        throw new Error('No se puede modificar un turno cerrado');
      }
      await doc.patch({ ...patch, updated_at: nowMs() });
      return doc as RxDocument<IShiftSession>;
    },
    [db],
  );

  const remove = useCallback(
    async (id: string) => {
      const doc = await db.collections.shift_sessions.findOne(id).exec();
      if (!doc) return;
      await doc.patch({ is_deleted: true, updated_at: nowMs() });
    },
    [db],
  );

  const findById = useCallback(
    async (id: string) => {
      const doc = await db.collections.shift_sessions.findOne(id).exec();
      return doc as RxDocument<IShiftSession> | null;
    },
    [db],
  );

  const findActiveByMachine = useCallback(
    async (machineId: string) => {
      const docs = await db.collections.shift_sessions
        .find({
          selector: {
            machine_id: { $eq: machineId },
            status: { $eq: 'active' },
            is_deleted: { $eq: false },
          },
          sort: [{ started_at: 'desc' }],
        })
        .exec();
      return (docs.length > 0 ? docs[0] : null) as RxDocument<IShiftSession> | null;
    },
    [db],
  );

  const findActive = useCallback(
    async () => {
      const docs = await db.collections.shift_sessions
        .find({
          selector: {
            status: { $eq: 'active' },
            is_deleted: { $eq: false },
          },
          sort: [{ started_at: 'desc' }],
          limit: 1,
        })
        .exec();
      return (docs.length > 0 ? docs[0] : null) as RxDocument<IShiftSession> | null;
    },
    [db],
  );

  const findByStatus = useCallback(
    async (status: 'active' | 'closed') => {
      const docs = await db.collections.shift_sessions
        .find({ selector: { status: { $eq: status }, is_deleted: { $eq: false } } })
        .exec();
      return docs as RxDocument<IShiftSession>[];
    },
    [db],
  );

  return useMemo(
    () => ({ docs$, create, update, remove, findById, findActiveByMachine, findActive, findByStatus }),
    [docs$, create, update, remove, findById, findActiveByMachine, findActive, findByStatus],
  );
}
