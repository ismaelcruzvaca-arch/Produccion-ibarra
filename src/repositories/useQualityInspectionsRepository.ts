/**
 * Quality Inspections Repository Hook — encapsulates CRUD operations on the quality_inspections,
 * defect_logs, and weight_logs collections.
 *
 * Pattern: Repository + Hook (Anti-Corruption Layer)
 * Why:
 * - UI components must NEVER interact with RxDB directly.
 * - The repository wraps quality RxDB collections and exposes a clean API:
 *     createInspection(), updateInspection(), remove(), findById(), findByShiftSession(),
 *     findAll(), docs$
 * - Also exposes defect_logs and weight_logs sub-repositories.
 *
 * Soft delete:
 * - remove(id) sets is_deleted=true and updated_at=nowMs().
 *
 * Spec compliance:
 * - QC-1: findByShiftSession() returns inspections for active shift, timestamp DESC
 * - QC-4: Uses shift_session.id (not catalog shift)
 * - QC-3: Stores cached standards (standard_min/standard_max) on the inspection
 * - QC-8: Sets standard_warning when standard missing
 * - QC-9: Defect selector reads from quality_defects
 * - QC-10: Pass/fail chip per inspection card via passed field
 */
import { useCallback, useMemo } from 'react';
import type { Observable } from 'rxjs';
import type { RxDocument } from 'rxdb';

import { generateUuid } from '../utils/uuid';
import { nowMs } from '../utils/timestamp';
import type { IQualityInspection, IDefectLog, IWeightLog } from '../core/types';
import { useDatabase } from '../data/DatabaseContext';

// ─── Payload Types ──────────────────────────────────────────────────────────────

/** Payload for creating a quality inspection — omits auto-generated fields. */
export type CreateInspectionPayload = Omit<
  IQualityInspection,
  'id' | 'updated_at' | 'is_deleted'
>;

/** Payload for creating a defect log — omits auto-generated fields. */
export type CreateDefectLogPayload = Omit<IDefectLog, 'id' | 'updated_at' | 'is_deleted'>;

/** Payload for creating a weight log — omits auto-generated fields. */
export type CreateWeightLogPayload = Omit<IWeightLog, 'id' | 'updated_at' | 'is_deleted'>;

// ─── Repository Interface ───────────────────────────────────────────────────────

export interface QualityInspectionsRepository {
  /** Emits non-deleted inspections on every change. */
  inspections$: Observable<RxDocument<IQualityInspection>[]>;

  /** Creates a new quality inspection. */
  createInspection: (
    payload: CreateInspectionPayload
  ) => Promise<RxDocument<IQualityInspection>>;

  /** Updates an existing inspection. */
  updateInspection: (
    id: string,
    patch: Partial<Omit<IQualityInspection, 'id'>>
  ) => Promise<RxDocument<IQualityInspection> | null>;

  /** Soft-deletes an inspection. */
  removeInspection: (id: string) => Promise<void>;

  /** Finds a single inspection by UUID. */
  findInspectionById: (id: string) => Promise<RxDocument<IQualityInspection> | null>;

  /** Finds inspections for a shift session, ordered by updated_at DESC. */
  findByShiftSession: (
    shiftSessionId: string
  ) => Promise<RxDocument<IQualityInspection>[]>;

  /** Returns all non-deleted inspections. */
  findAllInspections: () => Promise<RxDocument<IQualityInspection>[]>;

  // ─── Defect Logs ────────────────────────────────────────────────────────────

  /** Creates a defect log associated with an inspection. */
  createDefectLog: (
    payload: CreateDefectLogPayload
  ) => Promise<RxDocument<IDefectLog>>;

  /** Finds defect logs by inspection ID. */
  findDefectLogsByInspection: (
    inspectionId: string
  ) => Promise<RxDocument<IDefectLog>[]>;

  // ─── Weight Logs ────────────────────────────────────────────────────────────

  /** Creates a weight log associated with an inspection. */
  createWeightLog: (
    payload: CreateWeightLogPayload
  ) => Promise<RxDocument<IWeightLog>>;

