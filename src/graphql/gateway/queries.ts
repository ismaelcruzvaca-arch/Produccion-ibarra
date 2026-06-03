/**
 * Typed GraphQL query documents and fetch helpers for the IoT Gateway Remote Schema.
 *
 * Pattern: Query Constants + Async Fetch Functions
 * Why:
 * - Query strings are defined as constants (template literals) for reuse by both
 *   direct fetch calls and Zustand store actions — same pattern as catalogStore.ts.
 * - Async fetch functions wrap nhost.graphql.request() with typed response parsing
 *   and error handling.
 * - The 5 gateway table queries no longer use the `gateway_` prefix — tables are accessed directly by name.
 *
 * Usage:
 *   // Direct call (in a hook or store action):
 *   const rules = await fetchAlertRules(plantId);
 *
 *   // Reuse query string for custom needs:
 *   const res = await nhost.graphql.request(GET_ALERT_RULES, { plantId });
 *
 * @see design.md for the query contract
 */

import { nhost } from '../nhostClient';
import { withTimeout } from '../withTimeout';
import type {
  GatewayAlertRule,
  GatewayNode,
  GatewayTelemetry,
  GatewayAlertEvent,
  GatewayEngineHealth,
} from './types';

// ─── Query Constants ───────────────────────────────────────────────────────────

/** Fetch alert rules scoped to a plant. RLS applies x-hasura-plant-id automatically. */
export const GET_ALERT_RULES = `
  query GetAlertRules($plantId: uuid!) {
    alert_rules(
      where: { plant_id: { _eq: $plantId }, scope: { _eq: "USER_DEFINED" } }
      order_by: { created_at: desc }
    ) {
      id
      node_id
      plant_id
      scope
      tipo_condicion
      valor_umbral
      canales
      cooldown_minutos
      last_alerted_at
      enabled
      created_at
    }
  }
` as const;

/** Fetch node catalog with device model capabilities, scoped to a plant. */
export const GET_NODES = `
  query GetNodes($plantId: uuid!) {
    nodes(
      where: { machine: { line: { plant_id: { _eq: $plantId } } } }
      order_by: { node_ident: asc }
    ) {
      id
      node_ident
      machine_id
      device_model_id
      device_model {
        model_name
        model_capabilities {
          alert_capability {
            capability_key
            description
          }
        }
      }
      machine {
        name
        line {
          name
          plant_id
        }
      }
    }
  }
` as const;

/** Fetch telemetry records for a specific node, newest first. */
export const GET_TELEMETRY = `
  query GetTelemetry($nodeId: String!, $limit: Int = 50) {
    norvi_telemetry(
      where: { node_id: { _eq: $nodeId } }
      order_by: { event_ts: desc }
      limit: $limit
    ) {
      id
      machine_id
      node_id
      payload
      status
      event_ts
    }
  }
` as const;

/** Fetch alert event history scoped to a plant. */
export const GET_ALERT_EVENTS = `
  query GetAlertEvents($plantId: uuid!, $limit: Int = 50) {
    alert_events(
      where: { plant_id: { _eq: $plantId } }
      order_by: { detected_at: desc }
      limit: $limit
    ) {
      id
      node_id
      plant_id
      tipo_evento
      mensaje
      detected_at
      dispatched
      dispatch_result
    }
  }
` as const;

/** Fetch alert engine health status. */
export const GET_ENGINE_HEALTH = `
  query GetEngineHealth {
    alert_engine_health(
      order_by: { checked_at: desc }
      limit: 1
    ) {
      check_id
      checked_at
      latency_ms
      success
      detail
    }
  }
` as const;

// ─── Response Shapes (internal) ────────────────────────────────────────────────

interface QueryResponse<T> {
  data?: T | null;
  error?: { message: string } | null;
}

interface AlertRulesData {
  alert_rules: GatewayAlertRule[];
}

interface NodesData {
  nodes: GatewayNode[];
}

interface TelemetryData {
  norvi_telemetry: GatewayTelemetry[];
}

