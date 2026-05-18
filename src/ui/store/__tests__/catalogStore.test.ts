import { useCatalogStore } from '../catalogStore';

jest.mock('../../../graphql/nhostClient', () => ({
  nhost: {
    graphql: {
      request: jest.fn(),
    },
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('catalogStore', () => {
  beforeEach(() => {
    // Reset Zustand store state before each test
    useCatalogStore.setState({
      lines: [],
      machines: [],
      shifts: [],
      products: [],
      stopReasons: [],
      selectedLine: null,
      selectedMachine: null,
      selectedShift: null,
      selectedProduct: null,
      lastFetchedAt: null,
      isLoading: false,
      error: null,
    });
  });

  it('should initialize with selectedMachine and selectedShift as null', () => {
    const state = useCatalogStore.getState();
    expect(state.selectedMachine).toBeNull();
    expect(state.selectedShift).toBeNull();
  });

  it('should update selectedMachine via setSelectedMachine', () => {
    useCatalogStore.getState().setSelectedMachine('machine-123');
    expect(useCatalogStore.getState().selectedMachine).toBe('machine-123');
  });

  it('should update selectedShift via setSelectedShift', () => {
    useCatalogStore.getState().setSelectedShift('shift-456');
    expect(useCatalogStore.getState().selectedShift).toBe('shift-456');
  });

  it('should include selectedMachine and selectedShift in persist partialize', () => {
    useCatalogStore.getState().setSelectedMachine('m1');
    useCatalogStore.getState().setSelectedShift('s1');
    
    const state = useCatalogStore.getState();
    expect(state.selectedMachine).toBe('m1');
    expect(state.selectedShift).toBe('s1');
  });

  // ─── Wave 8: selectedProduct tests ────────────────────────────────────────────

  it('should initialize selectedProduct as null', () => {
    const state = useCatalogStore.getState();
    expect(state.selectedProduct).toBeNull();
  });

  it('should update selectedProduct via setSelectedProduct', () => {
    useCatalogStore.getState().setSelectedProduct('product-abc');
    expect(useCatalogStore.getState().selectedProduct).toBe('product-abc');
  });

  it('should reset selectedProduct to null when setSelectedLine is called', () => {
    useCatalogStore.getState().setSelectedProduct('product-abc');
    useCatalogStore.getState().setSelectedLine('line-1');
    expect(useCatalogStore.getState().selectedProduct).toBeNull();
  });

  it('should reset selectedProduct to null when setSelectedMachine is called', () => {
    useCatalogStore.getState().setSelectedProduct('product-abc');
    useCatalogStore.getState().setSelectedMachine('machine-1');
    expect(useCatalogStore.getState().selectedProduct).toBeNull();
  });

  it('should return product by id via getProductById', () => {
    useCatalogStore.setState({
      products: [
        { id: 'p1', code: 'CHOC-500', name: 'Chocolate 500g', theoretical_ppm: 2.5, is_active: true },
        { id: 'p2', code: 'CHOC-250', name: 'Chocolate 250g', theoretical_ppm: 4.0, is_active: true },
      ],
    });
    const found = useCatalogStore.getState().getProductById('p1');
    expect(found?.code).toBe('CHOC-500');
    expect(found?.theoretical_ppm).toBe(2.5);
  });

  it('getProductById returns undefined for unknown id', () => {
    const found = useCatalogStore.getState().getProductById('nonexistent');
    expect(found).toBeUndefined();
  });
});
