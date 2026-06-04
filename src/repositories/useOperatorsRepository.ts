/**
 * Operators Repository Hook — CRUD operations on the operators collection.
 *
 * Pattern: Repository + Hook (Anti-Corruption Layer)
 * Why:
 * - UI components must NOT interact with RxDB directly.
 * - Wraps RxDB collection and exposes a clean API.
 *
 * Fields match Hasura: id IS the Epicor payroll code, full_name, is_active.
 * No more employee_code, role.
 */

import { useCallback, useMemo } from 'react';
import type { Observable } from 'rxjs';
import type { RxDocument } from 'rxdb';

import { generateUuid } from '../utils/uuid';
import { nowMs } from '../utils/timestamp';
import type { IOperator } from '../core/types';
import { useDatabase } from '../data/DatabaseContext';
import { getDeviceId } from '../sync/deviceId';

export type CreateOperatorPayload = Omit<IOperator, 'id' | 'updated_at' | 'device_id'> & { device_id?: string };

export interface OperatorsRepository {
  /** Emits all non-deleted operators on change */
  docs$: Observable<RxDocument<IOperator>[]>;

  create: (payload: CreateOperatorPayload) => Promise<RxDocument<IOperator>>;
  update: (id: string, patch: Partial<Omit<IOperator, 'id'>>) => Promise<RxDocument<IOperator> | null>;
  findById: (id: string) => Promise<RxDocument<IOperator> | null>;
  findActive: () => Promise<RxDocument<IOperator>[]>;
}

export function useOperatorsRepository(): OperatorsRepository {
  const db = useDatabase();

  const docs$: Observable<RxDocument<IOperator>[]> = useMemo(
    () =>
      db.collections.operators
        .find({ selector: { is_active: { $eq: true } } })
        .$,
    [db],
  );

  const create = useCallback(
    async (payload: CreateOperatorPayload) => {
      const deviceId = payload.device_id ?? await getDeviceId();
      const newDoc: IOperator = {
        id: generateUuid(),
        updated_at: nowMs(),
        device_id: deviceId,
        ...payload,
        is_deleted: payload.is_deleted ?? false,
      };
      const result = await db.collections.operators.insert(newDoc);
      return result as RxDocument<IOperator>;
    },
    [db],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Omit<IOperator, 'id'>>) => {
      const doc = await db.collections.operators.findOne(id).exec();
      if (!doc) return null;
      await doc.patch({ ...patch, updated_at: nowMs() });
      return doc as RxDocument<IOperator>;
    },
    [db],
  );

  const findById = useCallback(
    async (id: string) => {
      const doc = await db.collections.operators.findOne(id).exec();
      return doc as RxDocument<IOperator> | null;
    },
    [db],
  );

  const findActive = useCallback(
    async () => {
      const docs = await db.collections.operators
        .find({ selector: { is_active: { $eq: true } } })
        .exec();
      return docs as RxDocument<IOperator>[];
    },
    [db],
  );

  return useMemo(
    () => ({ docs$, create, update, findById, findActive }),
    [docs$, create, update, findById, findActive],
  );
}
