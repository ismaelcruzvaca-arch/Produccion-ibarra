/**
 * Pure utility functions for shift time calculations.
 * Extracted from autoShiftDetector.ts to be testable without RxDB dependencies.
 */

/** Threshold for stale calendar data warning in milliseconds (24 hours). */
export const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1_000;

/**
 * Converts a "HH:mm" string to epoch milliseconds for a given date.
 * If `now` is provided, uses that as the base date; otherwise uses current time.
 */
export function timeFromHHmm(hhmm: string, now?: number): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  const d = now ? new Date(now) : new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.getTime();
}

/**
 * Computes the session start time. If the slot start_time is in the past
 * (e.g., the scheduler started late), uses the slot start time anyway
 * (historical accuracy). If it's somehow in the future, clips to now.
 */
export function computeStartTime(slotStart: number): number {
  const now = Date.now();
  return slotStart <= now ? slotStart : now;
}

/**
 * Checks if the latest calendar update timestamp is stale (>24h old).
 * Returns a warning string if stale, null if fresh or no data.
 */
export function isStaleData(
  latestUpdate: number,
  now: number,
): string | null {
  if (latestUpdate === 0) return null;
  const age = now - latestUpdate;
  if (age > STALE_THRESHOLD_MS) {
    return 'Calendario no actualizado desde hace más de 24h';
  }
  return null;
}
