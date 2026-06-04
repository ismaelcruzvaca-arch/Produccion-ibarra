/**
 * useAlertBadge — feeds the shared alert badge store with polled counts.
 *
 * The hook polls the unacknowledged count via `useUnacknowledgedCount` and
 * pushes results into `useAlertBadgeStore.updateBadge()`. The store handles
 * delta computation against the baseline (last clear).
 *
 * Mount this ONCE — in the tab layout. The alerts index screen accesses
 * `clearBadge()` directly from the store.
 *
 * Pattern: Data Feeder Hook
 * Why:
 * - Separates concerns: polling (hook) vs. state (store).
 * - The store's delta semantics, baseline tracking, and clearBadge() are
 *   decoupled from the polling mechanism.
 * - Both tab layout and index screen share the store — clearBadge() in the
 *   index immediately impacts the badge shown in the tab layout.
 */

import { useEffect, useRef } from 'react';
import { useUnacknowledgedCount } from './useUnacknowledgedCount';
import { useAlertBadgeStore } from '../store/alertBadgeStore';

/**
 * Polls the unacknowledged event count and updates the shared badge store.
 * Call ONCE from the tab layout.
 */
export function useAlertBadge(): void {
  const count = useUnacknowledgedCount().count;
  const updateBadge = useAlertBadgeStore((s) => s.updateBadge);
  // Start at -1 so the first real count (0) triggers an update
  const prevCountRef = useRef(-1);

  useEffect(() => {
    // Only push to store when the count actually changes
    if (count !== prevCountRef.current) {
      prevCountRef.current = count;
      updateBadge(count);
    }
  }, [count, updateBadge]);
}
