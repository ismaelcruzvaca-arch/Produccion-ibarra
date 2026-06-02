/**
 * useGatewayHealth — fetches alert engine health status.
 *
 * Pattern: Zustand selector + useEffect auto-fetch + cache TTL
 * Why:
 * - No params needed (single health record from GET_ENGINE_HEALTH)
 * - Returns engine status: latency, success, detail
 * - Returns { data, loading, error, refetch }
 *
 * @returns { data: GatewayEngineHealth | null, loading, error, refetch }
 *
 * @see tasks.md task 3.5
 */

import { useEffect, useCallback } from 'react';
import { useGatewayStore, GATEWAY_CACHE_TTL_MS } from '../ui/store/gatewayStore';
import type { GatewayEngineHealth } from '../graphql/gateway/types';

export function useGatewayHealth() {
  const engineHealth = useGatewayStore((s) => s.engineHealth);
  const fetchEngineHealth = useGatewayStore((s) => s.fetchEngineHealth);

  useEffect(() => {
    const isStale =
      !engineHealth.fetchedAt ||
      Date.now() - engineHealth.fetchedAt > GATEWAY_CACHE_TTL_MS;
    if (isStale && !engineHealth.loading) {
      fetchEngineHealth();
    }
  }, [engineHealth.fetchedAt, fetchEngineHealth]);

  const refetch = useCallback(() => {
    fetchEngineHealth(true);
  }, [fetchEngineHealth]);

  return {
    data: engineHealth.data as GatewayEngineHealth | null,
    loading: engineHealth.loading,
    error: engineHealth.error,
    refetch,
  };
}
