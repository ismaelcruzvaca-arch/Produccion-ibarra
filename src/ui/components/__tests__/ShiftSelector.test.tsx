import React from 'react';
import { render } from '@testing-library/react-native';
import { ShiftSelector } from '../ShiftSelector';
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

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../../store/catalogStore');

describe('ShiftSelector', () => {
  it('should render the selected shift label', () => {
    (useCatalogStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = {
        shifts: [
          { id: 's1', label: 'Turno 1', is_active: true },
          { id: 's2', label: 'Turno 2', is_active: true },
        ],
        selectedShift: 's2',
        setSelectedShift: jest.fn(),
      };
      return selector(state);
    });

    const { getByText } = render(<ShiftSelector />);
    expect(getByText('Turno 2')).toBeTruthy();
  });

  it('should display a placeholder when no shift is selected', () => {
    (useCatalogStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = {
        shifts: [],
        selectedShift: null,
        setSelectedShift: jest.fn(),
      };
      return selector(state);
    });

    const { getByText } = render(<ShiftSelector />);
    expect(getByText('Seleccionar Turno...')).toBeTruthy();
  });
});
