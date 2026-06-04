import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { NumpadModal } from '../NumpadModal';
import { OEE_LIMITS } from '../../../config/oeeLimits';

const wrap = (node: React.ReactNode) => (
  <PaperProvider>{node}</PaperProvider>
);

describe('NumpadModal', () => {
  const mockSubmit = jest.fn();
  const mockDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly when visible is true', () => {
    const { getByText, getByTestId } = render(
      wrap(
        <NumpadModal
          visible={true}
          title="Registrar Cajas"
          onDismiss={mockDismiss}
          onSubmit={mockSubmit}
        />
      )
    );

    expect(getByText('Registrar Cajas')).toBeTruthy();
    expect(getByTestId('numpad-display-text').props.children).toEqual(['0', ' cajas']);
  });

  it('handles numerical inputs sequentially', () => {
    const { getByTestId } = render(
      wrap(
        <NumpadModal
          visible={true}
          title="Registrar Cajas"
          onDismiss={mockDismiss}
          onSubmit={mockSubmit}
        />
      )
    );

    fireEvent.press(getByTestId('numpad-key-5'));
    fireEvent.press(getByTestId('numpad-key-2'));
    fireEvent.press(getByTestId('numpad-key-0'));

    expect(getByTestId('numpad-display-text').props.children).toEqual(['520', ' cajas']);
  });

  it('performs backspace and clears values correctly', () => {
    const { getByTestId } = render(
      wrap(
        <NumpadModal
          visible={true}
          title="Registrar Cajas"
          onDismiss={mockDismiss}
          onSubmit={mockSubmit}
        />
      )
    );

    fireEvent.press(getByTestId('numpad-key-9'));
    fireEvent.press(getByTestId('numpad-key-8'));
    expect(getByTestId('numpad-display-text').props.children).toEqual(['98', ' cajas']);

    fireEvent.press(getByTestId('numpad-key-backspace'));
    expect(getByTestId('numpad-display-text').props.children).toEqual(['9', ' cajas']);

    fireEvent.press(getByTestId('numpad-key-clear'));
    expect(getByTestId('numpad-display-text').props.children).toEqual(['0', ' cajas']);
  });

  it('disables registration when input is 0 or less', () => {
    const { getByTestId } = render(
      wrap(
        <NumpadModal
          visible={true}
          title="Registrar Cajas"
          onDismiss={mockDismiss}
          onSubmit={mockSubmit}
        />
      )
    );

    const submitBtn = getByTestId('numpad-submit');
    expect(submitBtn.props.accessibilityState.disabled).toBe(true);
  });

  it('disables submit and shows error warning when hardLimit is exceeded', () => {
    const { getByTestId, queryByTestId } = render(
      wrap(
        <NumpadModal
          visible={true}
          title="Registrar Cajas"
          onDismiss={mockDismiss}
          onSubmit={mockSubmit}
        />
      )
    );

    // Enter high value: 100,000 (exceeds DEFAULT_HARD_LIMIT = 99,999)
    fireEvent.press(getByTestId('numpad-key-1'));
    fireEvent.press(getByTestId('numpad-key-0'));
    fireEvent.press(getByTestId('numpad-key-0'));
    fireEvent.press(getByTestId('numpad-key-0'));
    fireEvent.press(getByTestId('numpad-key-0'));
    fireEvent.press(getByTestId('numpad-key-0'));

    expect(getByTestId('numpad-display-text').props.children).toEqual(['100,000', ' cajas']);
    expect(getByTestId('numpad-warning-text')).toBeTruthy();
    expect(getByTestId('numpad-submit').props.accessibilityState.disabled).toBe(true);
  });

  it('submits valid values within bounds', () => {
    const { getByTestId } = render(
      wrap(
        <NumpadModal
          visible={true}
          title="Registrar Cajas"
          onDismiss={mockDismiss}
          onSubmit={mockSubmit}
        />
      )
    );

    fireEvent.press(getByTestId('numpad-key-7'));
    fireEvent.press(getByTestId('numpad-key-5'));

    const submitBtn = getByTestId('numpad-submit');
    expect(submitBtn.props.accessibilityState.disabled).toBe(false);

    fireEvent.press(submitBtn);
    expect(mockSubmit).toHaveBeenCalledWith(75);
  });

  it('triggers onDismiss when cancel button is clicked', () => {
    const { getByTestId } = render(
      wrap(
        <NumpadModal
          visible={true}
          title="Registrar Cajas"
          onDismiss={mockDismiss}
          onSubmit={mockSubmit}
        />
      )
    );

    fireEvent.press(getByTestId('numpad-cancel'));
    expect(mockDismiss).toHaveBeenCalled();
  });
});
