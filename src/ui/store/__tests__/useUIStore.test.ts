import { useUIStore } from '../useUIStore';

describe('useUIStore', () => {
  beforeEach(() => {
    useUIStore.setState({
      pendingCount: 0,
    });
  });

  it('should initialize with pendingCount as 0', () => {
    const state = useUIStore.getState();
    expect(state.pendingCount).toBe(0);
  });

  it('should update pendingCount via setPendingCount', () => {
    useUIStore.getState().setPendingCount(5);
    expect(useUIStore.getState().pendingCount).toBe(5);
  });
});
