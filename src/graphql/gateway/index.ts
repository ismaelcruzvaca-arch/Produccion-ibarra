/**
 * Gateway GraphQL Module — barrel exports.
 *
 * Re-exports all gateway types and query helpers for convenient imports.
 *
 * Usage:
 *   import { GatewayNode, fetchNodes, GET_NODES } from 'src/graphql/gateway';
 */

export type {
  GatewayPlant,
  GatewayLine,
  GatewayMachine,
  GatewayNode,
  DeviceModel,
  ModelCapability,
  AlertCapability,
  GatewayMachineRef,
  GatewayLineRef,
  GatewayTelemetry,
  GatewayAlertRule,
  GatewayAlertEvent,
  GatewayEngineHealth,
  GatewayAlertChannel,
} from './types';

export {
  GET_ALERT_RULES,
  GET_NODES,
  GET_TELEMETRY,
  GET_ALERT_EVENTS,
  GET_ENGINE_HEALTH,
  fetchAlertRules,
  fetchNodes,
  fetchTelemetryByNode,
  fetchAlertEvents,
  fetchEngineHealth,
} from './queries';
