import { renderHook } from '@testing-library/react-native';
import { useOeeValidation } from '../../ui/hooks/useOeeValidation';
import { useCatalogStore } from '../../ui/store/catalogStore';

jest.mock('../../graphql/nhostClient', () => ({
  nhost: {
    graphql: { request: jest.fn() },
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../../ui/store/catalogStore');

describe('useOeeValidation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return invalid if no selections made', () => {
    const state = { selectedLine: null, selectedMachine: null, selectedShift: null };
    (useCatalogStore as unknown as jest.Mock).mockImplementation((selector) => selector(state));

    const { result } = renderHook(() => useOeeValidation());
    expect(result.current.isValid).toBe(false);
    expect(result.current.message).toBe('Seleccione línea, máquina y turno para iniciar');
  });

  it('should return invalid if any selection is missing', () => {
    const state = { selectedLine: 'line-1', selectedMachine: 'machine-1', selectedShift: null };
    (useCatalogStore as unknown as jest.Mock).mockImplementation((selector) => selector(state));

    const { result } = renderHook(() => useOeeValidation());
    expect(result.current.isValid).toBe(false);
    expect(result.current.message).toBe('Seleccione línea, máquina y turno para iniciar');
  });

  it('should return valid if all fields are selected', () => {
    const state = { selectedLine: 'line-1', selectedMachine: 'machine-1', selectedShift: 'shift-1' };
    (useCatalogStore as unknown as jest.Mock).mockImplementation((selector) => selector(state));

    const { result } = renderHook(() => useOeeValidation());
    expect(result.current.isValid).toBe(true);
    expect(result.current.message).toBeNull();
  });
});
