/**
 * useShiftDetailOrchestration — Loads full detail for a single shift session.
 *
 * Pattern: Hook Extraction (Container/Presentational)
 * Why:
 * - Post-reconciliation: loads session by ID, OEE events by machine_id + time range,
 *   quality inspections also by machine_id.
 * - Computes OEE metrics from the events.
 * - No more shift_id FK — matching is done via machine_id + time window.
 *
 * Returns:
 * - session: IShiftSession | null — the shift session
 * - oeeEvents: IOeeEvent[] — OEE events within this shift's time window
 * - qualityInspections: IQualityInspection[] — quality checks during this shift
 * - loading: boolean
 * - oeeMetrics: OeeMetrics | null — computed OEE metrics from events
 */

import { useState, useEffect, useMemo } from 'react';

import { useShiftSessionsRepository } from '../../repositories/useShiftSessionsRepository';
import { useOeeEventsRepository } from '../../repositories/useOeeEventsRepository';
import { useQualityInspectionsRepository } from '../../repositories/useQualityInspectionsRepository';
import { useDatabase } from '../../data/DatabaseContext';
import { computeOee, type OeeMetrics } from '../../core/oeeCalculator';
import { DEFAULT_PPM } from '../../config/catalogs';
import type { IShiftSession, IOeeEvent, IQualityInspection } from '../../core/types';

export function useShiftDetailOrchestration(sessionId: string) {
  const db = useDatabase();
  const shiftSessionsRepo = useShiftSessionsRepository();
  const oeeEventsRepo = useOeeEventsRepository();
  const qualityInspectionsRepo = useQualityInspectionsRepository();

  // ─── Data state ─────────────────────────────────────────────────────────────
  const [session, setSession] = useState<IShiftSession | null>(null);
  const [oeeEvents, setOeeEvents] = useState<IOeeEvent[]>([]);
  const [qualityInspections, setQualityInspections] = useState<
    IQualityInspection[]
  >([]);
  const [loading, setLoading] = useState(true);

  // ─── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        // 1. Load session
        const sessionDoc = await shiftSessionsRepo.findById(sessionId);
        if (!isMounted) return;

        if (!sessionDoc) {
          setLoading(false);
          return;
        }

        const sessionData = sessionDoc.toJSON() as IShiftSession;
        setSession(sessionData);

        // 2. Load OEE events within shift time window using machine_id
        const allEvents = await db.collections.oee_events
          .find({
            selector: {
              machine_id: { $eq: sessionData.machine_id },
              is_deleted: { $eq: false },
              timestamp: {
                $gte: sessionData.started_at,
                ...(sessionData.ended_at ? { $lte: sessionData.ended_at } : {}),
              },
            },
          })
          .exec();

        if (isMounted) {
          setOeeEvents(allEvents.map((d) => d.toJSON() as IOeeEvent));
        }

        // 3. Load quality inspections by machine_id within time window
        const qualityDocs = await qualityInspectionsRepo.findByMachine(
          sessionData.machine_id,
        );
        if (isMounted) {
          const filteredQuality = qualityDocs
            .map((d) => d.toJSON() as IQualityInspection)
            .filter((i) => i.updated_at >= sessionData.started_at)
            .filter((i) =>
              sessionData.ended_at
                ? i.updated_at <= sessionData.ended_at
                : true,
            );
          setQualityInspections(filteredQuality);
        }
      } catch (e: any) {
        console.error(
          '[useShiftDetailOrchestration] Error loading shift detail:',
          e,
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [sessionId, shiftSessionsRepo, oeeEventsRepo, qualityInspectionsRepo, db]);

  // ─── Compute OEE metrics ────────────────────────────────────────────────────
  const oeeMetrics: OeeMetrics | null = useMemo(() => {
    if (oeeEvents.length === 0) return null;
    return computeOee(oeeEvents, DEFAULT_PPM);
  }, [oeeEvents]);

  return {
    session,
    oeeEvents,
    qualityInspections,
    loading,
    oeeMetrics,
  } as const;
}
