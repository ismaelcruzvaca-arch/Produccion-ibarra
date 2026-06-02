/**
 * useGatewayAlertEvents — fetches alert event history scoped to a plant.
 *
 * Pattern: Zustand selector + useEffect auto-fetch + cache TTL
 * Why:
 * - Plant-scoped alert event history for monitoring dashboards
 * - Optional limit param for pagination (default 50)
 * - Returns { data, loading, error, refetch }
 *
 * @param plantId — the plant UUID to scope events
 * @param limit — max records to fetch (default 50)
 * @returns { data, loading, error, refetch }
 *
 * @see tasks.md task 3.6
 */

import { useEffect, useCallback } from 'react';
import { useGatewayStore, GATEWAY_CACHE_TTL_MS } from '../ui/store/gatewayStore';
import type { GatewayAlertEvent } from '../graphql/gateway/types';

export function useGatewayAlertEvents(plantId: string | undefined, limit: number = 50) {
  const alertEvents = useGatewayStore((s) => s.alertEvents);
  const fetchAlertEvents = useGatewayStore((s) => s.fetchAlertEvents);

  useEffect(() => {
    if (!plantId) return;
    const isStale =
      !alertEvents.fetchedAt ||
      Date.now() - alertEvents.fetchedAt > GATEWAY_CACHE_TTL_MS;
    if (isStale && !alertEvents.loading) {
      fetchAlertEvents(plantId, limit);
    }
  }, [plantId, limit, alertEvents.fetchedAt, fetchAlertEvents]);

  const refetch = useCallback(() => {
    if (!plantId) return;
    fetchAlertEvents(plantId, limit, true);
  }, [plantId, limit, fetchAlertEvents]);

  return {
    data: alertEvents.data as GatewayAlertEvent[],
    loading: alertEvents.loading,
    error: alertEvents.error,
    refetch,
  };
}
