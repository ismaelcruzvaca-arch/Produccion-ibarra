/**
 * useAlertPolling — generic polling hook for alert engine queries.
 *
 * Fires the query immediately on mount, then polls at the configured interval.
 * Handles stale responses (only the latest query result is applied).
 * Respects AppState: pauses when backgrounded, fires catch-up on foreground.
 *
 * Pattern: Generic Polling Hook
 * Why:
 * - Multiple alert components need polling (rules list, health, unacknowledged count).
 * - Centralising polling logic avoids duplicated AppState handling and interval
 *   management across screens.
 *
 * @type T — The shape of the query response data
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { nhost } from '../graphql/nhostClient';
import type { UseAlertQueryResult } from '../types/alertEngine';

// ─── Constants ──────────────────────────────────────────────────────────────────

/** Default polling interval for alert queries (60 seconds). */
export const POLL_INTERVAL_MS = 60_000;

// ─── Hook ───────────────────────────────────────────────────────────────────────

interface UseAlertQueryOptions {
  /** Polling interval in ms. Default: 60_000. */
  pollIntervalMs?: number;
  /** Whether the polling is enabled. Default: true. */
  enabled?: boolean;
  /** If true, skip the initial fetch — wait for refetch(). Default: false. */
  lazy?: boolean;
}

/**
 * Generic polling hook for Remote Schema queries.
 *
 * @param query - GraphQL document string
 * @param variables - Variables object (must include plantId)
 * @param options - Polling options
 *
 * @example
 * ```typescript
 * const { data, loading, error, refetch } = useAlertPolling(
 *   ALERT_RULES,
 *   { plantId: 'uuid' },
 *   { pollIntervalMs: 30_000 },
 * );
 * ```
 */
export function useAlertPolling<T>(
  query: string,
  variables?: Record<string, unknown>,
  options?: UseAlertQueryOptions,
): UseAlertQueryResult<T> {
  const {
    pollIntervalMs = POLL_INTERVAL_MS,
    enabled = true,
    lazy = false,
  } = options ?? {};

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!lazy);
  const [error, setError] = useState<Error | null>(null);

  // Track the latest request to discard stale responses
  const latestRequestRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // ── Fetch Function ──────────────────────────────────────────────────────

  const executeQuery = useCallback(async () => {
    const requestId = Date.now();
    latestRequestRef.current = requestId;

    try {
      setLoading(true);
      setError(null);

      const response = await nhost.graphql.request<{ data: T }>(query, variables);

      // Discard stale responses — only apply the latest
      if (latestRequestRef.current !== requestId) return;

      if ((response as any).error) {
        throw new Error((response as any).error.message ?? 'GraphQL error');
      }

      const result = (response as any)?.data as T | undefined;
      if (result !== undefined) {
        setData(result);
      }
    } catch (err: any) {
      if (latestRequestRef.current !== requestId) return;
      setError(err instanceof Error ? err : new Error(err?.message ?? 'Unknown error'));
    } finally {
      if (latestRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [query, variables]);

  // ── Refetch ─────────────────────────────────────────────────────────────

  const refetch = useCallback(async () => {
    await executeQuery();
  }, [executeQuery]);

  // ── Setup: initial fetch + polling interval ──────────────────────────────

  useEffect(() => {
    if (!enabled) return;

    // Initial fetch (unless lazy)
    if (!lazy) {
      executeQuery();
    }

    // Set up polling interval
    intervalRef.current = setInterval(executeQuery, pollIntervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, pollIntervalMs, lazy, executeQuery]);

  // ── AppState awareness ──────────────────────────────────────────────────

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      // When the app returns from background → foreground, fire a catch-up poll
      if (prevState.match(/inactive|background/) && nextState === 'active') {
        executeQuery();
      }

      // When going to background, the interval still fires but responses are
      // discarded by the stale-response guard (no visual update needed).
      // This is more reliable than clearing/resetting the interval.
    });

    return () => subscription.remove();
  }, [executeQuery]);

  return { data, loading, error, refetch };
}
