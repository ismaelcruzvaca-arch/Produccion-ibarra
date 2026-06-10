/**
 * useUnacknowledgedCount — polls the alert engine for unacknowledged event count.
 *
 * Used by the tab badge (via useAlertBadge) and the snackbar component.
 * Pauses polling when the app is backgrounded; fires a catch-up poll on return.
 * The first poll after mount (or login) sets `lastCheckedAt` to now — no snackbar
 * storm on initial load.
 *
 * Operator scoping (F-AC-43):
 * - When `machineId` is provided, the hook resolves it to a gateway node and
 *   scopes the count to only events for that node.
 * - This ensures operators only see alerts for their current machine.
 * - If resolution fails or no machine is provided, falls back to plant-wide count.
 *
 * Pattern: Specialized Polling Hook
 * Why:
 * - The unacknowledged count is consumed by both the badge and snackbar.
 * - Encapsulating it in a single hook ensures state consistency.
 * - The "first poll is silent" logic is handled once here.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  fetchUnacknowledgedCount,
  getPlantId,
  resolveMachineNameToNodeId,
} from '../services/alertEngine';
import { useCatalogStore } from '../ui/store/catalogStore';

export const POLL_INTERVAL_MS = 60_000;

export interface UnacknowledgedCountState {
  /** Current count of unacknowledged events. */
  count: number;
  /** Whether the initial fetch is still in progress. */
  loading: boolean;
  /** ISO timestamp of the last successful poll. */
  lastCheckedAt: string | null;
  /** Error from the last failed poll (logged, not surfaced to user). */
  error: Error | null;
  /** Manually trigger a poll. */
  refresh: () => Promise<void>;
}

/**
 * Continuously polls the unacknowledged event count at the configured interval.
 *
 * The first poll on mount sets `lastCheckedAt` to now without triggering any
 * snackbar — preventing an initial flood of notifications.
 *
 * @param machineId - Optional machine ID to scope alerts to. When provided,
 *  the hook resolves the machine name to a gateway node ID and filters
 *  the count to only events for that node.
 */
export function useUnacknowledgedCount(machineId?: string): UnacknowledgedCountState {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [resolvedNodeId, setResolvedNodeId] = useState<string | undefined>(undefined);

  const isFirstPollRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const machineIdRef = useRef<string | undefined>(undefined);

  // Resolve machineId to node ID when machine changes
  const getMachineById = useCatalogStore((s) => s.getMachineById);

  useEffect(() => {
    if (!machineId) {
      setResolvedNodeId(undefined);
      machineIdRef.current = undefined;
      return;
    }

    // Only re-resolve if machineId changed
    if (machineId === machineIdRef.current) return;
    machineIdRef.current = machineId;

    const machine = getMachineById(machineId);
    if (machine?.name) {
      resolveMachineNameToNodeId(machine.name).then((nodeId) => {
        setResolvedNodeId(nodeId);
      });
    }
  }, [machineId, getMachineById]);

  const poll = useCallback(async () => {
    try {
      const plantId = getPlantId();
      if (!plantId) {
        setCount(0);
        setLoading(false);
        return;
      }

      const currentCount = await fetchUnacknowledgedCount(plantId, resolvedNodeId);

      // First poll after mount/login: set lastCheckedAt to now, don't update count
      // This prevents an initial snackbar storm of all historical events.
      if (isFirstPollRef.current) {
        isFirstPollRef.current = false;
        setLastCheckedAt(new Date().toISOString());
        setCount(0); // Don't show badge for historical events on first run
      } else {
        setCount(currentCount);
      }

      setLastCheckedAt(new Date().toISOString());
      setError(null);
    } catch (err: any) {
      // Silent log — polling errors must never crash the app or show visible errors
      console.warn('[useUnacknowledgedCount] Poll failed:', err?.message ?? err);
      setError(err instanceof Error ? err : new Error(err?.message ?? 'Poll failed'));
    } finally {
      setLoading(false);
    }
  }, [resolvedNodeId]);

  // ── Setup: initial poll + interval ──────────────────────────────────────

  useEffect(() => {
    poll();

    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [poll]);

  // ── AppState: pause on background, catch-up on foreground ───────────────

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (prevState.match(/inactive|background/) && nextState === 'active') {
        poll();
      }
    });

    return () => subscription.remove();
  }, [poll]);

  return {
    count,
    loading,
    lastCheckedAt,
    error,
    refresh: poll,
  };
}
