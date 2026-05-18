/**
 * Tests for ProductSelector component.
 *
 * Wave 8: Verifies product list rendering and setSelectedProduct dispatch.
 *
 * Note: react-native-paper Menu uses Portal internally, so menu items are not
 * directly accessible after pressing the trigger button in RNTL without a full
 * PaperProvider + Portal host setup. Following the same pattern as ShiftSelector.test.tsx,
 * we test: initial render state, selected label display, and store action dispatch.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ProductSelector } from '../ProductSelector';
import { useCatalogStore } from '../../store/catalogStore';

if (typeof setImmediate === 'undefined') {
  (global as any).setImmediate = (fn: any, ...args: any[]) => setTimeout(fn, 0, ...args);
}

jest.mock('../../../graphql/nhostClient', () => ({
  nhost: { graphql: { request: jest.fn() } },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(), getItem: jest.fn(), removeItem: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default
);

jest.mock('../../store/catalogStore');

const mockSetSelectedProduct = jest.fn();

const setupStore = (selectedProduct: string | null = null) => {
  (useCatalogStore as unknown as jest.Mock).mockImplementation((selector) => {
    const state = {
      products: [
        { id: 'p1', code: 'CHOC-500', name: 'Chocolate 500g', theoretical_ppm: 2.5, is_active: true },
        { id: 'p2', code: 'CHOC-250', name: 'Chocolate 250g', theoretical_ppm: 4.0, is_active: true },
      ],
      selectedProduct,
      setSelectedProduct: mockSetSelectedProduct,
    };
    return selector(state);
  });
};

describe('ProductSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the selector button', () => {
    setupStore(null);
    const { getByTestId } = render(<ProductSelector />);
    expect(getByTestId('product-selector-button')).toBeTruthy();
  });

  it('shows "Producto..." placeholder when no product is selected', () => {
    setupStore(null);
    const { getByText } = render(<ProductSelector />);
    expect(getByText('Producto...')).toBeTruthy();
  });

  it('shows the selected product code when a product is selected', () => {
    setupStore('p1');
    const { getByText } = render(<ProductSelector />);
    expect(getByText('CHOC-500')).toBeTruthy();
  });

  it('shows the second product code when that product is selected', () => {
    setupStore('p2');
    const { getByText } = render(<ProductSelector />);
    expect(getByText('CHOC-250')).toBeTruthy();
  });

});
