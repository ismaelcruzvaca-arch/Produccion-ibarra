/**
 * Unit tests for IoT Gateway GraphQL query helpers.
 *
 * Testing approach:
 * - Mock nhost.graphql.request to control responses
 * - Test query construction via snapshot of query strings
 * - Test response parsing for each query helper
 * - Test error handling: GraphQL errors, network errors, timeouts
 *
 * Pattern: jest.mock + manual mock for nhostClient
 * Same pattern used in src/ui/store/__tests__/catalogStore.test.ts
 */

import { nhost } from '../../nhostClient';

// ─── Mock nhostClient ──────────────────────────────────────────────────────────

jest.mock('../../nhostClient', () => ({
  nhost: {
    graphql: {
      request: jest.fn(),
    },
  },
}));

// Silence console.warn during tests to reduce noise
jest.spyOn(console, 'warn').mockImplementation(() => {});

// ─── Module Under Test ─────────────────────────────────────────────────────────

import {
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
} from '../queries';

const mockRequest = nhost.graphql.request as jest.Mock;

// ─── Test Data ─────────────────────────────────────────────────────────────────

const MOCK_PLANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const MOCK_NODE_ID = 'node-001';

const MOCK_ALERT_RULES = [
  {
    id: 'rule-001',
    node_id: MOCK_NODE_ID,
    plant_id: MOCK_PLANT_ID,
    scope: 'USER_DEFINED',
    tipo_condicion: 'SILENCE_TIMEOUT',
    valor_umbral: 30,
    canales: { email: true, slack: false },
    cooldown_minutos: 30,
    last_alerted_at: null,
    enabled: true,
    created_at: '2026-06-01T00:00:00Z',
  },
];

const MOCK_NODES = [
  {
    id: 'node-001',
    node_ident: 'GW-NORVI-001',
    machine_id: 'gateway-mach-001',
    device_model_id: 'model-001',
    device_model: {
      model_name: 'NORVI-IIOT-A01',
      model_capabilities: [
        { alert_capability: { capability_key: 'vibration', description: 'Vibration monitoring' } },
      ],
    },
    machine: {
      name: 'Toaster 1',
      line: { name: 'Línea 1', plant_id: MOCK_PLANT_ID },
    },
  },
];

const MOCK_TELEMETRY = [
  {
    id: 'tel-001',
    machine_id: 'gateway-mach-001',
    node_id: MOCK_NODE_ID,
    payload: { temperature: 185.2, humidity: 42 },
    status: 0,
    event_ts: '2026-06-01T10:00:00Z',
  },
];

const MOCK_ALERT_EVENTS = [
  {
    id: 'evt-001',
    node_id: MOCK_NODE_ID,
    plant_id: MOCK_PLANT_ID,
    tipo_evento: 'SILENCE_TIMEOUT',
    mensaje: 'Node node-001 has been silent for 31 minutes',
    detected_at: '2026-06-01T10:30:00Z',
    dispatched: true,
    dispatch_result: 'sent',
  },
];

const MOCK_ENGINE_HEALTH = [
  {
    check_id: 'health-001',
    checked_at: '2026-06-01T10:00:00Z',
    latency_ms: 42,
    success: true,
    detail: 'All systems nominal',
  },
];

// ─── Query String Snapshots ────────────────────────────────────────────────────

describe('query string constants', () => {
  it('GET_ALERT_RULES queries alert_rules with plantId filter', () => {
    expect(GET_ALERT_RULES).toContain('alert_rules');
    expect(GET_ALERT_RULES).toContain('$plantId: uuid!');
    expect(GET_ALERT_RULES).toContain('plant_id: { _eq: $plantId }');
  });

  it('GET_NODES queries nodes with plant-scoped filter', () => {
    expect(GET_NODES).toContain('nodes');
    expect(GET_NODES).toContain('$plantId: uuid!');
    expect(GET_NODES).toContain('plant_id: { _eq: $plantId }');
    expect(GET_NODES).toContain('device_model');
    expect(GET_NODES).toContain('alert_capability');
  });

  it('GET_TELEMETRY queries norvi_telemetry with nodeId filter', () => {
    expect(GET_TELEMETRY).toContain('norvi_telemetry');
    expect(GET_TELEMETRY).toContain('$nodeId: String!');
    expect(GET_TELEMETRY).toContain('event_ts: desc');
  });

  it('GET_ALERT_EVENTS queries alert_events with plantId filter', () => {
    expect(GET_ALERT_EVENTS).toContain('alert_events');
    expect(GET_ALERT_EVENTS).toContain('$plantId: uuid!');
    expect(GET_ALERT_EVENTS).toContain('detected_at: desc');
  });

  it('GET_ENGINE_HEALTH queries alert_engine_health', () => {
    expect(GET_ENGINE_HEALTH).toContain('alert_engine_health');
    expect(GET_ENGINE_HEALTH).toContain('checked_at: desc');
    expect(GET_ENGINE_HEALTH).toContain('limit: 1');
  });
});

