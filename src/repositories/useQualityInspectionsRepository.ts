/**
 * Quality Inspections Repository Hook — CRUD operations on the quality_inspections collection.
 *
 * Pattern: Repository + Hook (Anti-Corruption Layer)
 * Why:
 * - UI components must NOT interact with RxDB directly.
 * - Wraps RxDB collection and exposes a clean API.
 *
 * Fields match Hasura: inspector_id, disposition, shift_type, data_source.
 * Uses `updated_at` (not `client_updated_at`) matching the newer data contract.
 */

import { useCallback, useMemo } from 'react';
import type { Observable } from 'rxjs';
import type { RxDocument } from 'rxdb';

import { generateUuid } from '../utils/uuid';
import { nowMs } from '../utils/timestamp';
import type { IQualityInspection } from '../core/types';
import { useDatabase } from '../data/DatabaseContext';
import { getDeviceId } from '../sync/deviceId';

export type CreateQualityInspectionPayload = Omit<
  IQualityInspection, 'id' | 'updated_at' | 'is_deleted' | 'device_id'
> & { device_id?: string };

export interface QualityInspectionsRepository {
  /** Emits all non-deleted inspections on change */
  docs$: Observable<RxDocument<IQualityInspection>[]>;

  create: (payload: CreateQualityInspectionPayload) => Promise<RxDocument<IQualityInspection>>;
  update: (id: string, patch: Partial<Omit<IQualityInspection, 'id'>>) => Promise<RxDocument<IQualityInspection> | null>;
  remove: (id: string) => Promise<void>;
  findById: (id: string) => Promise<RxDocument<IQualityInspection> | null>;
  findByMachine: (machineId: string) => Promise<RxDocument<IQualityInspection>[]>;
  findByShiftSession: (shiftSessionId: string) => Promise<RxDocument<IQualityInspection>[]>;
}

export function useQualityInspectionsRepository(): QualityInspectionsRepository {
  const db = useDatabase();

  const docs$: Observable<RxDocument<IQualityInspection>[]> = useMemo(
    () =>
      db.collections.quality_inspections
        .find({ selector: { is_deleted: { $eq: false } } })
        .$,
    [db],
  );

  const create = useCallback(
    async (payload: CreateQualityInspectionPayload) => {
      const deviceId = payload.device_id ?? await getDeviceId();
      const newDoc: IQualityInspection = {
        id: generateUuid(),
        updated_at: nowMs(),
        is_deleted: false,
        device_id: deviceId,
        ...payload,
      };
      const result = await db.collections.quality_inspections.insert(newDoc);
      return result as RxDocument<IQualityInspection>;
    },
    [db],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Omit<IQualityInspection, 'id'>>) => {
      const doc = await db.collections.quality_inspections.findOne(id).exec();
      if (!doc) return null;
      await doc.patch({ ...patch, updated_at: nowMs() });
      return doc as RxDocument<IQualityInspection>;
    },
    [db],
  );

  const remove = useCallback(
    async (id: string) => {
      const doc = await db.collections.quality_inspections.findOne(id).exec();
      if (!doc) return;
      await doc.patch({ is_deleted: true, updated_at: nowMs() });
    },
    [db],
  );

  const findById = useCallback(
    async (id: string) => {
      const doc = await db.collections.quality_inspections.findOne(id).exec();
      return doc as RxDocument<IQualityInspection> | null;
    },
    [db],
  );

  const findByMachine = useCallback(
    async (machineId: string) => {
      const docs = await db.collections.quality_inspections
        .find({ selector: { machine_id: { $eq: machineId }, is_deleted: { $eq: false } } })
        .exec();
      return docs as RxDocument<IQualityInspection>[];
    },
    [db],
  );

  const findByShiftSession = useCallback(
    async (shiftSessionId: string) => {
      const docs = await db.collections.quality_inspections
        .find({ selector: { shift_session_id: { $eq: shiftSessionId }, is_deleted: { $eq: false } } })
        .exec();
      return docs as RxDocument<IQualityInspection>[];
    },
    [db],
  );

  return useMemo(
    () => ({ docs$, create, update, remove, findById, findByMachine, findByShiftSession }),
    [docs$, create, update, remove, findById, findByMachine, findByShiftSession],
  );
}
