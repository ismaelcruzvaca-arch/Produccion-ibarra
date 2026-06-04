/**
 * useUnacknowledgedCount Unit Tests
 *
 * Tests for the unacknowledged count polling hook:
 * - Returns count from query
 * - Badge condition: count > 0
 * - Zero count → no badge
 * - First poll: lastCheckedAt set, no snackbar trigger
 * - Error: silent log, no crash
 */

import { renderHook, waitFor, act } from '@testing-library/react-native';

// ─── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock('../../services/alertEngine', () => ({
  fetchUnacknowledgedCount: jest.fn(),
  getPlantId: jest.fn(),
}));

jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

import { fetchUnacknowledgedCount, getPlantId } from '../../services/alertEngine';
import { useUnacknowledgedCount } from '../useUnacknowledgedCount';

const mockFetchCount = fetchUnacknowledgedCount as jest.Mock;
const mockGetPlantId = getPlantId as jest.Mock;

describe('useUnacknowledgedCount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockGetPlantId.mockReturnValue('plant-123');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── Returns count from query ──────────────────────────────────────────

  it('starts loading and transitions to count on success', async () => {
    mockFetchCount.mockResolvedValueOnce(5);

    const { result } = renderHook(() => useUnacknowledgedCount());

    // Initially loading
    expect(result.current.loading).toBe(true);
    expect(result.current.count).toBe(0);

    // First poll should set count to 0 (first poll is silent) but lastCheckedAt should be set
    await waitFor(() => expect(result.current.loading).toBe(false));

    // First poll is silent — count stays 0, lastCheckedAt is set
    expect(result.current.count).toBe(0);
    expect(result.current.lastCheckedAt).toBeTruthy();
    expect(result.current.error).toBeNull();
  });

  // ── Returns count on subsequent polls ─────────────────────────────────

  it('returns count from subsequent polls after the first silent poll', async () => {
    // First poll (silent)
    mockFetchCount.mockResolvedValueOnce(5);
    const { result } = renderHook(() => useUnacknowledgedCount());

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Second poll — advance timer past interval
    mockFetchCount.mockResolvedValueOnce(3);
    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    await waitFor(() => expect(result.current.count).toBe(3));
  });

  // ── Zero count ────────────────────────────────────────────────────────

  it('returns 0 when there are no unacknowledged events', async () => {
    mockFetchCount.mockResolvedValueOnce(0);

    const { result } = renderHook(() => useUnacknowledgedCount());

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Second poll
    mockFetchCount.mockResolvedValueOnce(0);
    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    await waitFor(() => expect(result.current.count).toBe(0));
  });

  // ── Error: silent log, no crash ───────────────────────────────────────

  it('handles errors silently without crashing', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    mockFetchCount.mockRejectedValueOnce(new Error('Network failure'));

    const { result } = renderHook(() => useUnacknowledgedCount());

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Should not crash, should have no count
    expect(result.current.count).toBe(0);
    expect(result.current.error).toBeTruthy();
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  // ── No plantId → returns 0 ────────────────────────────────────────────

  it('returns 0 when no plant ID is available', async () => {
    mockGetPlantId.mockReturnValue(null);

    const { result } = renderHook(() => useUnacknowledgedCount());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.count).toBe(0);
    expect(mockFetchCount).not.toHaveBeenCalled();
  });
});
