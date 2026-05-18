import React from 'react';
import { render } from '@testing-library/react-native';
import { OeeSelectorBar } from '../OeeSelectorBar';
import { useOeeValidation } from '../../../hooks/useOeeValidation';

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

// Mock child components
jest.mock('../LineSelector', () => ({ LineSelector: () => <></> }));
jest.mock('../MachineSelector', () => ({ MachineSelector: () => <></> }));
jest.mock('../ShiftSelector', () => ({ ShiftSelector: () => <></> }));

// Mock validation hook
jest.mock('../../../hooks/useOeeValidation');

describe('OeeSelectorBar', () => {
  it('should render warning message if validation fails', () => {
    (useOeeValidation as jest.Mock).mockReturnValue({
      isValid: false,
      message: 'Debe seleccionar una Máquina',
    });

    const { getByText } = render(<OeeSelectorBar />);
    expect(getByText('Debe seleccionar una Máquina')).toBeTruthy();
  });

  it('should not render warning if validation passes', () => {
    (useOeeValidation as jest.Mock).mockReturnValue({
      isValid: true,
      message: null,
    });

    const { queryByText } = render(<OeeSelectorBar />);
    // The warning text should not be present
    expect(queryByText(/Debe seleccionar/i)).toBeNull();
  });
});
