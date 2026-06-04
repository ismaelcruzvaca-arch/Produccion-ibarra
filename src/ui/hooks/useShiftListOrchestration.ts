/**
 * useShiftListOrchestration — Reactive list of all shift sessions, split by status.
 *
 * Pattern: Hook Extraction (Container/Presentational)
 * Why:
 * - Subscribes to shiftSessionsRepo.docs$ for real-time updates.
 * - Splits sessions into activeShift (first active, newest first) and
 *   closedShifts (sorted by ended_at DESC).
 * - Post-reconciliation: uses started_at/ended_at instead of start_timestamp/end_timestamp.
 *
 * Returns:
 * - loading: boolean — initial load state
 * - activeShift: IShiftSession | null — most recently started active shift
 * - closedShifts: IShiftSession[] — closed shifts sorted DESC by ended_at
 * - refresh: () => void — triggers loading state reset
 */

import { useState, useEffect } from 'react';

import { useShiftSessionsRepository } from '../../repositories/useShiftSessionsRepository';
import type { IShiftSession } from '../../core/types';

export function useShiftListOrchestration() {
  const shiftSessionsRepo = useShiftSessionsRepository();

  // ─── Data state ─────────────────────────────────────────────────────────────
  const [allSessions, setAllSessions] = useState<IShiftSession[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── Subscribe to all sessions ──────────────────────────────────────────────
  const { docs$ } = shiftSessionsRepo;

  useEffect(() => {
    const subscription = docs$.subscribe((docs) => {
      const raw = docs.map((doc) => doc.toJSON() as IShiftSession);
      setAllSessions(raw);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [docs$]);

  // ─── Split active / closed ──────────────────────────────────────────────────
  const activeShifts = allSessions
    .filter((s) => s.status === 'active')
    .sort((a, b) => b.started_at - a.started_at);

  const activeShift: IShiftSession | null =
    activeShifts.length > 0 ? activeShifts[0] : null;

  const closedShifts = allSessions
    .filter((s) => s.status === 'closed')
    .sort((a, b) => (b.ended_at ?? 0) - (a.ended_at ?? 0));

  // ─── Refresh ────────────────────────────────────────────────────────────────
  const refresh = () => {
    setLoading(true);
    // docs$ subscription emits on next change; use short timeout as fallback
    setTimeout(() => setLoading(false), 500);
  };

  return {
    loading,
    activeShift,
    closedShifts,
    refresh,
  } as const;
}
