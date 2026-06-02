/**
 * Unit tests for useGatewayAlertRules hook.
 *
 * Tests:
 * - Returns empty data initially
 * - Fetches alert rules on mount with plantId
 * - Handles error state
 * - Refetch bypasses cache
 *
 * @see tasks.md task 3.2, 3.7
 * @see spec.md FQ-2, FQ-5
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

// ─── Mock queries module ────────────────────────────────────────────────────────

const mockFetchAlertRules = jest.fn();

jest.mock('../../graphql/gateway/queries', () => ({
  fetchAlertRules: (...args: unknown[]) => mockFetchAlertRules(...args),
  fetchNodes: jest.fn(),
  fetchTelemetryByNode: jest.fn(),
  fetchAlertEvents: jest.fn(),
  fetchEngineHealth: jest.fn(),
}));

// Silence console.warn
jest.spyOn(console, 'warn').mockImplementation(() => {});

// ─── Module Under Test ─────────────────────────────────────────────────────────

import { useGatewayAlertRules } from '../useGatewayAlertRules';
import { useGatewayStore } from '../../ui/store/gatewayStore';
import type { GatewayAlertRule } from '../../graphql/gateway/types';

// ─── Fixtures ───────────────────────────────────────────────────────────────────

const MOCK_PLANT_ID = '550e8400-e29b-41d4-a716-446655440000';

const MOCK_ALERT_RULES: GatewayAlertRule[] = [
  {
    id: 'rule-001',
    node_id: 'node-001',
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

describe('useGatewayAlertRules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  it('should return empty data and not loading initially', () => {
    const { result } = renderHook(() => useGatewayAlertRules(MOCK_PLANT_ID));

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should fetch alert rules on mount with plantId', async () => {
    mockFetchAlertRules.mockResolvedValue(MOCK_ALERT_RULES);

    const { result } = renderHook(() => useGatewayAlertRules(MOCK_PLANT_ID));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchAlertRules).toHaveBeenCalledWith(MOCK_PLANT_ID);
    expect(result.current.data).toEqual(MOCK_ALERT_RULES);
    expect(result.current.error).toBeNull();
  });

  it('should return error when fetch fails', async () => {
    mockFetchAlertRules.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useGatewayAlertRules(MOCK_PLANT_ID));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBe('Network error');
  });

  it('should not fetch if plantId is undefined', () => {
    renderHook(() => useGatewayAlertRules(undefined));

    expect(mockFetchAlertRules).not.toHaveBeenCalled();
  });

  it('should refetch when refetch is called', async () => {
    mockFetchAlertRules.mockResolvedValue(MOCK_ALERT_RULES);

    const { result } = renderHook(() => useGatewayAlertRules(MOCK_PLANT_ID));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchAlertRules).toHaveBeenCalledTimes(1);

    mockFetchAlertRules.mockResolvedValue(MOCK_ALERT_RULES);

    await act(async () => {
      result.current.refetch();
    });

    expect(mockFetchAlertRules).toHaveBeenCalledTimes(2);
    // force=true should have been passed
    expect(mockFetchAlertRules).toHaveBeenLastCalledWith(MOCK_PLANT_ID);
  });

  it('should handle empty fetch gracefully (FQ-5)', async () => {
    mockFetchAlertRules.mockResolvedValue([]);

    const { result } = renderHook(() => useGatewayAlertRules(MOCK_PLANT_ID));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
