/**
 * Unit tests for useGatewayAlertEvents hook.
 *
 * Tests:
 * - Returns empty data initially
 * - Fetches alert events on mount with plantId
 * - Custom limit is passed to query
 * - Handles error state
 * - Refetch works
 *
 * @see tasks.md task 3.6, 3.7
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

// ─── Mock queries module ────────────────────────────────────────────────────────

const mockFetchAlertEvents = jest.fn();

jest.mock('../../graphql/gateway/queries', () => ({
  fetchAlertRules: jest.fn(),
  fetchNodes: jest.fn(),
  fetchTelemetryByNode: jest.fn(),
  fetchAlertEvents: (...args: unknown[]) => mockFetchAlertEvents(...args),
  fetchEngineHealth: jest.fn(),
}));

jest.spyOn(console, 'warn').mockImplementation(() => {});

// ─── Module Under Test ─────────────────────────────────────────────────────────

import { useGatewayAlertEvents } from '../useGatewayAlertEvents';
import { useGatewayStore } from '../../ui/store/gatewayStore';
import type { GatewayAlertEvent } from '../../graphql/gateway/types';

// ─── Fixtures ───────────────────────────────────────────────────────────────────

const MOCK_PLANT_ID = '550e8400-e29b-41d4-a716-446655440000';

const MOCK_ALERT_EVENTS: GatewayAlertEvent[] = [
  {
    id: 'evt-001',
    node_id: 'node-001',
    plant_id: MOCK_PLANT_ID,
    tipo_evento: 'SILENCE_TIMEOUT',
    mensaje: 'Node silence timeout exceeded',
    detected_at: '2026-06-01T12:00:00Z',
    dispatched: true,
    dispatch_result: 'sent',
  },
  {
    id: 'evt-002',
    node_id: 'node-002',
    plant_id: MOCK_PLANT_ID,
    tipo_evento: 'THRESHOLD_BREACH',
    mensaje: 'Temperature threshold exceeded',
    detected_at: '2026-06-01T11:55:00Z',
    dispatched: false,
    dispatch_result: undefined,
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

describe('useGatewayAlertEvents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  it('should return empty data with no error initially', () => {
    const { result } = renderHook(() => useGatewayAlertEvents(MOCK_PLANT_ID));

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
    // loading is true because useEffect fires fetch immediately
  });

  it('should fetch alert events on mount with plantId', async () => {
    mockFetchAlertEvents.mockResolvedValue(MOCK_ALERT_EVENTS);

    const { result } = renderHook(() => useGatewayAlertEvents(MOCK_PLANT_ID));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchAlertEvents).toHaveBeenCalledWith(MOCK_PLANT_ID, 50);
    expect(result.current.data).toEqual(MOCK_ALERT_EVENTS);
    expect(result.current.error).toBeNull();
  });

  it('should pass custom limit to query', async () => {
    mockFetchAlertEvents.mockResolvedValue(MOCK_ALERT_EVENTS.slice(0, 1));

    const { result } = renderHook(() => useGatewayAlertEvents(MOCK_PLANT_ID, 10));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchAlertEvents).toHaveBeenCalledWith(MOCK_PLANT_ID, 10);
    expect(result.current.data).toHaveLength(1);
  });

  it('should return error when fetch fails', async () => {
    mockFetchAlertEvents.mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => useGatewayAlertEvents(MOCK_PLANT_ID));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBe('Server error');
  });

  it('should not fetch if plantId is undefined', () => {
    renderHook(() => useGatewayAlertEvents(undefined));

    expect(mockFetchAlertEvents).not.toHaveBeenCalled();
  });

  it('should refetch when refetch is called', async () => {
    mockFetchAlertEvents.mockResolvedValue(MOCK_ALERT_EVENTS);

    const { result } = renderHook(() => useGatewayAlertEvents(MOCK_PLANT_ID));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchAlertEvents).toHaveBeenCalledTimes(1);

    mockFetchAlertEvents.mockResolvedValue(MOCK_ALERT_EVENTS);

    await act(async () => {
      result.current.refetch();
    });

    expect(mockFetchAlertEvents).toHaveBeenCalledTimes(2);
  });

  it('should handle empty event history gracefully', async () => {
    mockFetchAlertEvents.mockResolvedValue([]);

    const { result } = renderHook(() => useGatewayAlertEvents(MOCK_PLANT_ID));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
