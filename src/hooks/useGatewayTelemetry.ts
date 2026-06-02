/**
 * useGatewayTelemetry — fetches telemetry records for a specific IoT node.
 *
 * Pattern: Zustand selector + useEffect auto-fetch + cache TTL
 * Why:
 * - Telemetry is per-node; each node's data is cached independently
 * - Supports custom limit for pagination (default 50)
 * - Returns { data, loading, error, refetch }
 *
 * Note: Current query does not support date-range filtering (from/to).
 * The hook accepts only (nodeId, limit?) matching the actual query API.
 *
 * @param nodeId — the IoT node identifier
 * @param limit — max records to fetch (default 50)
 * @returns { data, loading, error, refetch }
 *
 * @see tasks.md task 3.4
 * @see spec.md FQ-4 (Telemetry Query)
 */

import { useEffect, useCallback } from 'react';
import { useGatewayStore, GATEWAY_CACHE_TTL_MS } from '../ui/store/gatewayStore';
import type { GatewayTelemetry } from '../graphql/gateway/types';

export function useGatewayTelemetry(nodeId: string | undefined, limit: number = 50) {
  const telemetryByNodeId = useGatewayStore((s) => s.telemetry);
  const fetchTelemetry = useGatewayStore((s) => s.fetchTelemetry);

  const domain = nodeId ? telemetryByNodeId[nodeId] : undefined;

  useEffect(() => {
    if (!nodeId) return;
    const state = domain ?? { data: [], loading: false, error: null, fetchedAt: null };
    const isStale = !state.fetchedAt || Date.now() - state.fetchedAt > GATEWAY_CACHE_TTL_MS;
    if (isStale && !state.loading) {
      fetchTelemetry(nodeId, limit);
    }
  }, [nodeId, limit, domain?.fetchedAt, fetchTelemetry]);

  const refetch = useCallback(() => {
    if (!nodeId) return;
    fetchTelemetry(nodeId, limit, true);
  }, [nodeId, limit, fetchTelemetry]);

  return {
    data: (domain?.data ?? []) as GatewayTelemetry[],
    loading: domain?.loading ?? false,
    error: domain?.error ?? null,
    refetch,
  };
}
