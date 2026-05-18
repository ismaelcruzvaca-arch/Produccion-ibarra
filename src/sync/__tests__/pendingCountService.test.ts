import { startPendingCountService } from '../pendingCountService';
import { useUIStore } from '../../ui/store/useUIStore';
import { Subject } from 'rxjs';

// Mock the UI store
jest.mock('../../ui/store/useUIStore', () => ({
  useUIStore: {
    getState: jest.fn(() => ({
      setPendingCount: jest.fn(),
    })),
  },
}));

describe('pendingCountService', () => {
  it('should subscribe to oee_events and update pending count in useUIStore', () => {
    // Setup mock observable
    const mockEvents$ = new Subject<any[]>();
    
    // Mock the db
    const mockDb = {
      collections: {
        oee_events: {
          find: jest.fn().mockReturnValue({
            $: mockEvents$,
          }),
        },
      },
    };

    const mockSetPendingCount = jest.fn();
    (useUIStore.getState as jest.Mock).mockReturnValue({
      setPendingCount: mockSetPendingCount,
    });

    // Start service
    const subscription = startPendingCountService(mockDb as any);

    // Emit 3 "unsynced" events (for this test, we just count them)
    mockEvents$.next([{ id: 1 }, { id: 2 }, { id: 3 }]);

    expect(mockDb.collections.oee_events.find).toHaveBeenCalled();
    expect(mockSetPendingCount).toHaveBeenCalledWith(3);

    // Cleanup
    subscription.unsubscribe();
  });
});
