/**
 * WeightInput unit tests.
 *
 * Spec compliance:
 * - QC-3: MUST validate weight against cached product_weight_standards
 * - QC-8: SHALL pass with warning when standard missing
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { PaperProvider } from 'react-native-paper';
import { WeightInput } from '../molecules/WeightInput';

// ─── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock('../../../graphql/nhostClient', () => ({
  nhost: { graphql: { request: jest.fn() } },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(), getItem: jest.fn(), removeItem: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default
);

// ─── Helpers ────────────────────────────────────────────────────────────────────

function renderInput(overrides: Record<string, any> = {}) {
  const props = {
    visible: true,
    sku: 'test-sku',
    onDismiss: jest.fn(),
    onValidated: jest.fn(),
    value: null,
    onChangeValue: jest.fn(),
    ...overrides,
  };

  return {
    ...render(
      <PaperProvider>
        <WeightInput {...props} />
      </PaperProvider>
    ),
    props,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('WeightInput', () => {
  it('renders title "Peso (kg)"', () => {
    const { getByText } = renderInput();
    expect(getByText('Peso (kg)')).toBeTruthy();
  });

  it('renders standard range chip when standardMin and standardMax provided', () => {
    const { getByText } = renderInput({ standardMin: 10, standardMax: 20 });

    expect(getByText('Estándar: 10 – 20 kg')).toBeTruthy();
  });

  it('renders warning chip when no standard provided', () => {
    const { getByText } = renderInput();

    expect(getByText('Sin estándar configurado — pase con advertencia')).toBeTruthy();
  });

  it('does not render standard chip when only min is provided', () => {
    // Component only shows standard chip when BOTH min and max are defined
    const { queryByText } = renderInput({ standardMin: 10 });

    expect(queryByText(/Estándar/)).toBeNull();
  });

  it('shows validation error when weight is outside standard range', () => {
    const { getByText, getByPlaceholderText } = renderInput({
      standardMin: 10,
      standardMax: 20,
    });

    const input = getByPlaceholderText('0.00');
    fireEvent.changeText(input, '25');

    expect(getByText(/El peso está fuera del rango estándar/)).toBeTruthy();
  });

  it('does not show validation error when weight is within standard range', () => {
    const { queryByText, getByPlaceholderText } = renderInput({
      standardMin: 10,
      standardMax: 20,
    });

    const input = getByPlaceholderText('0.00');
    fireEvent.changeText(input, '15');

    expect(queryByText(/El peso está fuera del rango estándar/)).toBeNull();
  });

  it('calls onChangeValue with parsed number on valid input', () => {
    const onChangeValue = jest.fn();
    const { getByPlaceholderText } = renderInput({ onChangeValue });

    const input = getByPlaceholderText('0.00');
    fireEvent.changeText(input, '12.5');

    expect(onChangeValue).toHaveBeenCalledWith(12.5, undefined, undefined);
  });

  it('calls onChangeValue with standards when provided', () => {
    const onChangeValue = jest.fn();
    const { getByPlaceholderText } = renderInput({
      onChangeValue,
      standardMin: 10,
      standardMax: 20,
    });

    const input = getByPlaceholderText('0.00');
    fireEvent.changeText(input, '15');

    expect(onChangeValue).toHaveBeenCalledWith(15, 10, 20);
  });

  it('filters non-numeric characters from input', () => {
    const onChangeValue = jest.fn();
    const { getByPlaceholderText } = renderInput({ onChangeValue });

    const input = getByPlaceholderText('0.00');
    fireEvent.changeText(input, 'abc12.5xyz');

    expect(onChangeValue).toHaveBeenCalledWith(12.5, undefined, undefined);
  });

  it('shows info text when no standard and user has interacted', () => {
    const { getByPlaceholderText, getByText } = renderInput();

    const input = getByPlaceholderText('0.00');
    fireEvent.changeText(input, '15');

    expect(getByText('Peso registrado sin verificación de estándar')).toBeTruthy();
  });

  it('renders without crashing when disabled', () => {
    const { getByPlaceholderText } = renderInput({ disabled: true });

    const input = getByPlaceholderText('0.00');
    // The input should still render when disabled
    expect(input).toBeTruthy();
  });
});
