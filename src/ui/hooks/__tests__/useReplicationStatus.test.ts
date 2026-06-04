import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { Subject } from 'rxjs';
import { useReplicationStatus } from '../useReplicationStatus';
import { useUIStore } from '../../store/useUIStore';

jest.mock('../../../data/DatabaseContext', () => ({
  useReplication: jest.fn(),
}));

import { useReplication } from '../../../data/DatabaseContext';

function createMockSubjects() {
  return {
    assets: {
      active$: new Subject<boolean>(),
      error$: new Subject<Error | undefined>(),
    },
    workOrders: {
      active$: new Subject<boolean>(),
      error$: new Subject<Error | undefined>(),
    },
    oeeEvents: {
      active$: new Subject<boolean>(),
      error$: new Subject<Error | undefined>(),
    },
  };
}

describe('useReplicationStatus', () => {
  beforeEach(() => {
    useUIStore.setState({
      isSyncing: false,
      syncStatus: 'idle',
      isOnline: true,
      lastSyncTimestamp: null,
      syncError: null,
      pendingCount: 0,
    });
    jest.clearAllMocks();
  });

  it('returns idle state when replication is undefined', () => {
    (useReplication as jest.Mock).mockReturnValue(undefined);

    const { result } = renderHook(() => useReplicationStatus());

    expect(result.current.syncStatus).toBe('idle');
    expect(result.current.isSyncing).toBe(false);
    expect(result.current.hasError).toBe(false);
    expect(result.current.lastSyncTime).toBeNull();
  });

  it('sets syncing when replication becomes active', () => {
    const subjects = createMockSubjects();
    (useReplication as jest.Mock).mockReturnValue(subjects);

    const { result } = renderHook(() => useReplicationStatus());

    act(() => {
      subjects.assets.active$.next(true);
    });

    expect(result.current.isSyncing).toBe(true);
    expect(result.current.syncStatus).toBe('syncing');
  });

  it('completes syncing when all replications become idle', () => {
    const subjects = createMockSubjects();
    (useReplication as jest.Mock).mockReturnValue(subjects);

    const { result } = renderHook(() => useReplicationStatus());

    act(() => {
      subjects.assets.active$.next(true);
      subjects.workOrders.active$.next(true);
      if (subjects.oeeEvents) subjects.oeeEvents.active$.next(true);
    });

    expect(result.current.isSyncing).toBe(true);

    act(() => {
      subjects.assets.active$.next(false);
      subjects.workOrders.active$.next(false);
      if (subjects.oeeEvents) subjects.oeeEvents.active$.next(false);
    });

    expect(result.current.isSyncing).toBe(false);
    expect(result.current.syncStatus).toBe('idle');
    expect(result.current.lastSyncTime).toBeInstanceOf(Date);
  });

  it('sets error state when replication errors', () => {
    const subjects = createMockSubjects();
    (useReplication as jest.Mock).mockReturnValue(subjects);

    const { result } = renderHook(() => useReplicationStatus());

    act(() => {
      subjects.assets.error$.next(new Error('Connection lost'));
    });

    expect(result.current.hasError).toBe(true);
    expect(result.current.syncStatus).toBe('error');
    expect(result.current.syncError).toBe('Connection lost');
  });

  it('recovers from error when setIdle is triggered', () => {
    const subjects = createMockSubjects();
    (useReplication as jest.Mock).mockReturnValue(subjects);

    const { result } = renderHook(() => useReplicationStatus());

    act(() => {
      subjects.assets.error$.next(new Error('Connection lost'));
    });

    expect(result.current.hasError).toBe(true);

    act(() => {
      useUIStore.getState().setIdle();
    });

    expect(result.current.hasError).toBe(false);
    expect(result.current.syncStatus).toBe('idle');
    expect(result.current.syncError).toBeNull();
  });

  it('handles oeeEvents replication when present', () => {
    const subjects = createMockSubjects();
    (useReplication as jest.Mock).mockReturnValue({
      ...subjects,
      oeeEvents: subjects.oeeEvents,
    });

    const { result } = renderHook(() => useReplicationStatus());

    act(() => {
      subjects.oeeEvents!.active$.next(true);
    });

    expect(result.current.isSyncing).toBe(true);
    expect(result.current.syncStatus).toBe('syncing');
  });

  it('cleans up subscriptions on unmount', () => {
    const subjects = createMockSubjects();
    (useReplication as jest.Mock).mockReturnValue(subjects);

    const { result, unmount } = renderHook(() => useReplicationStatus());

    // Emit after unmount — should not throw
    unmount();

    expect(() => {
      subjects.assets.active$.next(true);
    }).not.toThrow();
  });
});
