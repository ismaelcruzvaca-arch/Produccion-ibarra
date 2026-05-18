import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { LineSelector } from '../LineSelector';
import { useCatalogStore } from '../../store/catalogStore';

if (typeof setImmediate === 'undefined') {
  (global as any).setImmediate = (fn: any, ...args: any[]) => setTimeout(fn, 0, ...args);
}

jest.mock('../../../graphql/nhostClient', () => ({
  nhost: {
    graphql: { request: jest.fn() },
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

jest.mock('../../store/catalogStore');

describe('LineSelector', () => {
  it('should render the selected line label', () => {
    (useCatalogStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = {
        lines: [
          { id: 'l1', name: 'Linea 1', is_active: true },
          { id: 'l2', name: 'Linea 2', is_active: true },
        ],
        selectedLine: 'l2',
        setSelectedLine: jest.fn(),
      };
      return selector(state);
    });

    const { getByText } = render(<LineSelector />);
    expect(getByText('Linea 2')).toBeTruthy();
  });

  it('should display a placeholder when no line is selected', () => {
    (useCatalogStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = {
        lines: [],
        selectedLine: null,
        setSelectedLine: jest.fn(),
      };
      return selector(state);
    });

    const { getByText } = render(<LineSelector />);
    expect(getByText('Seleccionar Línea...')).toBeTruthy();
  });
});
