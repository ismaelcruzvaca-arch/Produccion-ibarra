/**
 * Unit tests for useGatewayHealth hook.
 *
 * Tests:
 * - Returns null data initially
 * - Fetches engine health on mount
 * - Handles null response (no health record)
 * - Handles error state
 * - Refetch works
 *
 * @see tasks.md task 3.5, 3.7
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

// ─── Mock queries module ────────────────────────────────────────────────────────

const mockFetchEngineHealth = jest.fn();

jest.mock('../../graphql/gateway/queries', () => ({
  fetchAlertRules: jest.fn(),
  fetchNodes: jest.fn(),
  fetchTelemetryByNode: jest.fn(),
  fetchAlertEvents: jest.fn(),
  fetchEngineHealth: (...args: unknown[]) => mockFetchEngineHealth(...args),
}));

jest.spyOn(console, 'warn').mockImplementation(() => {});

// ─── Module Under Test ─────────────────────────────────────────────────────────

import { useGatewayHealth } from '../useGatewayHealth';
import { useGatewayStore } from '../../ui/store/gatewayStore';
import type { GatewayEngineHealth } from '../../graphql/gateway/types';

// ─── Fixtures ───────────────────────────────────────────────────────────────────

const MOCK_ENGINE_HEALTH: GatewayEngineHealth = {
  check_id: 'chk-001',
  checked_at: '2026-06-01T12:00:00Z',
  latency_ms: 42,
  success: true,
  detail: 'All systems operational',
};

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

describe('useGatewayHealth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  it('should return null data with no error initially', () => {
    const { result } = renderHook(() => useGatewayHealth());

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    // loading is true because useEffect fires fetch immediately
  });

  it('should fetch engine health on mount', async () => {
    mockFetchEngineHealth.mockResolvedValue(MOCK_ENGINE_HEALTH);

    const { result } = renderHook(() => useGatewayHealth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchEngineHealth).toHaveBeenCalledWith();
    expect(result.current.data).toEqual(MOCK_ENGINE_HEALTH);
    expect(result.current.error).toBeNull();
  });

  it('should handle null response (no health record)', async () => {
    mockFetchEngineHealth.mockResolvedValue(null);

    const { result } = renderHook(() => useGatewayHealth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should return error when fetch fails', async () => {
    mockFetchEngineHealth.mockRejectedValue(new Error('Engine unreachable'));

    const { result } = renderHook(() => useGatewayHealth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Engine unreachable');
  });

  it('should refetch when refetch is called', async () => {
    mockFetchEngineHealth.mockResolvedValue(MOCK_ENGINE_HEALTH);

    const { result } = renderHook(() => useGatewayHealth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchEngineHealth).toHaveBeenCalledTimes(1);

    mockFetchEngineHealth.mockResolvedValue(MOCK_ENGINE_HEALTH);

    await act(async () => {
      result.current.refetch();
    });

    expect(mockFetchEngineHealth).toHaveBeenCalledTimes(2);
  });
});
