/**
 * Zustand store for IoT Gateway Remote Schema data with TTL-based caching.
 *
 * Pattern: Zustand + per-domain loading/error state + cache TTL
 * Why:
 * - Gateway data (alert rules, nodes, telemetry, events, health) changes
 *   frequently enough that a short TTL cache suffices — no RxDB or AsyncStorage.
 * - Per-domain loading/error flags allow UI components to show granular
 *   spinners and error states without blocking unrelated data sections.
 * - Same `nhost.graphql.request()` + `withTimeout()` pattern as catalogStore.ts
 *   but through the query helpers from `src/graphql/gateway/queries.ts`.
 *
 * Cache TTL: 5 minutes (configurable via GATEWAY_CACHE_TTL_MS export).
 * Each domain tracks its own `fetchedAt` timestamp.
 *
 * @see tasks.md task 3.1
 * @see design.md AD-5 (Zustand store per gateway domain)
 */

import { create } from 'zustand';
import {
  fetchAlertRules as fetchAlertRulesQuery,
  fetchNodes as fetchNodesQuery,
  fetchTelemetryByNode as fetchTelemetryByNodeQuery,
  fetchAlertEvents as fetchAlertEventsQuery,
  fetchEngineHealth as fetchEngineHealthQuery,
} from '../../graphql/gateway/queries';
import type {
  GatewayAlertRule,
  GatewayNode,
  GatewayTelemetry,
  GatewayAlertEvent,
  GatewayEngineHealth,
} from '../../graphql/gateway/types';

// ─── Cache TTL ──────────────────────────────────────────────────────────────────

/** Default cache TTL for gateway data (5 minutes in ms). */
export const GATEWAY_CACHE_TTL_MS = 5 * 60 * 1_000;

// ─── Domain State Wrapper ───────────────────────────────────────────────────────

interface DomainState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  fetchedAt: number | null;
}

const initialDomain = <T>(initialData: T): DomainState<T> => ({
  data: initialData,
  loading: false,
  error: null,
  fetchedAt: null,
});

// ─── Store Interface ────────────────────────────────────────────────────────────

interface GatewayState {
  // Domain states
  alertRules: DomainState<GatewayAlertRule[]>;
  nodes: DomainState<GatewayNode[]>;
  telemetry: Record<string, DomainState<GatewayTelemetry[]>>;
  alertEvents: DomainState<GatewayAlertEvent[]>;
  engineHealth: DomainState<GatewayEngineHealth | null>;

  // Actions
  fetchAlertRules: (plantId: string, force?: boolean) => Promise<void>;
  fetchNodes: (plantId: string, force?: boolean) => Promise<void>;
  fetchTelemetry: (nodeId: string, limit?: number, force?: boolean) => Promise<void>;
  fetchAlertEvents: (plantId: string, limit?: number, force?: boolean) => Promise<void>;
  fetchEngineHealth: (force?: boolean) => Promise<void>;
}

// ─── Helper: check if cache is stale ────────────────────────────────────────────

function isStale(fetchedAt: number | null, ttl: number = GATEWAY_CACHE_TTL_MS): boolean {
  return !fetchedAt || Date.now() - fetchedAt > ttl;
}

// ─── Store ──────────────────────────────────────────────────────────────────────

export const useGatewayStore = create<GatewayState>((set, get) => ({
  // ── Initial State ───────────────────────────────────────────────────────────

  alertRules: initialDomain<GatewayAlertRule[]>([]),
  nodes: initialDomain<GatewayNode[]>([]),
  telemetry: {},
  alertEvents: initialDomain<GatewayAlertEvent[]>([]),
  engineHealth: initialDomain<GatewayEngineHealth | null>(null),

  // ── Actions ─────────────────────────────────────────────────────────────────

  fetchAlertRules: async (plantId: string, force: boolean = false) => {
    const current = get().alertRules;
    if (!force && !isStale(current.fetchedAt)) return;

    set({ alertRules: { ...current, loading: true, error: null } });

    try {
      const data = await fetchAlertRulesQuery(plantId);
      set({
        alertRules: { data, loading: false, error: null, fetchedAt: Date.now() },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar reglas de alerta';
      set({ alertRules: { ...get().alertRules, loading: false, error: message } });
    }
  },

  fetchNodes: async (plantId: string, force: boolean = false) => {
    const current = get().nodes;
    if (!force && !isStale(current.fetchedAt)) return;

    set({ nodes: { ...current, loading: true, error: null } });

    try {
      const data = await fetchNodesQuery(plantId);
      set({
        nodes: { data, loading: false, error: null, fetchedAt: Date.now() },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar nodos';
      set({ nodes: { ...get().nodes, loading: false, error: message } });
    }
  },

  fetchTelemetry: async (nodeId: string, limit: number = 50, force: boolean = false) => {
    const current = get().telemetry[nodeId] ?? initialDomain<GatewayTelemetry[]>([]);
    if (!force && !isStale(current.fetchedAt)) return;

    set({
      telemetry: {
        ...get().telemetry,
        [nodeId]: { ...current, loading: true, error: null },
      },
    });

    try {
      const data = await fetchTelemetryByNodeQuery(nodeId, limit);
      set({
        telemetry: {
          ...get().telemetry,
          [nodeId]: { data, loading: false, error: null, fetchedAt: Date.now() },
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar telemetría';
      set({
        telemetry: {
          ...get().telemetry,
          [nodeId]: { ...get().telemetry[nodeId], loading: false, error: message },
        },
      });
    }
  },

  fetchAlertEvents: async (plantId: string, limit: number = 50, force: boolean = false) => {
    const current = get().alertEvents;
    if (!force && !isStale(current.fetchedAt)) return;

    set({ alertEvents: { ...current, loading: true, error: null } });

    try {
      const data = await fetchAlertEventsQuery(plantId, limit);
      set({
        alertEvents: { data, loading: false, error: null, fetchedAt: Date.now() },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar eventos de alerta';
      set({ alertEvents: { ...get().alertEvents, loading: false, error: message } });
    }
  },

  fetchEngineHealth: async (force: boolean = false) => {
    const current = get().engineHealth;
    if (!force && !isStale(current.fetchedAt)) return;

    set({ engineHealth: { ...current, loading: true, error: null } });

    try {
      const data = await fetchEngineHealthQuery();
      set({
        engineHealth: { data, loading: false, error: null, fetchedAt: Date.now() },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar estado del motor';
      set({ engineHealth: { ...get().engineHealth, loading: false, error: message } });
    }
  },
}));
