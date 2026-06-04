/**
 * Weight Logs Repository Hook — CRUD operations on the weight_logs collection.
 *
 * Pattern: Repository + Hook (Anti-Corruption Layer)
 * Why:
 * - weight_logs is a 1:N child of quality_inspections.
 * - Each log entry records a single measured_weight value.
 *
 * Uses `updated_at` (not `client_updated_at`) matching the newer data contract.
 */

import { useCallback, useMemo } from 'react';
import type { Observable } from 'rxjs';
import type { RxDocument } from 'rxdb';

import { generateUuid } from '../utils/uuid';
import { nowMs } from '../utils/timestamp';
import type { IWeightLog } from '../core/types';
import { useDatabase } from '../data/DatabaseContext';
import { getDeviceId } from '../sync/deviceId';

export type CreateWeightLogPayload = Omit<
  IWeightLog, 'id' | 'updated_at' | 'is_deleted' | 'device_id'
> & { device_id?: string };

export interface WeightLogsRepository {
  /** Emits all non-deleted weight logs on change */
  docs$: Observable<RxDocument<IWeightLog>[]>;

  create: (payload: CreateWeightLogPayload) => Promise<RxDocument<IWeightLog>>;
  update: (id: string, patch: Partial<Omit<IWeightLog, 'id'>>) => Promise<RxDocument<IWeightLog> | null>;
  remove: (id: string) => Promise<void>;
  findById: (id: string) => Promise<RxDocument<IWeightLog> | null>;
  findByInspection: (inspectionId: string) => Promise<RxDocument<IWeightLog>[]>;
}

export function useWeightLogsRepository(): WeightLogsRepository {
  const db = useDatabase();

  const docs$: Observable<RxDocument<IWeightLog>[]> = useMemo(
    () =>
      db.collections.weight_logs
        .find({ selector: { is_deleted: { $eq: false } } })
        .$,
    [db],
  );

  const create = useCallback(
    async (payload: CreateWeightLogPayload) => {
      const deviceId = payload.device_id ?? await getDeviceId();
      const newDoc: IWeightLog = {
        id: generateUuid(),
        updated_at: nowMs(),
        is_deleted: false,
        device_id: deviceId,
        ...payload,
      };
      const result = await db.collections.weight_logs.insert(newDoc);
      return result as RxDocument<IWeightLog>;
    },
    [db],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Omit<IWeightLog, 'id'>>) => {
      const doc = await db.collections.weight_logs.findOne(id).exec();
      if (!doc) return null;
      await doc.patch({ ...patch, updated_at: nowMs() });
      return doc as RxDocument<IWeightLog>;
    },
    [db],
  );

  const remove = useCallback(
    async (id: string) => {
      const doc = await db.collections.weight_logs.findOne(id).exec();
      if (!doc) return;
      await doc.patch({ is_deleted: true, updated_at: nowMs() });
    },
    [db],
  );

  const findById = useCallback(
    async (id: string) => {
      const doc = await db.collections.weight_logs.findOne(id).exec();
      return doc as RxDocument<IWeightLog> | null;
    },
    [db],
  );

  const findByInspection = useCallback(
    async (inspectionId: string) => {
      const docs = await db.collections.weight_logs
        .find({ selector: { inspection_id: { $eq: inspectionId }, is_deleted: { $eq: false } } })
        .exec();
      return docs as RxDocument<IWeightLog>[];
    },
    [db],
  );

  return useMemo(
    () => ({ docs$, create, update, remove, findById, findByInspection }),
    [docs$, create, update, remove, findById, findByInspection],
  );
}
