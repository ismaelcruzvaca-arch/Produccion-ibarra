/**
 * useGatewayNodes — fetches IoT node catalog scoped to a plant.
 *
 * Pattern: Zustand selector + useEffect auto-fetch + cache TTL
 * Why:
 * - Same pattern as useGatewayAlertRules — thin hook over gatewayStore
 * - Plant-scoped: returns all nodes belonging to machines in the plant
 * - Returns { data, loading, error, refetch }
 *
 * @param plantId — the plant UUID to scope the node catalog
 * @returns { data, loading, error, refetch }
 *
 * @see tasks.md task 3.3
 * @see spec.md FQ-3 (Node Catalog Query)
 */

import { useEffect, useCallback } from 'react';
import { useGatewayStore, GATEWAY_CACHE_TTL_MS } from '../ui/store/gatewayStore';
import type { GatewayNode } from '../graphql/gateway/types';

export function useGatewayNodes(plantId: string | undefined) {
  const nodes = useGatewayStore((s) => s.nodes);
  const fetchNodes = useGatewayStore((s) => s.fetchNodes);

  useEffect(() => {
    if (!plantId) return;
    const isStale = !nodes.fetchedAt || Date.now() - nodes.fetchedAt > GATEWAY_CACHE_TTL_MS;
    if (isStale && !nodes.loading) {
      fetchNodes(plantId);
    }
  }, [plantId, nodes.fetchedAt, fetchNodes]);

  const refetch = useCallback(() => {
    if (!plantId) return;
    fetchNodes(plantId, true);
  }, [plantId, fetchNodes]);

  return {
    data: nodes.data as GatewayNode[],
    loading: nodes.loading,
    error: nodes.error,
    refetch,
  };
}