// ─── Success Cases ─────────────────────────────────────────────────────────────

describe('fetchAlertRules', () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it('returns parsed alert rules on success', async () => {
    mockRequest.mockResolvedValue({
      body: { data: { alert_rules: MOCK_ALERT_RULES } },
      status: 200,
      headers: {},
    });

    const result = await fetchAlertRules(MOCK_PLANT_ID);

    expect(result).toEqual(MOCK_ALERT_RULES);
    expect(result[0].enabled).toBe(true);
    expect(result[0].tipo_condicion).toBe('SILENCE_TIMEOUT');
  });

  it('passes the correct plantId variable to the query', async () => {
    mockRequest.mockResolvedValue({
      body: { data: { alert_rules: [] } },
      status: 200,
      headers: {},
    });

    await fetchAlertRules(MOCK_PLANT_ID);

    expect(mockRequest).toHaveBeenCalledWith(GET_ALERT_RULES, { plantId: MOCK_PLANT_ID });
  });

  it('returns empty array when GraphQL error occurs', async () => {
    mockRequest.mockResolvedValue({
      body: { data: null },
      status: 200,
      headers: {},
    });

    const result = await fetchAlertRules(MOCK_PLANT_ID);

    expect(result).toEqual([]);
  });

  it('returns empty array when network request fails', async () => {
    mockRequest.mockRejectedValue(new Error('Network request failed'));

    const result = await fetchAlertRules(MOCK_PLANT_ID);

    expect(result).toEqual([]);
  });

  it('returns empty array when data is null', async () => {
    mockRequest.mockResolvedValue({
      body: { data: null },
      status: 200,
      headers: {},
    });

    const result = await fetchAlertRules(MOCK_PLANT_ID);

    expect(result).toEqual([]);
  });
});

describe('fetchNodes', () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it('returns parsed nodes on success', async () => {
    mockRequest.mockResolvedValue({
      body: { data: { nodes: MOCK_NODES } },
      status: 200,
      headers: {},
    });

    const result = await fetchNodes(MOCK_PLANT_ID);

    expect(result).toEqual(MOCK_NODES);
    expect(result[0].node_ident).toBe('GW-NORVI-001');
    expect(result[0].device_model?.model_name).toBe('NORVI-IIOT-A01');
    expect(result[0].device_model?.model_capabilities[0].alert_capability.capability_key)
      .toBe('vibration');
  });

  it('passes plantId variable correctly', async () => {
    mockRequest.mockResolvedValue({
      body: { data: { nodes: [] } },
      status: 200,
      headers: {},
    });

    await fetchNodes(MOCK_PLANT_ID);

    expect(mockRequest).toHaveBeenCalledWith(GET_NODES, { plantId: MOCK_PLANT_ID });
  });

  it('returns empty array on GraphQL error', async () => {
    mockRequest.mockResolvedValue({
      body: { data: null },
      status: 200,
      headers: {},
    });

    const result = await fetchNodes(MOCK_PLANT_ID);

    expect(result).toEqual([]);
  });

  it('returns empty array on timeout', async () => {
    mockRequest.mockRejectedValue(new Error('La solicitud no respondió en 10 segundos'));

    const result = await fetchNodes(MOCK_PLANT_ID);

    expect(result).toEqual([]);
  });
});

