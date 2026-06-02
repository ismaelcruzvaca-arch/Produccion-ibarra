/**
 * Unit tests for useGatewayNodes hook.
 *
 * Tests:
 * - Returns empty data initially
 * - Fetches nodes on mount with plantId
 * - Handles error state
 * - Refetch works
 *
 * @see tasks.md task 3.3, 3.7
 * @see spec.md FQ-3
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

// ─── Mock queries module ────────────────────────────────────────────────────────

const mockFetchNodes = jest.fn();

jest.mock('../../graphql/gateway/queries', () => ({
  fetchAlertRules: jest.fn(),
  fetchNodes: (...args: unknown[]) => mockFetchNodes(...args),
  fetchTelemetryByNode: jest.fn(),
  fetchAlertEvents: jest.fn(),
  fetchEngineHealth: jest.fn(),
}));

jest.spyOn(console, 'warn').mockImplementation(() => {});

// ─── Module Under Test ─────────────────────────────────────────────────────────

import { useGatewayNodes } from '../useGatewayNodes';
import { useGatewayStore } from '../../ui/store/gatewayStore';
import type { GatewayNode } from '../../graphql/gateway/types';

// ─── Fixtures ───────────────────────────────────────────────────────────────────

const MOCK_PLANT_ID = '550e8400-e29b-41d4-a716-446655440000';

const MOCK_NODES: GatewayNode[] = [
  {
    id: 'node-001',
    node_ident: 'GW-NORVI-001',
    machine_id: 'mach-001',
    device_model: {
      model_name: 'NORVI-IIOT-A01',
      model_capabilities: [
        { alert_capability: { capability_key: 'vibration', description: 'Vibration' } },
      ],
    },
    machine: { name: 'Toaster 1', line: { name: 'Line 1', plant_id: MOCK_PLANT_ID } },
  },
  {
    id: 'node-002',
    node_ident: 'GW-NORVI-002',
    machine_id: 'mach-002',
    device_model: {
      model_name: 'NORVI-IIOT-A02',
      model_capabilities: [],
    },
    machine: { name: 'Mixer 1', line: { name: 'Line 1', plant_id: MOCK_PLANT_ID } },
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

describe('useGatewayNodes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  it('should return empty data with no error initially', () => {
    const { result } = renderHook(() => useGatewayNodes(MOCK_PLANT_ID));

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
    // loading is true because useEffect fires fetch immediately
  });

  it('should fetch nodes on mount with plantId', async () => {
    mockFetchNodes.mockResolvedValue(MOCK_NODES);

    const { result } = renderHook(() => useGatewayNodes(MOCK_PLANT_ID));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchNodes).toHaveBeenCalledWith(MOCK_PLANT_ID);
    expect(result.current.data).toEqual(MOCK_NODES);
    expect(result.current.error).toBeNull();
  });

  it('should return error when fetch fails', async () => {
    mockFetchNodes.mockRejectedValue(new Error('Gateway timeout'));

    const { result } = renderHook(() => useGatewayNodes(MOCK_PLANT_ID));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBe('Gateway timeout');
  });

  it('should not fetch if plantId is undefined', () => {
    renderHook(() => useGatewayNodes(undefined));

    expect(mockFetchNodes).not.toHaveBeenCalled();
  });

  it('should refetch when refetch is called', async () => {
    mockFetchNodes.mockResolvedValue(MOCK_NODES);

    const { result } = renderHook(() => useGatewayNodes(MOCK_PLANT_ID));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchNodes).toHaveBeenCalledTimes(1);

    mockFetchNodes.mockResolvedValue(MOCK_NODES);

    await act(async () => {
      result.current.refetch();
    });

    expect(mockFetchNodes).toHaveBeenCalledTimes(2);
  });

  it('should handle empty fetch gracefully', async () => {
    mockFetchNodes.mockResolvedValue([]);

    const { result } = renderHook(() => useGatewayNodes(MOCK_PLANT_ID));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
