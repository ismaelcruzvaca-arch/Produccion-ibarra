/**
 * useAlertPolling Unit Tests
 *
 * Tests for the generic polling hook:
 * - Loading → data state flow
 * - Error state propagation
 * - Polling interval
 * - Cleanup on unmount
 * - Stale response handling
 * - AppState: pause on background, catch-up on foreground
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useAlertPolling } from '../useAlertPolling';

// ─── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock('../../graphql/nhostClient', () => ({
  nhost: {
    graphql: { request: jest.fn() },
  },
}));

// Mock AppState
const mockAppStateListeners: Array<(state: AppStateStatus) => void> = [];
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn((_event, handler) => {
      mockAppStateListeners.push(handler);
      return { remove: jest.fn() };
    }),
  },
}));

import { nhost } from '../../graphql/nhostClient';
const mockRequest = nhost.graphql.request as jest.Mock;

const TEST_QUERY = 'query Test { test }';

describe('useAlertPolling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest.mockReset();
    mockAppStateListeners.length = 0;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── Loading → data state flow ─────────────────────────────────────────

  it('starts in loading state and transitions to data on success', async () => {
    mockRequest.mockResolvedValueOnce({ data: { items: [{ id: '1' }] } });

    const { result } = renderHook(() =>
      useAlertPolling<{ items: Array<{ id: string }> }>(TEST_QUERY, { plantId: 'test' }),
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual({ items: [{ id: '1' }] });
    expect(result.current.error).toBeNull();
  });

  // ── Error state propagation ───────────────────────────────────────────

  it('sets error when request fails', async () => {
    mockRequest.mockRejectedValueOnce(new Error('Network failure'));

    const { result } = renderHook(() =>
      useAlertPolling(TEST_QUERY, { plantId: 'test' }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toContain('Network failure');
  });

  it('sets error when GraphQL returns error', async () => {
    mockRequest.mockResolvedValueOnce({
      error: { message: 'GraphQL error: permission denied' },
    });

    const { result } = renderHook(() =>
      useAlertPolling(TEST_QUERY, { plantId: 'test' }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toContain('GraphQL error');
  });

  // ── Polling interval ──────────────────────────────────────────────────

  it('polls at the configured interval', async () => {
    mockRequest.mockResolvedValue({ data: { ok: true } });

    renderHook(() =>
      useAlertPolling(TEST_QUERY, { plantId: 'test' }, { pollIntervalMs: 10_000 }),
    );

    // Initial call
    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1));

    // Advance past interval
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(mockRequest).toHaveBeenCalledTimes(2);

    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(mockRequest).toHaveBeenCalledTimes(3);
  });

  // ── Cleanup on unmount ────────────────────────────────────────────────

  it('clears interval on unmount', async () => {
    mockRequest.mockResolvedValue({ data: { ok: true } });

    const { unmount } = renderHook(() =>
      useAlertPolling(TEST_QUERY, { plantId: 'test' }, { pollIntervalMs: 10_000 }),
    );

    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1));

    unmount();

    // Advance time — should not trigger additional calls
    act(() => {
      jest.advanceTimersByTime(30_000);
    });
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  // ── Stale response handling ───────────────────────────────────────────

  it('discards stale responses — only latest query result is applied', async () => {
    // Simulate two rapid requests where the first resolves AFTER the second
    let resolveSlow!: (value: unknown) => void;
    const slowPromise = new Promise((resolve) => { resolveSlow = resolve; });

    // First call (on mount) → slow request
    mockRequest.mockImplementationOnce(() => slowPromise);

    const { result } = renderHook(() =>
      useAlertPolling<{ value: string }>(TEST_QUERY, { plantId: 'test' }),
    );

    // Second call (via refetch) → fast request
    mockRequest.mockResolvedValueOnce({ data: { value: 'second' } });

    await act(async () => {
      await result.current.refetch();
    });

    // Wait for refetch to complete — data should be 'second'
    await waitFor(() => {
      expect(result.current.data).toEqual({ value: 'second' });
    });

    // Now resolve the slow (stale) first request
    await act(async () => {
      resolveSlow({ data: { value: 'first' } });
    });

    // Data should still be 'second' — the stale response was discarded
    expect(result.current.data).toEqual({ value: 'second' });
  });

  // ── AppState: catch-up on foreground ──────────────────────────────────

  it('fires catch-up poll when returning to foreground', async () => {
    mockRequest.mockResolvedValue({ data: { ok: true } });

    renderHook(() =>
      useAlertPolling(TEST_QUERY, { plantId: 'test' }),
    );

    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1));
    jest.clearAllMocks();

    // Simulate going to background
    act(() => {
      mockAppStateListeners.forEach((handler) => handler('background'));
    });

    // Coming back to foreground
    act(() => {
      mockAppStateListeners.forEach((handler) => handler('active'));
    });

    // Should have fired a catch-up poll
    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1));
  });
});
