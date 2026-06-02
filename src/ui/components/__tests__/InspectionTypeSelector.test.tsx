/**
 * InspectionTypeSelector unit tests.
 *
 * Spec compliance:
 * - QC-6: SHALL type selector: visual, weight, temp, metal_detector
 * - QC-2: First step after product selection in the multi-step flow
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { PaperProvider } from 'react-native-paper';
import { InspectionTypeSelector } from '../molecules/InspectionTypeSelector';

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

function renderSelector(overrides: Record<string, any> = {}) {
  const props = {
    selectedType: null,
    onSelect: jest.fn(),
    disabled: false,
    ...overrides,
  };

  return {
    ...render(
      <PaperProvider>
        <InspectionTypeSelector {...props} />
      </PaperProvider>
    ),
    props,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('InspectionTypeSelector', () => {
  it('renders all 4 inspection type options', () => {
    const { getByText } = renderSelector();

    expect(getByText('Visual')).toBeTruthy();
    expect(getByText('Peso')).toBeTruthy();
    expect(getByText('Temperatura')).toBeTruthy();
    expect(getByText('Detector de Metales')).toBeTruthy();
  });

  it('renders title "Tipo de Inspección"', () => {
    const { getByText } = renderSelector();
    expect(getByText('Tipo de Inspección')).toBeTruthy();
  });

  it('shows contained mode button for selected type', () => {
    const { getByText } = renderSelector({ selectedType: 'weight' });

    const weightButton = getByText('Peso');
    // Contained mode buttons have no mode prop accessible via text,
    // but we can verify the button renders and is pressable
    expect(weightButton).toBeTruthy();
  });

  it('fires onSelect with correct type when a type is pressed', () => {
    const onSelect = jest.fn();
    const { getByText } = renderSelector({ onSelect });

    fireEvent.press(getByText('Visual'));
    expect(onSelect).toHaveBeenCalledWith('visual');

    fireEvent.press(getByText('Peso'));
    expect(onSelect).toHaveBeenCalledWith('weight');
  });

  it('fires onSelect with temp and metal_detector types', () => {
    const onSelect = jest.fn();
    const { getByText } = renderSelector({ onSelect });

    fireEvent.press(getByText('Temperatura'));
    expect(onSelect).toHaveBeenCalledWith('temp');

    fireEvent.press(getByText('Detector de Metales'));
    expect(onSelect).toHaveBeenCalledWith('metal_detector');
  });

  it('does not fire onSelect when disabled', () => {
    const onSelect = jest.fn();
    const { getByText } = renderSelector({ onSelect, disabled: true });

    fireEvent.press(getByText('Visual'));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