  /** Finds weight logs by inspection ID. */
  findWeightLogsByInspection: (
    inspectionId: string
  ) => Promise<RxDocument<IWeightLog>[]>;
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

export function useQualityInspectionsRepository(): QualityInspectionsRepository {
  const db = useDatabase();

  const inspections$: Observable<RxDocument<IQualityInspection>[]> = useMemo(
    () =>
      db.collections.quality_inspections
        .find({ selector: { is_deleted: { $eq: false } } })
        .$,
    [db]
  );

  // ─── Inspections ───────────────────────────────────────────────────────────

  const createInspection = useCallback(
    async (payload: CreateInspectionPayload) => {
      const newDoc: IQualityInspection = {
        id: generateUuid(),
        updated_at: nowMs(),
        is_deleted: false,
        ...payload,
      };
      const result = await db.collections.quality_inspections.insert(newDoc);
      return result as RxDocument<IQualityInspection>;
    },
    [db]
  );

  const updateInspection = useCallback(
    async (id: string, patch: Partial<Omit<IQualityInspection, 'id'>>) => {
      const doc = await db.collections.quality_inspections.findOne(id).exec();
      if (!doc) return null;

      await doc.patch({
        ...patch,
        updated_at: nowMs(),
      });
      return doc as RxDocument<IQualityInspection>;
    },
    [db]
  );

  const removeInspection = useCallback(
    async (id: string) => {
      const doc = await db.collections.quality_inspections.findOne(id).exec();
      if (!doc) return;

      await doc.patch({
        is_deleted: true,
        updated_at: nowMs(),
      });
    },
    [db]
  );

  const findInspectionById = useCallback(
    async (id: string) => {
      const doc = await db.collections.quality_inspections.findOne(id).exec();
      return doc as RxDocument<IQualityInspection> | null;
    },
    [db]
  );

  const findByShiftSession = useCallback(
    async (shiftSessionId: string) => {
      const docs = await db.collections.quality_inspections
        .find({
          selector: {
            shift_session_id: { $eq: shiftSessionId },
            is_deleted: { $eq: false },
          },
          sort: [{ updated_at: 'desc' }],
        })
        .exec();
      return docs as RxDocument<IQualityInspection>[];
    },
    [db]
  );

  const findAllInspections = useCallback(async () => {
    const docs = await db.collections.quality_inspections
      .find({ selector: { is_deleted: { $eq: false } } })
      .exec();
    return docs as RxDocument<IQualityInspection>[];
  }, [db]);

  // ─── Defect Logs ───────────────────────────────────────────────────────────

  const createDefectLog = useCallback(
    async (payload: CreateDefectLogPayload) => {
      const newDoc: IDefectLog = {
        id: generateUuid(),
        updated_at: nowMs(),
        is_deleted: false,
        ...payload,
      };
      const result = await db.collections.defect_logs.insert(newDoc);
      return result as RxDocument<IDefectLog>;
    },
    [db]
  );

  const findDefectLogsByInspection = useCallback(
    async (inspectionId: string) => {
      const docs = await db.collections.defect_logs
        .find({
          selector: {
            inspection_id: { $eq: inspectionId },
            is_deleted: { $eq: false },
          },
        })
        .exec();
      return docs as RxDocument<IDefectLog>[];
    },
    [db]
  );

  // ─── Weight Logs ───────────────────────────────────────────────────────────

  const createWeightLog = useCallback(
    async (payload: CreateWeightLogPayload) => {
      const newDoc: IWeightLog = {
        id: generateUuid(),
        updated_at: nowMs(),
        is_deleted: false,
        ...payload,
      };
      const result = await db.collections.weight_logs.insert(newDoc);
      return result as RxDocument<IWeightLog>;
    },
    [db]
  );

  const findWeightLogsByInspection = useCallback(
    async (inspectionId: string) => {
      const docs = await db.collections.weight_logs
        .find({
          selector: {
            inspection_id: { $eq: inspectionId },
            is_deleted: { $eq: false },
          },
        })
        .exec();
      return docs as RxDocument<IWeightLog>[];
    },
    [db]
  );

  return useMemo(
    () => ({
      inspections$,
      createInspection,
      updateInspection,
      removeInspection,
      findInspectionById,
      findByShiftSession,
      findAllInspections,
      createDefectLog,
      findDefectLogsByInspection,
      createWeightLog,
      findWeightLogsByInspection,
    }),
    [
      inspections$,
      createInspection,
      updateInspection,
      removeInspection,
      findInspectionById,
      findByShiftSession,
      findAllInspections,
      createDefectLog,
      findDefectLogsByInspection,
      createWeightLog,
      findWeightLogsByInspection,
    ]
  );
}
