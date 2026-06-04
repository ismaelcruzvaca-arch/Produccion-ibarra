/**
 * Defect Logs Repository Hook — CRUD operations on the defect_logs collection.
 *
 * Pattern: Repository + Hook (Anti-Corruption Layer)
 * Why:
 * - defect_logs is a 1:N child of quality_inspections.
 * - Free-text defect_type (no catalog lookup), with severity classification.
 *
 * Uses `updated_at` (not `client_updated_at`) matching the newer data contract.
 */

import { useCallback, useMemo } from 'react';
import type { Observable } from 'rxjs';
import type { RxDocument } from 'rxdb';

import { generateUuid } from '../utils/uuid';
import { nowMs } from '../utils/timestamp';
import type { IDefectLog } from '../core/types';
import { useDatabase } from '../data/DatabaseContext';
import { getDeviceId } from '../sync/deviceId';

export type CreateDefectLogPayload = Omit<
  IDefectLog, 'id' | 'updated_at' | 'is_deleted' | 'device_id'
> & { device_id?: string };

export interface DefectLogsRepository {
  /** Emits all non-deleted defect logs on change */
  docs$: Observable<RxDocument<IDefectLog>[]>;

  create: (payload: CreateDefectLogPayload) => Promise<RxDocument<IDefectLog>>;
  update: (id: string, patch: Partial<Omit<IDefectLog, 'id'>>) => Promise<RxDocument<IDefectLog> | null>;
  remove: (id: string) => Promise<void>;
  findById: (id: string) => Promise<RxDocument<IDefectLog> | null>;
  findByInspection: (inspectionId: string) => Promise<RxDocument<IDefectLog>[]>;
}

export function useDefectLogsRepository(): DefectLogsRepository {
  const db = useDatabase();

  const docs$: Observable<RxDocument<IDefectLog>[]> = useMemo(
    () =>
      db.collections.defect_logs
        .find({ selector: { is_deleted: { $eq: false } } })
        .$,
    [db],
  );

  const create = useCallback(
    async (payload: CreateDefectLogPayload) => {
      const deviceId = payload.device_id ?? await getDeviceId();
      const newDoc: IDefectLog = {
        id: generateUuid(),
        updated_at: nowMs(),
        is_deleted: false,
        device_id: deviceId,
        ...payload,
      };
      const result = await db.collections.defect_logs.insert(newDoc);
      return result as RxDocument<IDefectLog>;
    },
    [db],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Omit<IDefectLog, 'id'>>) => {
      const doc = await db.collections.defect_logs.findOne(id).exec();
      if (!doc) return null;
      await doc.patch({ ...patch, updated_at: nowMs() });
      return doc as RxDocument<IDefectLog>;
    },
    [db],
  );

  const remove = useCallback(
    async (id: string) => {
      const doc = await db.collections.defect_logs.findOne(id).exec();
      if (!doc) return;
      await doc.patch({ is_deleted: true, updated_at: nowMs() });
    },
    [db],
  );

  const findById = useCallback(
    async (id: string) => {
      const doc = await db.collections.defect_logs.findOne(id).exec();
      return doc as RxDocument<IDefectLog> | null;
    },
    [db],
  );

  const findByInspection = useCallback(
    async (inspectionId: string) => {
      const docs = await db.collections.defect_logs
        .find({ selector: { inspection_id: { $eq: inspectionId }, is_deleted: { $eq: false } } })
        .exec();
      return docs as RxDocument<IDefectLog>[];
    },
    [db],
  );

  return useMemo(
    () => ({ docs$, create, update, remove, findById, findByInspection }),
    [docs$, create, update, remove, findById, findByInspection],
  );
}
