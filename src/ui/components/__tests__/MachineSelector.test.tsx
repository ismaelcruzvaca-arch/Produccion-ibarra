import React from 'react';
import { render } from '@testing-library/react-native';
import { MachineSelector } from '../MachineSelector';
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

describe('MachineSelector', () => {
  it('should render the selected machine label', () => {
    (useCatalogStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = {
        machines: [
          { id: 'm1', name: 'Máquina 1', line_id: 'l1', is_active: true },
          { id: 'm2', name: 'Máquina 2', line_id: 'l1', is_active: true },
        ],
        selectedLine: 'l1',
        selectedMachine: 'm1',
        setSelectedMachine: jest.fn(),
      };
      return selector(state);
    });

    const { getByText } = render(<MachineSelector />);
    expect(getByText('Máquina 1')).toBeTruthy();
  });

  it('should be disabled if no line is selected', () => {
    (useCatalogStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = {
        machines: [],
        selectedLine: null,
        selectedMachine: null,
        setSelectedMachine: jest.fn(),
      };
      return selector(state);
    });

    const { getByText } = render(<MachineSelector />);
    expect(getByText('Seleccionar Máquina...')).toBeTruthy();
  });
});
