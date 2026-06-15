/**
 * useAutoShiftDetector — Foreground scheduler that evaluates the shift calendar
 * every 60 seconds: creates sessions when a slot starts, closes them when it ends.
 *
 * Pattern: Foreground Hook + Scheduler
 * Why:
 * - App-First approach: evaluates local RxDB data without server round-trip.
 * - Offline-first: works in low-connectivity environments.
 * - AppState listener pauses the timer when the app is in background (battery
 *   and performance optimization) and re-evaluates on foreground return.
 *
 * Lifecycle:
 * 1. On mount, cleanup orphaned sessions (>24h active without calendar slot).
 * 2. Register AppState listener and start 60s interval.
 * 3. Each tick:
 *    a. Check auto_shift_enabled flag.
 *    b. For each line: if active slot → CREATE session idempotently.
 *    c. For each line: if NO active slot → CLOSE any active session.
 * 4. On unmount, clear interval and remove listener.
 *
 * Stale calendar data (>24h since last sync) produces a persistent warning.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useShiftSessionsRepository } from '../repositories/useShiftSessionsRepository';
import { useShiftCalendarRepository } from '../repositories/useShiftCalendarRepository';
import { usePlantConfigRepository, AUTO_SHIFT_KEY } from '../repositories/usePlantConfigRepository';
import { useCatalogStore } from '../ui/store/catalogStore';
import { nowMs } from '../utils/timestamp';

// ─── Constants ──────────────────────────────────────────────────────────────────

/** Interval between calendar evaluations in milliseconds (60 seconds). */
const TICK_INTERVAL_MS = 60_000;

/** Threshold for stale calendar data warning in milliseconds (24 hours). */
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1_000;

// ─── Hook Return Type ───────────────────────────────────────────────────────────

export interface AutoShiftDetectorState {
  /**
   * Non-null when calendar data is older than 24h.
   * Null when data is fresh or no data exists.
   */
  staleWarning: string | null;

