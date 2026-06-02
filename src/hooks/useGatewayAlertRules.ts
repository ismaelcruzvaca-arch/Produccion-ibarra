/**
 * useGatewayAlertRules — fetches alert rules scoped to a plant.
 *
 * Pattern: Zustand selector + useEffect auto-fetch + cache TTL
 * Why:
 * - Consistent with catalogStore pattern: reads from store, triggers fetch on mount
 * - Plant-scoped: plantId is required (RLS filter in Remote Schema)
 * - Returns { data, loading, error, refetch } per hook convention
 *
 * @param plantId — the plant UUID to scope the alert rules query
 * @returns { data, loading, error, refetch }
 *
 * @see tasks.md task 3.2
 * @see spec.md FQ-2 (Alert Rules Query)
 */

import { useEffect, useCallback } from 'react';
import { useGatewayStore, GATEWAY_CACHE_TTL_MS } from '../ui/store/gatewayStore';
import type { GatewayAlertRule } from '../graphql/gateway/types';

export function useGatewayAlertRules(plantId: string | undefined) {
  const alertRules = useGatewayStore((s) => s.alertRules);
  const fetchAlertRules = useGatewayStore((s) => s.fetchAlertRules);

  useEffect(() => {
    if (!plantId) return;
    const state = alertRules;
    const isStale = !state.fetchedAt || Date.now() - state.fetchedAt > GATEWAY_CACHE_TTL_MS;
    if (isStale && !state.loading) {
      fetchAlertRules(plantId);
    }
  }, [plantId, alertRules.fetchedAt, fetchAlertRules]);

  const refetch = useCallback(() => {
    if (!plantId) return;
    fetchAlertRules(plantId, true);
  }, [plantId, fetchAlertRules]);

  return {
    data: alertRules.data as GatewayAlertRule[],
    loading: alertRules.loading,
    error: alertRules.error,
    refetch,
  };
}
