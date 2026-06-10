/**
 * Alert Engine Service — typed client for the IoT Gateway Alert Engine Remote Schema.
 *
 * All alert data lives in the gateway's DB. This service wraps
 * `nhost.graphql.request()` with plant-aware auth, typed responses,
 * and structured error handling.
 *
 * Pattern: Service / Adapter
 * Why:
 * - Isolates all Remote Schema communication from UI components.
 * - Injects `plantId` from the current JWT claims transparently.
 * - Returns typed results — no `any` or inline assertions in callers.
 *
 * @see `src/graphql/alertEngine.ts` for the GraphQL documents
 */

import { nhost } from '../graphql/nhostClient';
import {
  ALERT_RULES,
  NODE_CATALOG,
  ALERT_EVENTS,
  ALERT_EVENTS_AGGREGATE,
  ALERT_ENGINE_HEALTH,
  TOGGLE_ALERT_RULE,
  DELETE_ALERT_RULE,
  UPSERT_ALERT_RULE,
  ACKNOWLEDGE_EVENT,
} from '../graphql/alertEngine';
import type {
  AlertRule,
  AlertEvent,
  NodeCatalog,
  AlertEngineHealth,
  AlertRuleUpsertInput,
  AlertEventFilters,
} from '../types/alertEngine';

// ─── Plant ID Extraction ────────────────────────────────────────────────────────

/**
 * Extracts the current user's plant ID from the JWT access token.
 * The `x-hasura-plant-id` claim is set by Nhost auth and embedded in the
 * `https://hasura.io/jwt/claims` namespace of the JWT payload.
 *
 * @returns The plant ID string, or null if not available.
 */
export function getPlantId(): string | null {
  try {
    const session = nhost.getUserSession();
    if (!session?.accessToken) return null;
    const payload = JSON.parse(atob(session.accessToken.split('.')[1]));
    const hasuraClaims = payload['https://hasura.io/jwt/claims'];
    return hasuraClaims?.['x-hasura-plant-id'] ?? null;
  } catch {
    return null;
  }
}

// ─── GraphQL Client ─────────────────────────────────────────────────────────────

/**
 * Generic GraphQL request through Nhost client.
 * Uses the existing authenticated singleton — no raw fetch, no extra headers.
 *
 * @param query - GraphQL document string
 * @param variables - Variables object
 * @returns Typed response data
 */
async function request<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await nhost.graphql.request<{ data: T }>(query, variables);

  // Handle GraphQL errors surfaced at the transport level
  if ((response as any).error) {
    throw new Error((response as any).error.message ?? 'GraphQL request failed');
  }

  // Nhost returns { data, error } — extract data or throw
  const result = (response as any)?.data as T | undefined;
  if (!result) {
    throw new Error('Empty response from alert engine');
  }

  return result;
}

/**
 * Wraps a request with error logging and re-throws to the caller.
 * This ensures callers always get a typed error they can display.
 */
async function safeRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  try {
    return await request<T>(query, variables);
  } catch (err: any) {
    console.warn('[AlertEngine] Request failed:', err?.message ?? err);
    throw err;
  }
}

// ─── Convenience Methods ────────────────────────────────────────────────────────

/**
 * Fetch all USER_DEFINED alert rules for the current plant.
 */
export async function fetchAlertRules(
  plantId?: string,
): Promise<AlertRule[]> {
  const pid = plantId ?? getPlantId();
  if (!pid) throw new Error('Plant ID no disponible — verifica tu sesión');

  const result = await safeRequest<{ alert_rules: AlertRule[] }>(ALERT_RULES, {
    plantId: pid,
  });
  return result.alert_rules ?? [];
}

/**
 * Fetch the node catalog (machines, nodes, capabilities) for the current plant.
 */
export async function fetchNodeCatalog(
  plantId?: string,
): Promise<NodeCatalog[]> {
  const pid = plantId ?? getPlantId();
  if (!pid) throw new Error('Plant ID no disponible — verifica tu sesión');

  const result = await safeRequest<{ nodes: NodeCatalog[] }>(NODE_CATALOG, {
    plantId: pid,
  });
  return result.nodes ?? [];
}

/**
 * Fetch alert events with optional filters and pagination.
 *
 * @param plantId - Plant UUID (defaults from JWT)
 * @param filters - Optional filters (node_id, date_from, date_to, tipo_evento)
 * @param limit - Page size (default 20)
 * @param offset - Pagination offset (default 0)
 */