interface AlertEventsData {
  alert_events: GatewayAlertEvent[];
}

interface EngineHealthData {
  alert_engine_health: GatewayEngineHealth[];
}

// ─── Timeout ───────────────────────────────────────────────────────────────────

/** Default timeout for gateway queries — slightly longer to accommodate Remote Schema latency. */
const GATEWAY_TIMEOUT_MS = 10_000;

// ─── Fetch Helpers ─────────────────────────────────────────────────────────────

/**
 * Fetches alert rules for a given plant.
 * Returns an empty array on error (graceful degradation for offline/demo).
 */
export async function fetchAlertRules(plantId: string): Promise<GatewayAlertRule[]> {
  try {
    const res = await withTimeout(
      nhost.graphql.request<QueryResponse<AlertRulesData>>(GET_ALERT_RULES, { plantId }),
      GATEWAY_TIMEOUT_MS,
    );
    if (res.error) {
      console.warn('[gateway] fetchAlertRules GraphQL error:', res.error.message);
      return [];
    }
    return res.data?.alert_rules ?? [];
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[gateway] fetchAlertRules failed:', message);
    return [];
  }
}

/**
 * Fetches nodes (IoT hardware catalog) scoped to a plant.
 * Returns an empty array on error.
 */
export async function fetchNodes(plantId: string): Promise<GatewayNode[]> {
  try {
    const res = await withTimeout(
      nhost.graphql.request<QueryResponse<NodesData>>(GET_NODES, { plantId }),
      GATEWAY_TIMEOUT_MS,
    );
    if (res.error) {
      console.warn('[gateway] fetchNodes GraphQL error:', res.error.message);
      return [];
    }
    return res.data?.nodes ?? [];
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[gateway] fetchNodes failed:', message);
    return [];
  }
}

/**
 * Fetches telemetry records for a specific node.
 * Default limit is 50; pass a custom limit for pagination.
 * Returns an empty array on error.
 */
export async function fetchTelemetryByNode(
  nodeId: string,
  limit: number = 50,
): Promise<GatewayTelemetry[]> {
  try {
    const res = await withTimeout(
      nhost.graphql.request<QueryResponse<TelemetryData>>(GET_TELEMETRY, { nodeId, limit }),
      GATEWAY_TIMEOUT_MS,
    );
    if (res.error) {
      console.warn('[gateway] fetchTelemetryByNode GraphQL error:', res.error.message);
      return [];
    }
    return res.data?.norvi_telemetry ?? [];
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[gateway] fetchTelemetryByNode failed:', message);
    return [];
  }
}

/**
 * Fetches alert event history for a given plant.
 * Default limit is 50. Returns an empty array on error.
 */
export async function fetchAlertEvents(
  plantId: string,
  limit: number = 50,
): Promise<GatewayAlertEvent[]> {
  try {
    const res = await withTimeout(
      nhost.graphql.request<QueryResponse<AlertEventsData>>(GET_ALERT_EVENTS, { plantId, limit }),
      GATEWAY_TIMEOUT_MS,
    );
    if (res.error) {
      console.warn('[gateway] fetchAlertEvents GraphQL error:', res.error.message);
      return [];
    }
    return res.data?.alert_events ?? [];
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[gateway] fetchAlertEvents failed:', message);
    return [];
  }
}

/**
 * Fetches the latest alert engine health status.
 * Returns null when no health record exists or on error.
 */
export async function fetchEngineHealth(): Promise<GatewayEngineHealth | null> {
  try {
    const res = await withTimeout(
      nhost.graphql.request<QueryResponse<EngineHealthData>>(GET_ENGINE_HEALTH),
      GATEWAY_TIMEOUT_MS,
    );
    if (res.error) {
      console.warn('[gateway] fetchEngineHealth GraphQL error:', res.error.message);
      return null;
    }
    const records = res.data?.alert_engine_health ?? [];
    return records.length > 0 ? records[0] : null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[gateway] fetchEngineHealth failed:', message);
    return null;
  }
}
