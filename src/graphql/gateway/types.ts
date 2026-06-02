/**
 * TypeScript interfaces for the IoT Gateway Remote Schema domain.
 *
 * Pattern: Domain Interface Definitions (mirrors src/core/types.ts catalog pattern)
 * Why: These types map to tables exposed via the `gateway` Remote Schema in Hasura.
 * Table names are auto-prefixed with `gateway_` by Nhost (e.g., `gateway_nodes`).
 * Fields use snake_case to match GraphQL wire format — no mapper needed since
 * these are consumed directly from nhost.graphql.request() responses.
 *
 * Offline-first: These are NOT RxDB documents. Data is fetched on demand and
 * cached in Zustand stores (see gatewayStore.ts). No local persistence.
 *
 * @see design.md for the full data model contract
 */

// ─── Domain: Plants ────────────────────────────────────────────────────────────

/** Gateway plant — production facility. */
export interface GatewayPlant {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

/** Gateway production line, scoped to a plant. */
export interface GatewayLine {
  id: string;
  name: string;
  plant_id: string;
  is_active: boolean;
}

/** Gateway machine, scoped to a line. */
export interface GatewayMachine {
  id: string;
  name: string;
  line_id: string;
  is_active: boolean;
}

// ─── Domain: Nodes ─────────────────────────────────────────────────────────────

/** Capability of a device model (e.g., temperature, vibration alerts). */
export interface AlertCapability {
  capability_key: string;
  description: string;
}

/** Model capabilities bridged from device_model → alert_capability. */
export interface ModelCapability {
  alert_capability: AlertCapability;
}

/** Gateway device model with its alert capabilities. */
export interface DeviceModel {
  model_name: string;
  model_capabilities: ModelCapability[];
}

/** Gateway line info nested inside machine. */
export interface GatewayLineRef {
  name: string;
  plant_id: string;
}

/** Gateway machine info nested inside node. */
export interface GatewayMachineRef {
  name: string;
  line: GatewayLineRef;
}

/**
 * Gateway IoT node — the smallest addressable hardware unit.
 *
 * Fields:
 * - node_ident: unique hardware identifier (MAC / serial)
 * - machine_id: references gateway_machines (NOT production machines — see AD-4)
 * - device_model: optional nested model with capability metadata
 * - machine: optional nested machine + line hierarchy for catalog display
 */
export interface GatewayNode {
  id: string;
  node_ident: string;
  machine_id: string;
  device_model_id?: string;
  device_model?: DeviceModel;
  machine?: GatewayMachineRef;
}

// ─── Domain: Telemetry ─────────────────────────────────────────────────────────

/**
 * Gateway NORVI telemetry record.
 * Each row represents a sensor reading or event from an IoT node.
 *
 * Fields:
 * - payload: flexible sensor data (varies by device_model capabilities)
 * - status: numeric status code (0 = OK, non-zero = fault)
 * - event_ts: ISO-8601 timestamp of when the reading was taken
 */
export interface GatewayTelemetry {
  id: string;
  machine_id: string;
  node_id: string;
  payload: Record<string, unknown>;
  status: number;
  event_ts: string;
}

// ─── Domain: Alert Rules ───────────────────────────────────────────────────────

/**
 * Gateway alert rule — defines when an alert should be triggered.
 *
 * Fields:
 * - node_id: the node being monitored
 * - plant_id: scoped for RLS filtering
 * - scope: SYSTEM (built-in) or USER_DEFINED (operator-created)
 * - tipo_condicion: condition type (e.g., "SILENCE_TIMEOUT", "THRESHOLD")
 * - valor_umbral: threshold value
 * - canales: notification channels config (JSONB)
 * - cooldown_minutos: minimum minutes between alerts
 * - last_alerted_at: when this rule last fired (null if never)
 * - enabled: whether the rule is active
 */
export interface GatewayAlertRule {
  id: string;
  node_id: string;
  plant_id: string;
  scope: 'SYSTEM' | 'USER_DEFINED';
  tipo_condicion: string;
  valor_umbral: number;
  canales: Record<string, unknown>;
  cooldown_minutos: number;
  last_alerted_at?: string;
  enabled: boolean;
  created_at: string;
}

// ─── Domain: Alert Events ──────────────────────────────────────────────────────

/**
 * Gateway alert event — a triggered alert instance.
 *
 * Fields:
 * - node_id: the node that triggered the event
 * - plant_id: scoped for RLS filtering
 * - tipo_evento: event type code (e.g., "SILENCE_TIMEOUT", "THRESHOLD_BREACH")
 * - mensaje: human-readable alert message
 * - detected_at: when the condition was detected
 * - dispatched: whether the alert was dispatched via channels
 * - dispatch_result: result from dispatch (e.g., "sent", "failed", null)
 */
export interface GatewayAlertEvent {
  id: string;
  node_id: string;
  plant_id: string;
  tipo_evento: string;
  mensaje?: string;
  detected_at: string;
  dispatched: boolean;
  dispatch_result?: string;
}

// ─── Domain: Alert Engine Health ───────────────────────────────────────────────

/**
 * Gateway alert engine health — status of the alert evaluation engine.
 *
 * Fields:
 * - check_id: unique health check identifier
 * - checked_at: ISO-8601 timestamp of the check
 * - latency_ms: response time of the check
 * - success: whether the engine is healthy
 * - detail: optional human-readable detail
 */
export interface GatewayEngineHealth {
  check_id: string;
  checked_at: string;
  latency_ms: number;
  success: boolean;
  detail?: string;
}

// ─── Alert Channel (supplementary) ─────────────────────────────────────────────

/**
 * Gateway alert channel — notification destination configuration.
 * Used internally by the alert engine; exposed for admin UI.
 */
export interface GatewayAlertChannel {
  id: string;
  channel_type: string;
  config_json: Record<string, unknown>;
  enabled: boolean;
}
