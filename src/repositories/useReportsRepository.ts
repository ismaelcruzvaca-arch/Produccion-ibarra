/**
 * Reports Repository Hook — encapsulates all CRUD operations on the reports collection.
 *
 * Pattern: Repository + Hook (Anti-Corruption Layer)
 * Why:
 * - UI components must NEVER interact with RxDB directly.
 * - A repository wraps RxDB collections and exposes a clean API:
 *     createReport(), update(), remove(), findById(), findAll(), docs$
 * - The hook form integrates with React's lifecycle and provides the database
 *   instance from Context.
 *
 * Observable pattern:
 * - docs$ is an RxJS Observable<RxDocument<IReport>[]> that emits
 *   the current list of non-deleted reports on every change.
 *
 * Soft delete:
 * - remove(id) does NOT purge the document.
 * - It sets deleted=true and updated_at=nowMs(), then syncs to server.
 */

import { useCallback, useMemo } from 'react';
import type { Observable } from 'rxjs';
import type { RxDocument } from 'rxdb';

import { generateUuid } from '../utils/uuid';
import { nowMs } from '../utils/timestamp';
import type { IReport, ReportData } from '../core/types';
import { useDatabase } from '../data/DatabaseContext';

export interface ReportsRepository {
  /** Emits the current list of non-deleted reports on every change. */
  docs$: Observable<RxDocument<IReport>[]>;

  /**
   * Creates a new report with auto-generated fields.
   * Sets id (UUID v4), updated_at, deleted=false, and template_id automatically.
   *
   * @param data - Report payload (line_id, total_pieces, rejected_pieces, downtime_minutes)
   * @param templateId - Optional template ID (defaults to 'oee-basic')
   * @returns Promise<RxDocument<IReport>> the newly created document
   */
  createReport: (data: ReportData, templateId?: string) => Promise<RxDocument<IReport>>;

  /**
   * Updates an existing report in place.
   * Sets updated_at to trigger sync.
   *
   * @param id - The report UUID
   * @param patch - Partial report fields to merge
   * @returns Promise<RxDocument<IReport> | null> the updated document, or null if not found
   */
  update: (
    id: string,
    patch: Partial<Omit<IReport, 'id'>>
  ) => Promise<RxDocument<IReport> | null>;

  /**
   * Soft-deletes a report (sets deleted=true, updated_at=now).
   *
   * @param id - The report UUID
   */
  remove: (id: string) => Promise<void>;

  /**
   * Finds a single report by UUID.
   *
   * @param id - The report UUID
   * @returns Promise<RxDocument<IReport> | null>
   */
  findById: (id: string) => Promise<RxDocument<IReport> | null>;

  /**
   * Returns all non-deleted reports (one-shot, not observable).
   *
   * @returns Promise<RxDocument<IReport>[]>
   */
  findAll: () => Promise<RxDocument<IReport>[]>;
}

/**
 * Derives the sync status of a single report from global replication state.
 *
 * Heuristic:
 * - If replication is in error state → failed
 * - If the report was modified after the last successful sync → pending
 * - Otherwise → synced
 */
export function getReportSyncStatus(
  report: IReport,
  globalSyncStatus: 'idle' | 'syncing' | 'error' | 'offline',
  lastSyncTimestamp: number | null
): 'synced' | 'pending' | 'failed' {
  if (globalSyncStatus === 'error') return 'failed';
  if (globalSyncStatus === 'offline') return 'failed';
  if (!lastSyncTimestamp) return 'pending';
  if (report.updated_at > lastSyncTimestamp) return 'pending';
  return 'synced';
}

export function useReportsRepository(): ReportsRepository {
  const db = useDatabase();

  const docs$: Observable<RxDocument<IReport>[]> = useMemo(
    () =>
      db.collections.reports
        .find({ selector: { is_deleted: { $eq: false } } })
        .$,
    [db]
  );

  const createReport = useCallback(
    async (data: ReportData, templateId = 'oee-basic') => {
      const newDoc: IReport = {
        id: generateUuid(),
        updated_at: nowMs(),
        is_deleted: false,
        template_id: templateId,
        data,
      };
      const result = await db.collections.reports.insert(newDoc);
      return result as RxDocument<IReport>;
    },
    [db]
  );

  const update = useCallback(
    async (id: string, patch: Partial<Omit<IReport, 'id'>>) => {
      const doc = await db.collections.reports.findOne(id).exec();
      if (!doc) return null;

      await doc.patch({
        ...patch,
        updated_at: nowMs(),
      });
      return doc as RxDocument<IReport>;
    },
    [db]
  );

  const remove = useCallback(
    async (id: string) => {
      const doc = await db.collections.reports.findOne(id).exec();
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
      const doc = await db.collections.reports.findOne(id).exec();
      return doc as RxDocument<IReport> | null;
    },
    [db]
  );

  const findAll = useCallback(async () => {
    const docs = await db.collections.reports
      .find({ selector: { is_deleted: { $eq: false } } })
      .exec();
    return docs as RxDocument<IReport>[];
  }, [db]);

  return useMemo(
    () => ({ docs$, createReport, update, remove, findById, findAll }),
    [docs$, createReport, update, remove, findById, findAll]
  );
}
