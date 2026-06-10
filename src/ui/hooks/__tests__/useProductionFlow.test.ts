import { useProductionFlow } from '../useProductionFlow';

describe('useProductionFlow — simplified shift context store', () => {
  beforeEach(() => {
    useProductionFlow.setState({
      shiftSessionId: null,
      isShiftActive: false,
      isLoading: true,
    });
  });

  describe('state', () => {
    it('starts with no active shift', () => {
      const state = useProductionFlow.getState();
      expect(state.shiftSessionId).toBeNull();
      expect(state.isShiftActive).toBe(false);
      expect(state.isLoading).toBe(true);
    });
  });

  describe('startShift', () => {
    it('sets shiftSessionId and marks shift as active', () => {
      useProductionFlow.getState().startShift('session-123');

      const state = useProductionFlow.getState();
      expect(state.shiftSessionId).toBe('session-123');
      expect(state.isShiftActive).toBe(true);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('endShift', () => {
    it('clears shiftSessionId and marks shift as inactive', () => {
      useProductionFlow.getState().startShift('session-123');
      useProductionFlow.getState().endShift();

      const state = useProductionFlow.getState();
      expect(state.shiftSessionId).toBeNull();
      expect(state.isShiftActive).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('reset', () => {
    it('clears all state like endShift', () => {
      useProductionFlow.getState().startShift('session-123');
      useProductionFlow.getState().reset();

      const state = useProductionFlow.getState();
      expect(state.shiftSessionId).toBeNull();
      expect(state.isShiftActive).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });
});
