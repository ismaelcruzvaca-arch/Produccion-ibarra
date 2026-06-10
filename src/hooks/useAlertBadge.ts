/**
 * useAlertBadge — feeds the shared alert badge store with polled counts.
 *
 * The hook polls the unacknowledged count via `useUnacknowledgedCount` and
 * pushes results into `useAlertBadgeStore.updateBadge()`. The store handles
 * delta computation against the baseline (last clear).
 *
 * Operator scoping (F-AC-43):
 * - For non-supervisor roles, the badge count is scoped to the operator's
 *   current machine (from catalogStore.selectedMachine), so operators only
 *   see alerts relevant to their assigned line/machine.
 * - Supervisors/admins see the plant-wide count.
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
import { useAuthStore } from '../auth/useAuthStore';
import { useCatalogStore } from '../ui/store/catalogStore';
import { useUnacknowledgedCount } from './useUnacknowledgedCount';
import { useAlertBadgeStore } from '../store/alertBadgeStore';

/**
 * Polls the unacknowledged event count and updates the shared badge store.
 * Call ONCE from the tab layout.
 *
 * For operators, scopes the badge to the currently selected machine.
 * For supervisors/admins, shows the plant-wide count.
 */
export function useAlertBadge(): void {
  const role = useAuthStore((s) => s.role);
  const selectedMachine = useCatalogStore((s) => s.selectedMachine);

  // Only scope when there IS a machine selected AND role is operator
  const isOperator = role === 'operator';
  const machineId = isOperator && selectedMachine ? selectedMachine : undefined;

  const count = useUnacknowledgedCount(machineId).count;
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
