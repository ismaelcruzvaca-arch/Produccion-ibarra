import { renderHook, act } from '@testing-library/react-native';
import { useDowntimeTimer } from '../useDowntimeTimer';

describe('useDowntimeTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1700000000000);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns 0 duration when isActive is false', () => {
    const { result } = renderHook(() =>
      useDowntimeTimer({
        startTime: 1700000000000 - 5000,
        isActive: false,
      }),
    );

    expect(result.current.duration).toBe(0);
    expect(result.current.formattedDuration).toBe('00:00:00');
  });

  it('returns 0 duration when startTime is null', () => {
    const { result } = renderHook(() =>
      useDowntimeTimer({
        startTime: null,
        isActive: true,
      }),
    );

    expect(result.current.duration).toBe(0);
    expect(result.current.formattedDuration).toBe('00:00:00');
  });

  it('returns 0 duration when startTime is 0', () => {
    const { result } = renderHook(() =>
      useDowntimeTimer({
        startTime: 0,
        isActive: true,
      }),
    );

    expect(result.current.duration).toBe(0);
    expect(result.current.formattedDuration).toBe('00:00:00');
  });

  it('computes initial duration when active', () => {
    const startTime = 1700000000000 - 10000; // 10 seconds ago

    const { result } = renderHook(() =>
      useDowntimeTimer({
        startTime,
        isActive: true,
      }),
    );

    // Duration should be ~10000ms (may vary slightly in edge cases)
    expect(result.current.duration).toBeGreaterThanOrEqual(9000);
    expect(result.current.duration).toBeLessThanOrEqual(11000);
  });

  it('updates duration over time via interval', () => {
    const startTime = 1700000000000 - 5000; // 5 seconds ago

    const { result } = renderHook(() =>
      useDowntimeTimer({
        startTime,
        isActive: true,
      }),
    );

    const initialDuration = result.current.duration;

    // Advance by 3 seconds
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.duration).toBe(initialDuration + 3000);
  });

  it('formats duration as HH:MM:SS', () => {
    const startTime = 1700000000000 - 3661000; // 1h 1m 1s

    const { result } = renderHook(() =>
      useDowntimeTimer({
        startTime,
        isActive: true,
      }),
    );

    // 3661 seconds = 1h 1m 1s → "01:01:01"
    expect(result.current.formattedDuration).toBe('01:01:01');
  });

  it('formats zero duration correctly', () => {
    const { result } = renderHook(() =>
      useDowntimeTimer({
        startTime: 1700000000000,
        isActive: true,
      }),
    );

    expect(result.current.formattedDuration).toBe('00:00:00');
  });

  it('resets to 0 when deactivated mid-timer', () => {
    const startTime = 1700000000000 - 10000;

    const { result, rerender } = renderHook(
      ({ startTime, isActive }: { startTime: number | null; isActive: boolean }) =>
        useDowntimeTimer({ startTime, isActive }),
      {
        initialProps: { startTime, isActive: true },
      },
    );

    expect(result.current.duration).toBeGreaterThan(0);

    // Deactivate
    rerender({ startTime, isActive: false });

    expect(result.current.duration).toBe(0);
    expect(result.current.formattedDuration).toBe('00:00:00');
  });

  it('stops counting when deactivated then reactivated recalculates', () => {
    const startTime = 1700000000000 - 10000;

    const { result, rerender } = renderHook(
      ({ startTime, isActive }: { startTime: number | null; isActive: boolean }) =>
        useDowntimeTimer({ startTime, isActive }),
      {
        initialProps: { startTime, isActive: true },
      },
    );

    const durationBefore = result.current.duration;

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    const durationAfterAdvance = result.current.duration;
    expect(durationAfterAdvance).toBe(durationBefore + 5000);

    // Deactivate — resets to 0
    rerender({ startTime, isActive: false });
    expect(result.current.duration).toBe(0);

    // Reactivate — recalculates from now
    rerender({ startTime: 1700000000000 - 20000, isActive: true });
    expect(result.current.duration).toBeGreaterThan(0);
  });
});