export async function fetchAlertEvents(
  plantId?: string,
  filters?: AlertEventFilters,
  limit = 20,
  offset = 0,
): Promise<AlertEvent[]> {
  const pid = plantId ?? getPlantId();
  if (!pid) throw new Error('Plant ID no disponible — verifica tu sesión');

  const result = await safeRequest<{ alert_events: AlertEvent[] }>(
    ALERT_EVENTS,
    {
      plantId: pid,
      limit,
      offset,
      nodeId: filters?.node_id ?? null,
      dateFrom: filters?.date_from ?? null,
      dateTo: filters?.date_to ?? null,
      tipoEvento: filters?.tipo_evento ?? null,
    },
  );
  return result.alert_events ?? [];
}

/**
 * Fetch the latest alert engine health record.
 */
export async function fetchAlertEngineHealth(): Promise<AlertEngineHealth | null> {
  try {
    const result = await safeRequest<{ alert_engine_health: AlertEngineHealth[] }>(
      ALERT_ENGINE_HEALTH,
    );
    return result.alert_engine_health?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Count of unacknowledged alert events for the current plant,
 * optionally scoped to a specific alert engine node (IoT sensor/gateway).
 *
 * When `nodeId` is provided, only events for that node are counted.
 * This enables operator-scoped alert badges per machine (F-AC-43).
 */
export async function fetchUnacknowledgedCount(
  plantId?: string,
  nodeId?: string,
): Promise<number> {
  const pid = plantId ?? getPlantId();
  if (!pid) return 0;

  try {
    const result = await safeRequest<{
      alert_events_aggregate: { aggregate: { count: number } };
    }>(ALERT_EVENTS_AGGREGATE, { plantId: pid, nodeId: nodeId ?? null });

    return result.alert_events_aggregate?.aggregate?.count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Resolves a catalog machine name to the first matching alert engine node ID.
 * This enables scoping alert queries to a specific machine's IoT nodes.
 *
 * Returns the node ID if a match is found, or undefined if no nodes match
 * (which means the query falls back to plant-wide scope).
 */
export async function resolveMachineNameToNodeId(
  machineName: string,
): Promise<string | undefined> {
  try {
    const nodes = await fetchNodeCatalog();
    const match = nodes.find(
      (n) => n.machine.name.toLowerCase() === machineName.toLowerCase(),
    );
    return match?.id;
  } catch {
    return undefined;
  }
}

/**
 * Toggle a rule's enabled state.
 * Returns the number of affected rows (should be 1).
 */
export async function toggleRule(
  id: string,
  enabled: boolean,
): Promise<number> {
  const result = await safeRequest<{
    update_alert_rules: { affected_rows: number };
  }>(TOGGLE_ALERT_RULE, { id, enabled });

  return result.update_alert_rules?.affected_rows ?? 0;
}

/**
 * Delete an alert rule by ID.
 * Returns the number of deleted rows (should be 1).
 */
export async function deleteRule(id: string): Promise<number> {
  const result = await safeRequest<{
    delete_alert_rules: { affected_rows: number };
  }>(DELETE_ALERT_RULE, { id });

  return result.delete_alert_rules?.affected_rows ?? 0;
}

/**
 * Create or update an alert rule.
 *
 * Create: omit `id` — insert_alert_rules_one with the input object.
 * Update: include `id` — the on_conflict constraint triggers update.
 *
 * @param input - The rule fields (see AlertRuleUpsertInput)
 * @param existingId - Optional. If provided, updates the existing rule.
 * @returns The created/updated AlertRule
 */
export async function upsertRule(
  input: AlertRuleUpsertInput,
  existingId?: string,
): Promise<AlertRule> {
  const pid = input.plant_id ?? getPlantId();
  if (!pid) throw new Error('Plant ID no disponible — verifica tu sesión');

  const objects = existingId
    ? [{ ...input, id: existingId, plant_id: pid }]
    : [{ ...input, plant_id: pid }];

  const result = await safeRequest<{
    insert_alert_rules: { returning: AlertRule[] };
  }>(UPSERT_ALERT_RULE, { objects });

  return result.insert_alert_rules?.returning?.[0];
}

/**
 * Acknowledge an alert event (mark as reviewed).
 * Returns the number of affected rows.
 */
export async function acknowledgeEvent(id: string): Promise<number> {
  const result = await safeRequest<{
    update_alert_events: { affected_rows: number };
  }>(ACKNOWLEDGE_EVENT, { id });

  return result.update_alert_events?.affected_rows ?? 0;
}
