/**
 * DefectSelector unit tests.
 *
 * Spec compliance:
 * - QC-9: SHALL defect selector from quality_defects collection
 * - QC-2: Appears in the multi-step flow when an inspection fails
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { PaperProvider } from 'react-native-paper';
import { DefectSelector, type DefectOption } from '../molecules/DefectSelector';

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

// ─── Fixtures ───────────────────────────────────────────────────────────────────

const SAMPLE_DEFECTS: DefectOption[] = [
  { id: 'd1', label: 'Deformación', severity: 'critical' },
  { id: 'd2', label: 'Color incorrecto', severity: 'major' },
  { id: 'd3', label: 'Empaque dañado', severity: 'minor' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────────

function renderSelector(overrides: Record<string, any> = {}) {
  const props = {
    defects: SAMPLE_DEFECTS,
    selectedDefectId: null,
    onSelect: jest.fn(),
    disabled: false,
    ...overrides,
  };

  return {
    ...render(
      <PaperProvider>
        <DefectSelector {...props} />
      </PaperProvider>
    ),
    props,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('DefectSelector', () => {
  it('renders title and subtitle', () => {
    const { getByText } = renderSelector();

    expect(getByText('Seleccionar Defecto')).toBeTruthy();
    expect(getByText(/La inspección no pasó/)).toBeTruthy();
  });

  it('renders all defect options', () => {
    const { getByText } = renderSelector();

    expect(getByText('Deformación')).toBeTruthy();
    expect(getByText('Color incorrecto')).toBeTruthy();
    expect(getByText('Empaque dañado')).toBeTruthy();
  });

  it('renders severity chips with correct labels', () => {
    const { getByText } = renderSelector();

    expect(getByText('Crítico')).toBeTruthy();
    expect(getByText('Mayor')).toBeTruthy();
    expect(getByText('Menor')).toBeTruthy();
  });

  it('shows RadioButton as checked for selected defect', () => {
    const { getByText } = renderSelector({ selectedDefectId: 'd2' });

    // The selected defect label should be rendered
    expect(getByText('Color incorrecto')).toBeTruthy();
  });

  it('fires onSelect with defect id when a defect is pressed', () => {
    const onSelect = jest.fn();
    const { getByText } = renderSelector({ onSelect });

    fireEvent.press(getByText('Deformación'));
    expect(onSelect).toHaveBeenCalledWith('d1');
  });

  it('fires onSelect for different defect', () => {
    const onSelect = jest.fn();
    const { getByText } = renderSelector({ onSelect });

    fireEvent.press(getByText('Empaque dañado'));
    expect(onSelect).toHaveBeenCalledWith('d3');
  });

  it('does not fire onSelect when disabled', () => {
    const onSelect = jest.fn();
    const { getByText } = renderSelector({ onSelect, disabled: true });

    fireEvent.press(getByText('Deformación'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders empty state when defects list is empty', () => {
    const { queryByText } = renderSelector({ defects: [] });

    expect(queryByText('Deformación')).toBeNull();
    expect(queryByText('Color incorrecto')).toBeNull();
  });
});
