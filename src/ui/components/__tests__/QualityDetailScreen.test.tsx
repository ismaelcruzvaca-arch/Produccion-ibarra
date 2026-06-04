/**
 * QualityDetailScreen lightweight rendering tests.
 *
 * Spec compliance:
 * - QC-5: MUST read-only detail: all fields + defect label/severity
 * - QC-10: MUST pass/fail chip per inspection card
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { PaperProvider } from 'react-native-paper';
import { QualityDetailScreen } from '../organisms/QualityDetailScreen';
import type { IQualityInspection } from '../../../core/types';

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

const PASSING_INSPECTION: IQualityInspection = {
  id: 'insp-1',
  created_at: 1700000000000,
  updated_at: 1700000000000,
  is_deleted: false,
  line_id: 'line-1',
  machine_id: 'machine-1',
  shift_session_id: 'shift-1',
  operator_id: 'op-1',
  product_id: 'prod-1',
  inspection_type: 'visual',
  value: 1,
  unit: 'units',
  passed: true,
};

const FAILING_INSPECTION: IQualityInspection = {
  ...PASSING_INSPECTION,
  id: 'insp-2',
  passed: false,
  defect_id: 'defect-1',
  notes: 'Found packaging issue',
};

const WEIGHT_INSPECTION: IQualityInspection = {
  ...PASSING_INSPECTION,
  id: 'insp-3',
  inspection_type: 'weight',
  value: 15,
  unit: 'kg',
  passed: true,
  standard_min: 10,
  standard_max: 20,
};

const INSPECTION_WITH_WARNING: IQualityInspection = {
  ...PASSING_INSPECTION,
  id: 'insp-4',
  inspection_type: 'weight',
  value: 15,
  unit: 'kg',
  passed: true,
  standard_warning: true,
  standard_min: 0,
  standard_max: undefined,
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

function renderScreen(overrides: Record<string, any> = {}) {
  const props = {
    inspection: PASSING_INSPECTION,
    onClose: jest.fn(),
    ...overrides,
  };

  return {
    ...render(
      <PaperProvider>
        <QualityDetailScreen {...props} />
      </PaperProvider>
    ),
    props,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe.skip('QualityDetailScreen', () => {
  it('renders inspection type title', () => {
    const { getByText } = renderScreen();

    expect(getByText('Visual')).toBeTruthy();
  });

  it('renders pass/fail chip (QC-10)', () => {
    const { getByText } = renderScreen();

    expect(getByText('PASA')).toBeTruthy();
  });

  it('renders "FALLA" chip when inspection failed', () => {
    const { getByText } = renderScreen({ inspection: FAILING_INSPECTION });

    expect(getByText('FALLA')).toBeTruthy();
  });

  it('renders measured value and unit', () => {
    const { getByText } = renderScreen();

    expect(getByText('1 units')).toBeTruthy();
  });

  it('renders formatted date', () => {
    const { getByText } = renderScreen();

    // Date from 1700000000000 in es-MX locale
    expect(getByText(/14 de noviembre/)).toBeTruthy();
  });

  it('renders defect label and severity when provided (QC-5)', () => {
    const { getByText } = renderScreen({
      inspection: FAILING_INSPECTION,
      defectLabel: 'Deformación',
      defectSeverity: 'critical',
    });

    expect(getByText('Defecto')).toBeTruthy();
    expect(getByText('Deformación')).toBeTruthy();
    expect(getByText('Crítico')).toBeTruthy();
  });

  it('renders severity chip for major severity', () => {
    const { getByText } = render(
      <PaperProvider>
        <QualityDetailScreen
          inspection={FAILING_INSPECTION}
          defectLabel="Test"
          defectSeverity="major"
          onClose={jest.fn()}
        />
      </PaperProvider>
    );

    expect(getByText('Mayor')).toBeTruthy();
  });

  it('renders severity chip for minor severity', () => {
    const { getByText } = render(
      <PaperProvider>
        <QualityDetailScreen
          inspection={FAILING_INSPECTION}
          defectLabel="Test"
          defectSeverity="minor"
          onClose={jest.fn()}
        />
      </PaperProvider>
    );

    expect(getByText('Menor')).toBeTruthy();
  });

  it('renders notes when inspection has notes', () => {
    const { getByText } = renderScreen({
      inspection: FAILING_INSPECTION,
    });

    expect(getByText('Notas')).toBeTruthy();
    expect(getByText('Found packaging issue')).toBeTruthy();
  });

  it('does not render notes section when no notes', () => {
    const { queryByText } = renderScreen({
      inspection: PASSING_INSPECTION,
    });

    expect(queryByText('Notas')).toBeNull();
  });

  it('renders metadata section with product, line, machine, shift, operator', () => {
    const { getByText } = renderScreen();

    expect(getByText('Producto')).toBeTruthy();
    expect(getByText('Línea')).toBeTruthy();
    expect(getByText('Máquina')).toBeTruthy();
    expect(getByText('Sesión de Turno')).toBeTruthy();
    expect(getByText('Operador')).toBeTruthy();

    expect(getByText('prod-1')).toBeTruthy();
    expect(getByText('line-1')).toBeTruthy();
    expect(getByText('machine-1')).toBeTruthy();
    expect(getByText('shift-1')).toBeTruthy();
    expect(getByText('op-1')).toBeTruthy();
  });

  it('renders weight standards section for weight inspections', () => {
    const { getByText } = renderScreen({ inspection: WEIGHT_INSPECTION });

    expect(getByText('Estándar de Peso')).toBeTruthy();
  });

  it('renders warning chip when standard_warning is true', () => {
    const { getByText } = renderScreen({ inspection: INSPECTION_WITH_WARNING });

    expect(getByText('Sin estándar')).toBeTruthy();
  });

  it('does not render standards section for non-weight inspections', () => {
    const { queryByText } = renderScreen({ inspection: PASSING_INSPECTION });

    expect(queryByText('Estándar de Peso')).toBeNull();
  });

  it('fires onClose when close button is pressed', () => {
    const onClose = jest.fn();
    const { getByText } = renderScreen({ onClose });

    fireEvent.press(getByText('Cerrar'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
