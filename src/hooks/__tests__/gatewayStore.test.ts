/**
 * Unit tests for gatewayStore — Zustand store for IoT Gateway data.
 *
 * Testing approach:
 * - Mock queries.ts to control fetch responses
 * - Test initial state values
 * - Test each fetch action: success → updates data, error → sets error
 * - Test cache TTL: stale triggers re-fetch, fresh skips
 * - Test force param bypasses cache
 *
 * @see tasks.md task 3.7
 * @see spec.md FQ-5 (Remote Schema Unavailable — graceful fallback)
 */

import { act } from '@testing-library/react-native';

// ─── Mock queries module ────────────────────────────────────────────────────────

const mockFetchAlertRules = jest.fn();
const mockFetchNodes = jest.fn();
const mockFetchTelemetryByNode = jest.fn();
const mockFetchAlertEvents = jest.fn();
const mockFetchEngineHealth = jest.fn();

jest.mock('../../graphql/gateway/queries', () => ({
  fetchAlertRules: (...args: unknown[]) => mockFetchAlertRules(...args),
  fetchNodes: (...args: unknown[]) => mockFetchNodes(...args),
  fetchTelemetryByNode: (...args: unknown[]) => mockFetchTelemetryByNode(...args),
  fetchAlertEvents: (...args: unknown[]) => mockFetchAlertEvents(...args),
  fetchEngineHealth: (...args: unknown[]) => mockFetchEngineHealth(...args),
}));

// Silence console.warn during tests
jest.spyOn(console, 'warn').mockImplementation(() => {});

// ─── Module Under Test ─────────────────────────────────────────────────────────

import { useGatewayStore } from '../../ui/store/gatewayStore';
import type { GatewayAlertRule, GatewayNode, GatewayTelemetry, GatewayAlertEvent, GatewayEngineHealth } from '../../graphql/gateway/types';

// ─── Fixtures ───────────────────────────────────────────────────────────────────

const MOCK_PLANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const MOCK_NODE_ID = 'node-001';

const MOCK_ALERT_RULES: GatewayAlertRule[] = [
  {
    id: 'rule-001',
    node_id: MOCK_NODE_ID,
    plant_id: MOCK_PLANT_ID,
    scope: 'USER_DEFINED',
    tipo_condicion: 'SILENCE_TIMEOUT',
    valor_umbral: 30,
    canales: { email: true },
    cooldown_minutos: 30,
    last_alerted_at: undefined,
    enabled: true,
    created_at: '2026-06-01T00:00:00Z',
  },
];

const MOCK_NODES: GatewayNode[] = [
  {
    id: MOCK_NODE_ID,
    node_ident: 'GW-NORVI-001',
    machine_id: 'gateway-mach-001',
    device_model: {
      model_name: 'NORVI-IIOT-A01',
      model_capabilities: [
        { alert_capability: { capability_key: 'vibration', description: 'Vibration monitoring' } },
      ],
    },
    machine: { name: 'Toaster 1', line: { name: 'Line 1', plant_id: MOCK_PLANT_ID } },
  },
];

const MOCK_TELEMETRY: GatewayTelemetry[] = [
  {
    id: 'tel-001',
    machine_id: 'gateway-mach-001',
    node_id: MOCK_NODE_ID,
    payload: { temperature: 42.5 },
    status: 0,
    event_ts: '2026-06-01T12:00:00Z',
  },
];

const MOCK_ALERT_EVENTS: GatewayAlertEvent[] = [
  {
    id: 'evt-001',
    node_id: MOCK_NODE_ID,
    plant_id: MOCK_PLANT_ID,
    tipo_evento: 'SILENCE_TIMEOUT',
    mensaje: 'Node silence timeout exceeded',
    detected_at: '2026-06-01T12:00:00Z',
    dispatched: true,
    dispatch_result: 'sent',
  },
];

