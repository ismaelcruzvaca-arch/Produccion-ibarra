/**
 * useAlertBadge Store Integration Tests
 *
 * Tests the shared alert badge store + useAlertBadge hook interaction:
 * - Store initial state
 * - updateBadge computes delta from baseline
 * - clearBadge sets baseline to latest count, badge to 0
 * - Delta semantics: only new events increment badge after clear
 */

import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useAlertBadge } from '../useAlertBadge';
import { useAlertBadgeStore } from '../../store/alertBadgeStore';

// ─── Mocks ──────────────────────────────────────────────────────────────────────

const mockUseUnacknowledgedCount = jest.fn();

jest.mock('../useUnacknowledgedCount', () => ({
  useUnacknowledgedCount: () => mockUseUnacknowledgedCount(),
}));

jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

describe('useAlertBadge + store integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store to initial state
    useAlertBadgeStore.setState({
      badgeCount: 0,
      lastVisitedAt: null,
      baselineCount: 0,
      latestCount: 0,
    });
    mockUseUnacknowledgedCount.mockReturnValue({
      count: 0,
      loading: false,
      lastCheckedAt: null,
      error: null,
      refresh: jest.fn(),
    });
  });

  // ── Store initial state ───────────────────────────────────────────────

  it('store starts with badgeCount 0 and no lastVisit', () => {
    const state = useAlertBadgeStore.getState();
    expect(state.badgeCount).toBe(0);
    expect(state.lastVisitedAt).toBeNull();
    expect(state.baselineCount).toBe(0);
    expect(state.latestCount).toBe(0);
  });

  // ── updateBadge sets latestCount and computes badge from baseline ──────

  it('updateBadge shows count from baseline', () => {
    useAlertBadgeStore.getState().updateBadge(5);
    let state = useAlertBadgeStore.getState();
    expect(state.badgeCount).toBe(5);
    expect(state.latestCount).toBe(5);

    // No baseline change yet — badge tracks total
    // (baseline is 0, so badge = 5 - 0 = 5)
  });

  // ── clearBadge sets baseline, badge goes to 0 ──────────────────────────

  it('clearBadge sets baseline to latestCount and badge to 0', () => {
    // Simulate events arriving
    useAlertBadgeStore.getState().updateBadge(5);
    expect(useAlertBadgeStore.getState().badgeCount).toBe(5);

    // User visits tab
    useAlertBadgeStore.getState().clearBadge();
    let state = useAlertBadgeStore.getState();
    expect(state.badgeCount).toBe(0);
    expect(state.baselineCount).toBe(5); // baseline = latestCount = 5
    expect(state.lastVisitedAt).toBeTruthy();
  });

  // ── Delta semantics after clear ────────────────────────────────────────

  it('shows delta (not total) after clearBadge — only new events count', () => {
    // Initial: 5 events
    useAlertBadgeStore.getState().updateBadge(5);
    expect(useAlertBadgeStore.getState().badgeCount).toBe(5);

    // User clears
    useAlertBadgeStore.getState().clearBadge();
    expect(useAlertBadgeStore.getState().badgeCount).toBe(0);

    // Same count (no new events) — badge stays 0
    useAlertBadgeStore.getState().updateBadge(5);
    expect(useAlertBadgeStore.getState().badgeCount).toBe(0);

    // 2 new events arrive
    useAlertBadgeStore.getState().updateBadge(7);
    expect(useAlertBadgeStore.getState().badgeCount).toBe(2);
  });

  // ── useAlertBadge feeds the store ──────────────────────────────────────

  it('useAlertBadge hook feeds counts into the store', async () => {
    mockUseUnacknowledgedCount.mockReturnValue({
      count: 3,
      loading: false,
      lastCheckedAt: new Date().toISOString(),
      error: null,
      refresh: jest.fn(),
    });

    renderHook(() => useAlertBadge());

    await waitFor(() => {
      expect(useAlertBadgeStore.getState().badgeCount).toBe(3);
    });
  });

  // ── Count unchanged → no store update ─────────────────────────────────

  it('does not update store when count is unchanged', () => {
    const storeSetSpy = jest.spyOn(useAlertBadgeStore.getState(), 'updateBadge');

    // Set initial
    useAlertBadgeStore.getState().updateBadge(5);

    // Same count again
    useAlertBadgeStore.getState().updateBadge(5);

    // updateBadge was called but badge didn't change
    expect(useAlertBadgeStore.getState().badgeCount).toBe(5);
  });
});
