/**
 * QualityListScreen lightweight rendering tests.
 *
 * Spec compliance:
 * - QC-1: MUST display inspections for active shift, timestamp DESC
 * - QC-7: SHALL block capture when no active shift session
 * - QC-11: SHOULD pull-to-refresh offline resilient
 * - QC-12: SHALL empty state CTA when no inspections
 */
import React from 'react';
import { render } from '@testing-library/react-native';

import { PaperProvider } from 'react-native-paper';
import { QualityListScreen } from '../organisms/QualityListScreen';

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

jest.mock('../../../hooks/useQualityListOrchestration', () => ({
  useQualityListOrchestration: jest.fn(),
}));

import { useQualityListOrchestration } from '../../../hooks/useQualityListOrchestration';

// ─── Fixtures ───────────────────────────────────────────────────────────────────

const MOCK_INSPECTIONS = [
  {
    id: 'insp-1',
    updated_at: 1700000000000,
    is_deleted: false,
    line_id: 'line-1',
    machine_id: 'machine-1',
    shift_session_id: 'shift-1',
    operator_id: 'op-1',
    product_id: 'prod-1',
    inspection_type: 'visual' as const,
    value: 1,
    unit: 'units',
    passed: true,
  },
  {
    id: 'insp-2',
    updated_at: 1700000001000,
    is_deleted: false,
    line_id: 'line-1',
    machine_id: 'machine-1',
    shift_session_id: 'shift-1',
    operator_id: 'op-1',
    product_id: 'prod-1',
    inspection_type: 'weight' as const,
    value: 15,
    unit: 'kg',
    passed: false,
    defect_id: 'defect-1',
    defect_label: 'Deformación',
    defect_severity: 'critical',
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────────

function renderScreen(overrides: Record<string, any> = {}) {
  const props = {
    shiftSessionId: 'shift-1',
    onNewInspection: jest.fn(),
    onInspectionPress: jest.fn(),
    ...overrides,
  };

  return {
    ...render(
      <PaperProvider>
        <QualityListScreen {...props} />
      </PaperProvider>
    ),
    props,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe.skip('QualityListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders blocked state when no shift session (QC-7)', () => {
    (useQualityListOrchestration as unknown as jest.Mock).mockReturnValue({
      state: {
        inspections: [],
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastUpdated: null,
      },
      loadInspections: jest.fn(),
      refreshInspections: jest.fn(),
    });

    const { getByText } = renderScreen({ shiftSessionId: null });
    expect(getByText('No hay sesión de turno activa')).toBeTruthy();
  });

  it('renders loading indicator when isLoading and no inspections', () => {
    (useQualityListOrchestration as unknown as jest.Mock).mockReturnValue({
      state: {
        inspections: [],
        isLoading: true,
        isRefreshing: false,
        error: null,
        lastUpdated: null,
      },
      loadInspections: jest.fn(),
      refreshInspections: jest.fn(),
    });

    const { getByText } = renderScreen();
    expect(getByText('Cargando inspecciones...')).toBeTruthy();
  });

  it('renders empty state when no inspections (QC-12)', () => {
    (useQualityListOrchestration as unknown as jest.Mock).mockReturnValue({
      state: {
        inspections: [],
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastUpdated: null,
      },
      loadInspections: jest.fn(),
      refreshInspections: jest.fn(),
    });

    const { getByText } = renderScreen();
    expect(getByText('No hay inspecciones de calidad registradas para este turno')).toBeTruthy();
  });

  it('renders list of inspections when data is available (QC-1)', () => {
    (useQualityListOrchestration as unknown as jest.Mock).mockReturnValue({
      state: {
        inspections: MOCK_INSPECTIONS,
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastUpdated: Date.now(),
      },
      loadInspections: jest.fn(),
      refreshInspections: jest.fn(),
    });

    const { getByText } = renderScreen();

    // Header title
    expect(getByText('Inspecciones de Calidad')).toBeTruthy();

    // Inspection cards
    expect(getByText('Visual')).toBeTruthy();
    expect(getByText('Peso')).toBeTruthy();

    // Pass/fail chips
    expect(getByText('PASA')).toBeTruthy();
    expect(getByText('FALLA')).toBeTruthy();
  });

  it('renders "Nueva" button in header when inspections exist', () => {
    (useQualityListOrchestration as unknown as jest.Mock).mockReturnValue({
      state: {
        inspections: MOCK_INSPECTIONS,
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastUpdated: Date.now(),
      },
      loadInspections: jest.fn(),
      refreshInspections: jest.fn(),
    });

    const { getByText } = renderScreen();
    expect(getByText('Nueva')).toBeTruthy();
  });
});
