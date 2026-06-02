/**
 * Unit tests for useGatewayTelemetry hook.
 *
 * Tests:
 * - Returns empty data initially
 * - Fetches telemetry on mount with nodeId
 * - Handles error state
 * - Custom limit is passed to query
 * - Refetch works
 * - Returns empty for undefined nodeId
 *
 * @see tasks.md task 3.4, 3.7
 * @see spec.md FQ-4, FQ-5
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

// ─── Mock queries module ────────────────────────────────────────────────────────

const mockFetchTelemetryByNode = jest.fn();

jest.mock('../../graphql/gateway/queries', () => ({
  fetchAlertRules: jest.fn(),
  fetchNodes: jest.fn(),
  fetchTelemetryByNode: (...args: unknown[]) => mockFetchTelemetryByNode(...args),
  fetchAlertEvents: jest.fn(),
  fetchEngineHealth: jest.fn(),
}));

jest.spyOn(console, 'warn').mockImplementation(() => {});

// ─── Module Under Test ─────────────────────────────────────────────────────────

import { useGatewayTelemetry } from '../useGatewayTelemetry';
import { useGatewayStore } from '../../ui/store/gatewayStore';
import type { GatewayTelemetry } from '../../graphql/gateway/types';

// ─── Fixtures ───────────────────────────────────────────────────────────────────

const MOCK_NODE_ID = 'node-001';

const MOCK_TELEMETRY: GatewayTelemetry[] = [
  {
    id: 'tel-001',
    machine_id: 'mach-001',
    node_id: MOCK_NODE_ID,
    payload: { temperature: 42.5, humidity: 68 },
    status: 0,
    event_ts: '2026-06-01T12:00:00Z',
  },
  {
    id: 'tel-002',
    machine_id: 'mach-001',
    node_id: MOCK_NODE_ID,
    payload: { temperature: 43.1, humidity: 67 },
    status: 0,
    event_ts: '2026-06-01T11:55:00Z',
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────────

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

describe('useGatewayTelemetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  it('should return empty data with no error initially', () => {
    const { result } = renderHook(() => useGatewayTelemetry(MOCK_NODE_ID));

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
    // loading is true because useEffect fires fetch immediately
  });

  it('should fetch telemetry on mount with nodeId', async () => {
    mockFetchTelemetryByNode.mockResolvedValue(MOCK_TELEMETRY);

    const { result } = renderHook(() => useGatewayTelemetry(MOCK_NODE_ID));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchTelemetryByNode).toHaveBeenCalledWith(MOCK_NODE_ID, 50);
    expect(result.current.data).toEqual(MOCK_TELEMETRY);
    expect(result.current.error).toBeNull();
  });

  it('should pass custom limit to query', async () => {
    mockFetchTelemetryByNode.mockResolvedValue(MOCK_TELEMETRY.slice(0, 1));

    const { result } = renderHook(() => useGatewayTelemetry(MOCK_NODE_ID, 10));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchTelemetryByNode).toHaveBeenCalledWith(MOCK_NODE_ID, 10);
    expect(result.current.data).toHaveLength(1);
  });

  it('should return error when fetch fails', async () => {
    mockFetchTelemetryByNode.mockRejectedValue(new Error('Telemetry timeout'));

    const { result } = renderHook(() => useGatewayTelemetry(MOCK_NODE_ID));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBe('Telemetry timeout');
  });

  it('should return empty data for undefined nodeId', () => {
    const { result } = renderHook(() => useGatewayTelemetry(undefined));

    expect(result.current.data).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockFetchTelemetryByNode).not.toHaveBeenCalled();
  });

  it('should refetch when refetch is called', async () => {
    mockFetchTelemetryByNode.mockResolvedValue(MOCK_TELEMETRY);

    const { result } = renderHook(() => useGatewayTelemetry(MOCK_NODE_ID));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchTelemetryByNode).toHaveBeenCalledTimes(1);

    mockFetchTelemetryByNode.mockResolvedValue(MOCK_TELEMETRY);

    await act(async () => {
      result.current.refetch();
    });

    expect(mockFetchTelemetryByNode).toHaveBeenCalledTimes(2);
    expect(mockFetchTelemetryByNode).toHaveBeenLastCalledWith(MOCK_NODE_ID, 50);
  });

  it('should handle empty telemetry gracefully (FQ-5)', async () => {
    mockFetchTelemetryByNode.mockResolvedValue([]);

    const { result } = renderHook(() => useGatewayTelemetry(MOCK_NODE_ID));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
