import { renderHook } from '@testing-library/react-native';
import { useOeeValidation } from '../useOeeValidation';
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

  it('should return invalid if line is not selected', () => {
    const state = { selectedLine: null, selectedMachine: null, selectedShift: null };
    (useCatalogStore as unknown as jest.Mock).mockImplementation((selector) => selector(state));

    const { result } = renderHook(() => useOeeValidation());
    expect(result.current.isValid).toBe(false);
    expect(result.current.message).toBe('Debe seleccionar una Línea');
  });

  it('should return invalid if machine is not selected', () => {
    const state = { selectedLine: 'line-1', selectedMachine: null, selectedShift: null };
    (useCatalogStore as unknown as jest.Mock).mockImplementation((selector) => selector(state));

    const { result } = renderHook(() => useOeeValidation());
    expect(result.current.isValid).toBe(false);
    expect(result.current.message).toBe('Debe seleccionar una Máquina');
  });

  it('should return invalid if shift is not selected', () => {
    const state = { selectedLine: 'line-1', selectedMachine: 'machine-1', selectedShift: null };
    (useCatalogStore as unknown as jest.Mock).mockImplementation((selector) => selector(state));

    const { result } = renderHook(() => useOeeValidation());
    expect(result.current.isValid).toBe(false);
    expect(result.current.message).toBe('Debe seleccionar un Turno');
  });

  it('should return valid if all fields are selected', () => {
    const state = { selectedLine: 'line-1', selectedMachine: 'machine-1', selectedShift: 'shift-1' };
    (useCatalogStore as unknown as jest.Mock).mockImplementation((selector) => selector(state));

    const { result } = renderHook(() => useOeeValidation());
    expect(result.current.isValid).toBe(true);
    expect(result.current.message).toBeNull();
  });
});
