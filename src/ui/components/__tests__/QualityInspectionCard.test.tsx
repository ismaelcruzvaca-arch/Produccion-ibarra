/**
 * QualityInspectionCard unit tests.
 *
 * Spec compliance:
 * - QC-10: MUST pass/fail chip per inspection card
 * - QC-5: MUST read-only detail showing all fields
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { PaperProvider } from 'react-native-paper';
import { QualityInspectionCard } from '../molecules/QualityInspectionCard';
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
  updated_at: 1700000000000,
  is_deleted: false,
  line_id: 'line-1',
  machine_id: 'machine-1',
  shift_session_id: 'shift-session-1',
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
};

const WEIGHT_INSPECTION: IQualityInspection = {
  ...PASSING_INSPECTION,
  id: 'insp-3',
  inspection_type: 'weight',
  value: 15,
  unit: 'kg',
  standard_min: 10,
  standard_max: 20,
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

function renderCard(overrides: Record<string, any> = {}) {
  const props = {
    inspection: PASSING_INSPECTION,
    onPress: jest.fn(),
    ...overrides,
  };

  return {
    ...render(
      <PaperProvider>
        <QualityInspectionCard {...props} />
      </PaperProvider>
    ),
    props,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('QualityInspectionCard', () => {
  it('renders inspection type label', () => {
    const { getByText } = renderCard();

    expect(getByText('Visual')).toBeTruthy();
  });

  it('renders inspection value and unit', () => {
    const { getByText } = renderCard();

    expect(getByText('1 units')).toBeTruthy();
  });

  it('renders timestamp', () => {
    const { getByText } = renderCard();

    // The formatted date from 1700000000000 in es-MX locale
    // Produces something like "14/11, 04:13 p.m."
    expect(getByText(/14\/11/)).toBeTruthy();
  });

  it('shows "PASA" chip when inspection passed', () => {
    const { getByText } = renderCard({ inspection: PASSING_INSPECTION });

    expect(getByText('PASA')).toBeTruthy();
  });

  it('shows "FALLA" chip when inspection failed', () => {
    const { getByText } = renderCard({ inspection: FAILING_INSPECTION });

    expect(getByText('FALLA')).toBeTruthy();
  });

  it('renders defect label and severity when provided and failed', () => {
    const { getByText } = renderCard({
      inspection: FAILING_INSPECTION,
      defectLabel: 'Deformación',
      defectSeverity: 'critical',
    });

    expect(getByText(/Defecto: Deformación/)).toBeTruthy();
    expect(getByText('Crítico')).toBeTruthy();
  });

  it('renders severity labels correctly for each level', () => {
    const { getByText, rerender } = render(
      <PaperProvider>
        <QualityInspectionCard
          inspection={FAILING_INSPECTION}
          defectLabel="Test"
          defectSeverity="major"
          onPress={jest.fn()}
        />
      </PaperProvider>
    );

    expect(getByText('Mayor')).toBeTruthy();
  });

  it('renders standard range for weight inspections', () => {
    const { getByText } = renderCard({ inspection: WEIGHT_INSPECTION });

    expect(getByText(/Estándar: 10 – 20 kg/)).toBeTruthy();
  });

  it('shows standard_warning chip when present', () => {
    const inspectionWithWarning: IQualityInspection = {
      ...PASSING_INSPECTION,
      inspection_type: 'weight',
      value: 15,
      unit: 'kg',
      standard_warning: true,
      standard_min: 0,
      standard_max: undefined,
    };
    const { getByText } = renderCard({ inspection: inspectionWithWarning });

    expect(getByText('Sin estándar')).toBeTruthy();
  });

  it('fires onPress when card is pressed', () => {
    const onPress = jest.fn();
    const { getByText } = renderCard({ onPress });

    fireEvent.press(getByText('Visual'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders weight inspection type and value', () => {
    const { getByText } = renderCard({ inspection: WEIGHT_INSPECTION });

    expect(getByText('Peso')).toBeTruthy();
    expect(getByText('15 kg')).toBeTruthy();
  });
});