  /** Whether the detector interval is currently active. */
  isRunning: boolean;
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

export function useAutoShiftDetector(): AutoShiftDetectorState {
  const [staleWarning, setStaleWarning] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // Repositories (stable across renders via hooks)
  const shiftSessionsRepo = useShiftSessionsRepository();
  const calendarRepo = useShiftCalendarRepository();
  const plantConfigRepo = usePlantConfigRepository();

  // Refs to avoid stale closures in the interval callback
  const shiftSessionsRef = useRef(shiftSessionsRepo);
  shiftSessionsRef.current = shiftSessionsRepo;

  const calendarRef = useRef(calendarRepo);
  calendarRef.current = calendarRepo;

  const plantConfigRef = useRef(plantConfigRepo);
  plantConfigRef.current = plantConfigRepo;

  // Interval ID ref for clean management
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // ── Core Evaluation ─────────────────────────────────────────────────────────

  const evaluate = useCallback(async () => {
    try {
      // 1. Check feature flag
      const enabled = await plantConfigRef.current.getAutoShiftEnabled();
      if (!enabled) {
        setIsRunning(false);
        return;
      }

      setIsRunning(true);

      // 2. Check stale calendar data
      await checkStaleData(calendarRef, setStaleWarning);

      // 3. Get all active lines from catalog
      const lines = useCatalogStore.getState().getLines();
      const getMachinesByLine = useCatalogStore.getState().getMachinesByLine;

      for (const line of lines) {
        // 4. Resolve active slot for this line
        const activeSlot = await calendarRef.current.getActiveSlot(line.id, nowMs());

        if (activeSlot) {
          // ── SLOT ACTIVO → crear sesión si no existe ──────────────────────
          const machines = getMachinesByLine(line.id).filter((m) => m.is_active);
          if (machines.length === 0) continue;

          for (const machine of machines) {
            const existingSession = await shiftSessionsRef.current.findActiveByMachine(machine.id);
            if (!existingSession) {
              const slotStart = timeFromHHmm(activeSlot.start_time);
              const startedAt = computeStartTime(slotStart);

              await shiftSessionsRef.current.create({
                machine_id: machine.id,
                shift_type: activeSlot.shift_type,
                started_at: startedAt,
                status: 'active',
                created_at: nowMs(),
                // operator_id intentionally null — operator assigns post-creation (SS-2)
              });
              break; // one session per line per tick
            }
          }
        } else {
          // ── SIN SLOT ACTIVO → cerrar sesiones huérfanas de esta línea ────
          const machines = getMachinesByLine(line.id).filter((m) => m.is_active);
          for (const machine of machines) {
            const activeSession = await shiftSessionsRef.current.findActiveByMachine(machine.id);
            if (activeSession && activeSession.get('status') === 'active') {
              // Only auto-close sessions created by the scheduler (no operator assigned)
              // Sessions with operator assigned should be closed manually by the supervisor
              const operatorId = activeSession.get('operator_id') as string | null | undefined;
              if (!operatorId) {
                await shiftSessionsRef.current.update(activeSession.get('id'), {
                  status: 'closed',
                  updated_at: nowMs(),
                });
              }
            }
          }
        }
      }
    } catch (err) {
      // Non-blocking — scheduler errors shouldn't crash the app
      console.warn('[autoShiftDetector] Evaluation error:', err);
    }
  }, []);

  // ── Lifecycle: Interval + AppState ──────────────────────────────────────────

  useEffect(() => {
    // ── Cleanup orphaned sessions on mount ─────────────────────────────────
    // Sessions that were created before auto-close existed and have been
    // "active" for >24h with no operator assigned → close them.
    (async () => {
      try {
        const allSessions = await shiftSessionsRepo.findByStatus('active');
        const now = nowMs();
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1_000;

        for (const doc of allSessions) {
          const startedAt = doc.get('started_at') as number;
          const operatorId = doc.get('operator_id') as string | null | undefined;
          const age = now - startedAt;

          if (age > TWENTY_FOUR_HOURS && !operatorId) {
            await shiftSessionsRepo.update(doc.get('id'), {
              status: 'closed',
              updated_at: now,
            });
          }
        }
      } catch {
        // Non-critical — cleanup is best-effort
      }
    })();

    // Initial evaluation (don't wait 60s for first tick)
    evaluate();

    // Start the 60s interval
    intervalRef.current = setInterval(evaluate, TICK_INTERVAL_MS);

    // AppState listener: pause interval when backgrounded
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      // Re-evaluate immediately when returning to foreground
      if (prevState.match(/inactive|background/) && nextState === 'active') {
        evaluate();
      }
    });

    // Cleanup on unmount
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      subscription.remove();
    };
  }, [evaluate]);

  return { staleWarning, isRunning };
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Checks whether the most recent calendar document (slot or exception) was
 * updated within the last 24 hours. If not, sets the stale warning state.
 */
async function checkStaleData(
  calendarRef: React.MutableRefObject<ReturnType<typeof useShiftCalendarRepository>>,
  setStaleWarning: (msg: string | null) => void,
): Promise<void> {
  try {
    const [slots, exceptions] = await Promise.all([
      calendarRef.current.findAllSlots(),
      calendarRef.current.findAllExceptions(),
    ]);

    // Find the latest updated_at across all calendar docs
    let latestUpdate = 0;
    for (const slot of slots) {
      const ts = slot.get('updated_at') as number;
      if (ts > latestUpdate) latestUpdate = ts;
    }
    for (const exc of exceptions) {
      const ts = exc.get('updated_at') as number;
      if (ts > latestUpdate) latestUpdate = ts;
    }

    // If no calendar data exists, no warning needed
    if (latestUpdate === 0) {
      setStaleWarning(null);
      return;
    }

    const age = nowMs() - latestUpdate;
    if (age > STALE_THRESHOLD_MS) {
      setStaleWarning('Calendario no actualizado desde hace más de 24h');
    } else {
      setStaleWarning(null);
    }
  } catch {
    // Silently fail — stale check is non-critical
    setStaleWarning(null);
  }
}

/**
 * Converts a "HH:mm" string to epoch milliseconds for the current date.
 * Used to compute the started_at timestamp for auto-created sessions.
 */
import { timeFromHHmm, computeStartTime, isStaleData } from './shiftTimeUtils';
export { timeFromHHmm, computeStartTime, isStaleData };
