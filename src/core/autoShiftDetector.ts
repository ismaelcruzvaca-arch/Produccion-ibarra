/**
 * useAutoShiftDetector — Foreground scheduler that evaluates the shift calendar
 * every 60 seconds and idempotently creates shift_sessions with operator_id=null.
 *
 * Pattern: Foreground Hook + Scheduler
 * Why:
 * - App-First approach: evaluates local RxDB data without server round-trip.
 * - Offline-first: works in low-connectivity environments.
 * - AppState listener pauses the timer when the app is in background (battery
 *   and performance optimization) and re-evaluates on foreground return.
 *
 * Lifecycle:
 * 1. On mount, register AppState listener and start 60s interval.
 * 2. Each tick: check auto_shift_enabled flag, evaluate calendar via
 *    getActiveSlot, create sessions idempotently.
 * 3. On unmount, clear interval and remove listener.
 *
 * Auto-close (AD-3) is deferred to P1 per design decision. The detector
 * only auto-creates sessions. Manual close via supervisor remains available.
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
        if (!activeSlot) continue;

        // 5. Find active machines for this line (first one without session)
        const machines = getMachinesByLine(line.id).filter((m) => m.is_active);
        if (machines.length === 0) continue;

        // Try to find a machine without an active session
        for (const machine of machines) {
          const existingSession = await shiftSessionsRef.current.findActiveByMachine(machine.id);
          if (!existingSession) {
            // 6. Idempotent creation — no active session for this machine
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

            // Create one session per line per tick — move to next line
            break;
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
function timeFromHHmm(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  const now = new Date();
  now.setHours(hours, minutes, 0, 0);
  return now.getTime();
}

/**
 * Computes the session start time. If the slot start_time is in the past
 * (e.g., the scheduler started late), uses the slot start time anyway
 * (historical accuracy). If it's somehow in the future, clips to now.
 */
function computeStartTime(slotStart: number): number {
  const now = Date.now();
  return slotStart <= now ? slotStart : now;
}