describe('fetchTelemetryByNode', () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it('returns parsed telemetry on success', async () => {
    mockRequest.mockResolvedValue({
      body: { data: { norvi_telemetry: MOCK_TELEMETRY } },
      status: 200,
      headers: {},
    });

    const result = await fetchTelemetryByNode(MOCK_NODE_ID);

    expect(result).toEqual(MOCK_TELEMETRY);
    expect(result[0].status).toBe(0);
    expect(result[0].payload).toEqual({ temperature: 185.2, humidity: 42 });
  });

  it('passes correct variables with default limit', async () => {
    mockRequest.mockResolvedValue({
      body: { data: { norvi_telemetry: [] } },
      status: 200,
      headers: {},
    });

    await fetchTelemetryByNode(MOCK_NODE_ID);

    expect(mockRequest).toHaveBeenCalledWith(GET_TELEMETRY, {
      nodeId: MOCK_NODE_ID,
      limit: 50,
    });
  });

  it('passes custom limit when provided', async () => {
    mockRequest.mockResolvedValue({
      body: { data: { norvi_telemetry: [] } },
      status: 200,
      headers: {},
    });

    await fetchTelemetryByNode(MOCK_NODE_ID, 100);

    expect(mockRequest).toHaveBeenCalledWith(GET_TELEMETRY, {
      nodeId: MOCK_NODE_ID,
      limit: 100,
    });
  });

  it('returns empty array on GraphQL error', async () => {
    mockRequest.mockResolvedValue({
      body: { data: null },
      status: 200,
      headers: {},
    });

    const result = await fetchTelemetryByNode(MOCK_NODE_ID);

    expect(result).toEqual([]);
  });

  it('returns empty array on network error', async () => {
    mockRequest.mockRejectedValue(new Error('Network error'));

    const result = await fetchTelemetryByNode(MOCK_NODE_ID);

    expect(result).toEqual([]);
  });
});

describe('fetchAlertEvents', () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it('returns parsed alert events on success', async () => {
    mockRequest.mockResolvedValue({
      body: { data: { alert_events: MOCK_ALERT_EVENTS } },
      status: 200,
      headers: {},
    });

    const result = await fetchAlertEvents(MOCK_PLANT_ID);

    expect(result).toEqual(MOCK_ALERT_EVENTS);
    expect(result[0].tipo_evento).toBe('SILENCE_TIMEOUT');
    expect(result[0].dispatched).toBe(true);
  });

  it('passes correct variables with default limit', async () => {
    mockRequest.mockResolvedValue({
      body: { data: { alert_events: [] } },
      status: 200,
      headers: {},
    });

    await fetchAlertEvents(MOCK_PLANT_ID);

    expect(mockRequest).toHaveBeenCalledWith(GET_ALERT_EVENTS, {
      plantId: MOCK_PLANT_ID,
      limit: 50,
    });
  });

  it('returns empty array on error', async () => {
    mockRequest.mockResolvedValue({
      body: { data: null },
      status: 200,
      headers: {},
    });

    const result = await fetchAlertEvents(MOCK_PLANT_ID);

    expect(result).toEqual([]);
  });
});

describe('fetchEngineHealth', () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it('returns engine health record on success', async () => {
    mockRequest.mockResolvedValue({
      body: { data: { alert_engine_health: MOCK_ENGINE_HEALTH } },
      status: 200,
      headers: {},
    });

    const result = await fetchEngineHealth();

    expect(result).toEqual(MOCK_ENGINE_HEALTH[0]);
    expect(result?.success).toBe(true);
    expect(result?.latency_ms).toBe(42);
  });

  it('returns null when no health records exist', async () => {
    mockRequest.mockResolvedValue({
      body: { data: { alert_engine_health: [] } },
      status: 200,
      headers: {},
    });

    const result = await fetchEngineHealth();

    expect(result).toBeNull();
  });

  it('returns null on GraphQL error', async () => {
    mockRequest.mockResolvedValue({
      body: { data: null },
      status: 200,
      headers: {},
    });

    const result = await fetchEngineHealth();

    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    mockRequest.mockRejectedValue(new Error('Network error'));

    const result = await fetchEngineHealth();

    expect(result).toBeNull();
  });
});
