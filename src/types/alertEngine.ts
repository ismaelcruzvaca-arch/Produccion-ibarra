/**
 * TypeScript types for the IoT Gateway Alert Engine (Remote Schema).
 *
 * All data lives in the gateway's DB — these types describe the shape of
 * data returned via Remote Schema GraphQL queries.
 *
 * Pattern: Typed Interface / DTO
 * Why:
 * - Remote schema types are distinct from local RxDB types.
 * - Centralising them here avoids inline type assertions elsewhere.
 * - Mirrors the gateway's PostgreSQL schema as closely as possible.
 */

// ─── Alert Rule ─────────────────────────────────────────────────────────────────

export interface AlertRule {
  id: string;
  node_id: string;
  plant_id: string;
  scope: 'USER_DEFINED' | 'SYSTEM';
  tipo_condicion: string;
  valor_umbral: number;
  canales: string[];
  cooldown_minutos: number;
  last_alerted_at: string | null;
  enabled: boolean;
  created_at: string;
}

// ─── Alert Event ────────────────────────────────────────────────────────────────

export interface AlertEvent {
  id: string;
  node_id: string;
  plant_id: string;
  tipo_evento: string;
  mensaje: string;
  detected_at: string;
  acknowledged: boolean;
  dispatched: boolean;
  dispatch_result: string | null;
}

// ─── Node Catalog (nested — machine, line, device_model, model_capabilities) ────

export interface NodeCatalog {
  id: string;
  node_ident: string;
  device_model: {
    model_name: string;
    model_capabilities: Array<{
      alert_capability: {
        capability_key: string;
        description: string;
      };
    }>;
  };
  machine: {
    name: string;
    line: {
      name: string;
    };
  };
}

// ─── Alert Engine Health ────────────────────────────────────────────────────────

export interface AlertEngineHealth {
  last_evaluation_at: string;
  rules_evaluated: number;
  alerts_triggered: number;
  status: 'healthy' | 'degraded' | 'down';
}

// ─── Generic Query Result ──────────────────────────────────────────────────────

export interface UseAlertQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// ─── Upsert Input ───────────────────────────────────────────────────────────────

export interface AlertRuleUpsertInput {
  node_id: string;
  tipo_condicion: string;
  valor_umbral: number;
  canales: string[];
  cooldown_minutos: number;
  enabled: boolean;
  plant_id?: string;
}

// ─── Event Filters ──────────────────────────────────────────────────────────────

export interface AlertEventFilters {
  node_id?: string;
  date_from?: string;
  date_to?: string;
  tipo_evento?: string;
}
