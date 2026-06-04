/**
 * Downtime Conciliation Repository Hook — CRUD operations on the downtime_conciliation collection.
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
import type { IDowntimeConciliation, ConciliationStatus } from '../core/types';
import { useDatabase } from '../data/DatabaseContext';
import { getDeviceId } from '../sync/deviceId';

export type CreateDowntimeConciliationPayload = Omit<
  IDowntimeConciliation, 'id' | 'updated_at' | 'is_deleted' | 'device_id'
> & { device_id?: string };

export type UpdateDowntimeConciliationPayload = Partial<
  Omit<IDowntimeConciliation, 'id' | 'oee_event_id' | 'updated_at' | 'is_deleted' | 'device_id'>
>;

export interface DowntimeConciliationRepository {
  /** Emits all non-deleted conciliation records on change */
  docs$: Observable<RxDocument<IDowntimeConciliation>[]>;

  create: (payload: CreateDowntimeConciliationPayload) => Promise<RxDocument<IDowntimeConciliation>>;
  update: (id: string, patch: UpdateDowntimeConciliationPayload) => Promise<RxDocument<IDowntimeConciliation> | null>;
  remove: (id: string) => Promise<void>;
  findById: (id: string) => Promise<RxDocument<IDowntimeConciliation> | null>;
  findByStatus: (status: ConciliationStatus) => Promise<RxDocument<IDowntimeConciliation>[]>;
  findByMachineId: (machineId: string) => Promise<RxDocument<IDowntimeConciliation>[]>;
  findPendingByMachine: (machineId: string) => Promise<RxDocument<IDowntimeConciliation>[]>;
  findByShift: (shiftSessionId: string) => Promise<RxDocument<IDowntimeConciliation>[]>;
  findPendingByShift: (shiftSessionId: string) => Promise<RxDocument<IDowntimeConciliation>[]>;
}

export function useDowntimeConciliationRepository(): DowntimeConciliationRepository {
  const db = useDatabase();

  const docs$: Observable<RxDocument<IDowntimeConciliation>[]> = useMemo(
    () =>
      db.collections.downtime_conciliation
        .find({ selector: { is_deleted: { $eq: false } } })
        .$,
    [db],
  );

  const create = useCallback(
    async (payload: CreateDowntimeConciliationPayload) => {
      const deviceId = payload.device_id ?? await getDeviceId();
      const newDoc: IDowntimeConciliation = {
        id: generateUuid(),
        updated_at: nowMs(),
        is_deleted: false,
        device_id: deviceId,
        ...payload,
      };
      const result = await db.collections.downtime_conciliation.insert(newDoc);
      return result as RxDocument<IDowntimeConciliation>;
    },
    [db],
  );

  const update = useCallback(
    async (id: string, patch: UpdateDowntimeConciliationPayload) => {
      const doc = await db.collections.downtime_conciliation.findOne(id).exec();
      if (!doc) return null;
      // Don't allow updating reconciled/disputed records? For now allow it.
      await doc.patch({ ...patch, updated_at: nowMs() });
      return doc as RxDocument<IDowntimeConciliation>;
    },
    [db],
  );

  const remove = useCallback(
    async (id: string) => {
      const doc = await db.collections.downtime_conciliation.findOne(id).exec();
      if (!doc) return;
      await doc.patch({ is_deleted: true, updated_at: nowMs() });
    },
    [db],
  );

  const findById = useCallback(
    async (id: string) => {
      const doc = await db.collections.downtime_conciliation.findOne(id).exec();
      return doc as RxDocument<IDowntimeConciliation> | null;
    },
    [db],
  );

  const findByStatus = useCallback(
    async (status: ConciliationStatus) => {
      const docs = await db.collections.downtime_conciliation
        .find({ selector: { status: { $eq: status }, is_deleted: { $eq: false } } })
        .exec();
      return docs as RxDocument<IDowntimeConciliation>[];
    },
    [db],
  );

  const findByMachineId = useCallback(
    async (machineId: string) => {
      const docs = await db.collections.downtime_conciliation
        .find({ selector: { machine_id: { $eq: machineId }, is_deleted: { $eq: false } } })
        .exec();
      return docs as RxDocument<IDowntimeConciliation>[];
    },
    [db],
  );

  const findPendingByMachine = useCallback(
    async (machineId: string) => {
      const docs = await db.collections.downtime_conciliation
        .find({
          selector: {
            machine_id: { $eq: machineId },
            status: { $eq: 'pending' },
            is_deleted: { $eq: false },
          },
          sort: [{ updated_at: 'asc' }],
        })
        .exec();
      return docs as RxDocument<IDowntimeConciliation>[];
    },
    [db],
  );

  const findByShift = useCallback(
    async (shiftSessionId: string) => {
      const docs = await db.collections.downtime_conciliation
        .find({
          selector: {
            shift_session_id: { $eq: shiftSessionId },
            is_deleted: { $eq: false },
          },
          sort: [{ updated_at: 'asc' }],
        })
        .exec();
      return docs as RxDocument<IDowntimeConciliation>[];
    },
    [db],
  );

  const findPendingByShift = useCallback(
    async (shiftSessionId: string) => {
      const docs = await db.collections.downtime_conciliation
        .find({
          selector: {
            shift_session_id: { $eq: shiftSessionId },
            status: { $eq: 'pending' },
            is_deleted: { $eq: false },
          },
          sort: [{ updated_at: 'asc' }],
        })
        .exec();
      return docs as RxDocument<IDowntimeConciliation>[];
    },
    [db],
  );

  return useMemo(
    () => ({
      docs$, create, update, remove, findById,
      findByStatus, findByMachineId, findPendingByMachine, findByShift, findPendingByShift,
    }),
    [docs$, create, update, remove, findById, findByStatus, findByMachineId, findPendingByMachine, findPendingByShift],
  );
}