const MOCK_ENGINE_HEALTH: GatewayEngineHealth = {
  check_id: 'chk-001',
  checked_at: '2026-06-01T12:00:00Z',
  latency_ms: 42,
  success: true,
  detail: 'All systems operational',
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Resets the store to its initial state between tests. */
function resetStore() {
  act(() => {
    useGatewayStore.setState({
      alertRules: { data: [], loading: false, error: null, fetchedAt: null },
      nodes: { data: [], loading: false, error: null, fetchedAt: null },
      telemetry: {},
      alertEvents: { data: [], loading: false, error: null, fetchedAt: null },
      engineHealth: { data: null, loading: false, error: null, fetchedAt: null },
    });
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('gatewayStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  // ── Initial State ───────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('should have empty alert rules, not loading, no error', () => {
      const state = useGatewayStore.getState();
      expect(state.alertRules.data).toEqual([]);
      expect(state.alertRules.loading).toBe(false);
      expect(state.alertRules.error).toBeNull();
      expect(state.alertRules.fetchedAt).toBeNull();
    });

    it('should have empty nodes, not loading, no error', () => {
      const state = useGatewayStore.getState();
      expect(state.nodes.data).toEqual([]);
      expect(state.nodes.loading).toBe(false);
      expect(state.nodes.error).toBeNull();
    });

    it('should have empty telemetry map, not loading, no error', () => {
      const state = useGatewayStore.getState();
      expect(state.telemetry).toEqual({});
    });

    it('should have empty alert events, not loading, no error', () => {
      const state = useGatewayStore.getState();
      expect(state.alertEvents.data).toEqual([]);
      expect(state.alertEvents.loading).toBe(false);
    });

    it('should have null engine health, not loading, no error', () => {
      const state = useGatewayStore.getState();
      expect(state.engineHealth.data).toBeNull();
      expect(state.engineHealth.loading).toBe(false);
      expect(state.engineHealth.error).toBeNull();
    });
  });

  // ── fetchAlertRules ─────────────────────────────────────────────────────────

  describe('fetchAlertRules', () => {
    it('should fetch alert rules and update state on success', async () => {
      mockFetchAlertRules.mockResolvedValue(MOCK_ALERT_RULES);

      await act(async () => {
        await useGatewayStore.getState().fetchAlertRules(MOCK_PLANT_ID);
      });

      const state = useGatewayStore.getState();
      expect(mockFetchAlertRules).toHaveBeenCalledWith(MOCK_PLANT_ID);
      expect(state.alertRules.data).toEqual(MOCK_ALERT_RULES);
      expect(state.alertRules.loading).toBe(false);
      expect(state.alertRules.error).toBeNull();
      expect(state.alertRules.fetchedAt).not.toBeNull();
    });

    it('should set loading true before fetching', () => {
      // Don't resolve the promise — capture intermediate loading state
      mockFetchAlertRules.mockImplementation(() => new Promise(() => {}));

      act(() => {
        useGatewayStore.getState().fetchAlertRules(MOCK_PLANT_ID);
      });

      expect(useGatewayStore.getState().alertRules.loading).toBe(true);
    });

    it('should set error state on fetch failure', async () => {
      mockFetchAlertRules.mockRejectedValue(new Error('Network error'));

      await act(async () => {
        await useGatewayStore.getState().fetchAlertRules(MOCK_PLANT_ID);
      });

      const state = useGatewayStore.getState();
      expect(state.alertRules.data).toEqual([]);
      expect(state.alertRules.loading).toBe(false);
      expect(state.alertRules.error).toBe('Network error');
    });

    it('should skip fetch if cache is fresh', async () => {
      const fetchedAt = Date.now();
      act(() => {
        useGatewayStore.setState({
          alertRules: { data: MOCK_ALERT_RULES, loading: false, error: null, fetchedAt },
        });
      });

      await act(async () => {
        await useGatewayStore.getState().fetchAlertRules(MOCK_PLANT_ID);
      });

      // Should NOT call the query again
      expect(mockFetchAlertRules).not.toHaveBeenCalled();
    });

    it('should re-fetch if force is true', async () => {
      const fetchedAt = Date.now();
      act(() => {
        useGatewayStore.setState({
          alertRules: { data: MOCK_ALERT_RULES, loading: false, error: null, fetchedAt },
        });
      });
      mockFetchAlertRules.mockResolvedValue(MOCK_ALERT_RULES);

      await act(async () => {
        await useGatewayStore.getState().fetchAlertRules(MOCK_PLANT_ID, true);
      });

      expect(mockFetchAlertRules).toHaveBeenCalledTimes(1);
    });
  });

  // ── fetchNodes ──────────────────────────────────────────────────────────────

  describe('fetchNodes', () => {
    it('should fetch nodes and update state on success', async () => {
      mockFetchNodes.mockResolvedValue(MOCK_NODES);

      await act(async () => {
        await useGatewayStore.getState().fetchNodes(MOCK_PLANT_ID);
      });

      const state = useGatewayStore.getState();
      expect(mockFetchNodes).toHaveBeenCalledWith(MOCK_PLANT_ID);
      expect(state.nodes.data).toEqual(MOCK_NODES);
      expect(state.nodes.loading).toBe(false);
      expect(state.nodes.error).toBeNull();
    });

    it('should set error state on fetch failure', async () => {
      mockFetchNodes.mockRejectedValue(new Error('Gateway timeout'));

      await act(async () => {
        await useGatewayStore.getState().fetchNodes(MOCK_PLANT_ID);
      });

      const state = useGatewayStore.getState();
      expect(state.nodes.data).toEqual([]);
      expect(state.nodes.loading).toBe(false);
      expect(state.nodes.error).toBe('Gateway timeout');
    });
  });

  // ── fetchTelemetry ──────────────────────────────────────────────────────────

  describe('fetchTelemetry', () => {
    it('should fetch telemetry and update state on success', async () => {
      mockFetchTelemetryByNode.mockResolvedValue(MOCK_TELEMETRY);

      await act(async () => {
        await useGatewayStore.getState().fetchTelemetry(MOCK_NODE_ID, 10);
      });

      const state = useGatewayStore.getState();
      expect(mockFetchTelemetryByNode).toHaveBeenCalledWith(MOCK_NODE_ID, 10);
      expect(state.telemetry[MOCK_NODE_ID].data).toEqual(MOCK_TELEMETRY);
      expect(state.telemetry[MOCK_NODE_ID].loading).toBe(false);
      expect(state.telemetry[MOCK_NODE_ID].error).toBeNull();
    });

    it('should set error state on fetch failure', async () => {
      mockFetchTelemetryByNode.mockRejectedValue(new Error('Timeout'));

      await act(async () => {
        await useGatewayStore.getState().fetchTelemetry(MOCK_NODE_ID);
      });

      const state = useGatewayStore.getState();
      expect(state.telemetry[MOCK_NODE_ID].data).toEqual([]);
      expect(state.telemetry[MOCK_NODE_ID].loading).toBe(false);
      expect(state.telemetry[MOCK_NODE_ID].error).toBe('Timeout');
    });

    it('should cache telemetry per node independently', async () => {
      const nodeA = 'node-A';
      const nodeB = 'node-B';
      const telemetryA: GatewayTelemetry[] = [{ id: 'tel-A', machine_id: 'm1', node_id: nodeA, payload: {}, status: 0, event_ts: '2026-01-01T00:00:00Z' }];
      const telemetryB: GatewayTelemetry[] = [{ id: 'tel-B', machine_id: 'm1', node_id: nodeB, payload: {}, status: 0, event_ts: '2026-01-01T00:00:00Z' }];

      mockFetchTelemetryByNode.mockResolvedValueOnce(telemetryA);
      await act(async () => {
        await useGatewayStore.getState().fetchTelemetry(nodeA);
      });

      mockFetchTelemetryByNode.mockResolvedValueOnce(telemetryB);
      await act(async () => {
        await useGatewayStore.getState().fetchTelemetry(nodeB);
      });

      const state = useGatewayStore.getState();
      expect(state.telemetry[nodeA].data).toEqual(telemetryA);
      expect(state.telemetry[nodeB].data).toEqual(telemetryB);
      expect(mockFetchTelemetryByNode).toHaveBeenCalledTimes(2);
    });
  });

  // ── fetchAlertEvents ────────────────────────────────────────────────────────

  describe('fetchAlertEvents', () => {
    it('should fetch alert events and update state on success', async () => {
      mockFetchAlertEvents.mockResolvedValue(MOCK_ALERT_EVENTS);

      await act(async () => {
        await useGatewayStore.getState().fetchAlertEvents(MOCK_PLANT_ID, 25);
      });

      const state = useGatewayStore.getState();
      expect(mockFetchAlertEvents).toHaveBeenCalledWith(MOCK_PLANT_ID, 25);
      expect(state.alertEvents.data).toEqual(MOCK_ALERT_EVENTS);
      expect(state.alertEvents.loading).toBe(false);
    });

    it('should set error state on fetch failure', async () => {
      mockFetchAlertEvents.mockRejectedValue(new Error('Server error'));

      await act(async () => {
        await useGatewayStore.getState().fetchAlertEvents(MOCK_PLANT_ID);
      });

      const state = useGatewayStore.getState();
      expect(state.alertEvents.data).toEqual([]);
      expect(state.alertEvents.loading).toBe(false);
      expect(state.alertEvents.error).toBe('Server error');
    });
  });

  // ── fetchEngineHealth ───────────────────────────────────────────────────────

  describe('fetchEngineHealth', () => {
    it('should fetch engine health and update state on success', async () => {
      mockFetchEngineHealth.mockResolvedValue(MOCK_ENGINE_HEALTH);

      await act(async () => {
        await useGatewayStore.getState().fetchEngineHealth();
      });

      const state = useGatewayStore.getState();
      expect(mockFetchEngineHealth).toHaveBeenCalledWith();
      expect(state.engineHealth.data).toEqual(MOCK_ENGINE_HEALTH);
      expect(state.engineHealth.loading).toBe(false);
      expect(state.engineHealth.error).toBeNull();
    });

    it('should handle null engine health response', async () => {
      mockFetchEngineHealth.mockResolvedValue(null);

      await act(async () => {
        await useGatewayStore.getState().fetchEngineHealth();
      });

      const state = useGatewayStore.getState();
      expect(state.engineHealth.data).toBeNull();
      expect(state.engineHealth.loading).toBe(false);
      expect(state.engineHealth.error).toBeNull();
    });

    it('should set error state on fetch failure', async () => {
      mockFetchEngineHealth.mockRejectedValue(new Error('Engine unreachable'));

      await act(async () => {
        await useGatewayStore.getState().fetchEngineHealth();
      });

      const state = useGatewayStore.getState();
      expect(state.engineHealth.loading).toBe(false);
      expect(state.engineHealth.error).toBe('Engine unreachable');
    });
  });
});
