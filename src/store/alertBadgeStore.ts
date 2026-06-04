/**
 * Alert Badge Store — shared state for unacknowledged alert badge count.
 *
 * Why a separate store instead of a hook:
 * - Both the tab layout and the alerts index screen need access to badge state.
 * - `clearBadge()` in the index screen must affect the badge shown in the tab layout.
 * - Zustand provides a simple, shared store without React Context boilerplate.
 *
 * Delta semantics:
 * - The store tracks the latest unacknowledged count from the polling hook.
 * - `badgeCount = max(0, latestCount - baselineCount)` — delta since last visit.
 * - `clearBadge()` sets baseline to the latest known count, badge to 0.
 *
 * Pattern: Zustand Store
 * Why:
 * - The existing `useAuthStore` already establishes this pattern.
 * - No provider wrapper needed — direct import anywhere.
 */

import { create } from 'zustand';

interface AlertBadgeStoreState {
  /** Badge count to display on the Alerts tab icon (0 = hidden). */
  badgeCount: number;
  /** ISO timestamp of the last visit to the Alerts tab. */
  lastVisitedAt: string | null;
  /** Baseline count at the time of last clear. Used to compute delta. */
  baselineCount: number;
  /** Latest unacknowledged count from the polling hook. */
  latestCount: number;

  /**
   * Called by the polling hook on each poll result.
   * Computes `badgeCount = max(0, count - baseline)`.
   */
  updateBadge: (count: number) => void;
  /**
   * Called when the user navigates to the Alerts tab.
   * Stores the current count as baseline so only NEW events increment the badge.
   */
  clearBadge: () => void;
}

export const useAlertBadgeStore = create<AlertBadgeStoreState>((set, get) => ({
  badgeCount: 0,
  lastVisitedAt: null,
  baselineCount: 0,
  latestCount: 0,

  updateBadge: (count: number) => {
    const { baselineCount } = get();
    const delta = Math.max(0, count - baselineCount);
    set({ badgeCount: delta, latestCount: count });
  },

  clearBadge: () => {
    const { latestCount } = get();
    set({
      badgeCount: 0,
      baselineCount: latestCount,
      lastVisitedAt: new Date().toISOString(),
    });
  },
}));
