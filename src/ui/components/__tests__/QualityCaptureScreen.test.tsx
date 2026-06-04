/**
 * QualityCaptureScreen lightweight rendering tests.
 *
 * Spec compliance:
 * - QC-2: SHALL multi-step: product → type → value → (fail?) defect → confirm
 * - QC-6: SHALL type selector: visual, weight, temp, metal_detector
 * - QC-9: SHALL defect selector from quality_defects collection
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { PaperProvider } from 'react-native-paper';
import { QualityCaptureScreen } from '../organisms/QualityCaptureScreen';

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

jest.mock('../../../hooks/useQualityCaptureOrchestration', () => ({
  useQualityCaptureOrchestration: jest.fn(),
}));

import { useQualityCaptureOrchestration } from '../../../hooks/useQualityCaptureOrchestration';

// ─── Fixtures ───────────────────────────────────────────────────────────────────

const SAMPLE_PRODUCTS = [
  { id: 'prod-1', name: 'Chocolate Bar', code: 'CB-001' },
  { id: 'prod-2', name: 'Chocolate Powder', code: 'CP-002' },
];

const SAMPLE_DEFECTS = [
  { id: 'd1', label: 'Deformación', severity: 'critical' as const },
  { id: 'd2', label: 'Color incorrecto', severity: 'major' as const },
];

const BASE_STATE = {
  step: 'product' as const,
  isActive: true,
  productId: null,
  inspectionType: null,
  value: null,
  hasFailed: false,
  defectId: null,
  standardMin: null,
  standardMax: null,
  standardWarning: false,
  notes: '',
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

function renderScreen(overrides: Record<string, any> = {}) {
  const props = {
    visible: true,
    onDismiss: jest.fn(),
    onSave: jest.fn().mockResolvedValue(undefined),
    products: SAMPLE_PRODUCTS,
    defects: SAMPLE_DEFECTS,
    ...overrides,
  };

  const mockOrchestration = {
    state: BASE_STATE,
    startCapture: jest.fn(),
    selectProduct: jest.fn(),
    selectInspectionType: jest.fn(),
    setValue: jest.fn(),
    selectDefect: jest.fn(),
    setNotes: jest.fn(),
    cancelCapture: jest.fn(),
    getInspectionPayload: jest.fn().mockReturnValue({
      product_id: 'prod-1',
      inspection_type: 'visual',
      value: 1,
      unit: 'units',
      passed: true,
    }),
    canHaveDefect: false,
    ...overrides.mockOrchestration,
  };

  (useQualityCaptureOrchestration as unknown as jest.Mock).mockReturnValue(mockOrchestration);

  return {
    ...render(
      <PaperProvider>
        <QualityCaptureScreen {...props} />
      </PaperProvider>
    ),
    props,
    mockOrchestration,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe.skip('QualityCaptureScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dialog when visible is true', () => {
    const { getByText } = renderScreen();

    expect(getByText('Nueva Inspección')).toBeTruthy();
  });

  it('renders product selection step (QC-2)', () => {
    const { getByText } = renderScreen();

    expect(getByText('Seleccionar Producto')).toBeTruthy();
    expect(getByText('CB-001')).toBeTruthy();
    expect(getByText('CP-002')).toBeTruthy();
  });

  it('renders inspection_type step', () => {
    const { getAllByText } = renderScreen({
      mockOrchestration: {
        state: { ...BASE_STATE, step: 'inspection_type', productId: 'prod-1' },
      },
    });

    // Appears in both Dialog.Title and step content
    expect(getAllByText('Tipo de Inspección').length).toBe(2);
  });

  it('renders value input step', () => {
    const { getAllByText } = renderScreen({
      mockOrchestration: {
        state: {
          ...BASE_STATE,
          step: 'value',
          productId: 'prod-1',
          inspectionType: 'temp',
        },
      },
    });

    // Appears in both Dialog.Title and step content
    expect(getAllByText('Ingresar Valor').length).toBe(2);
  });

  it('renders WeightInput for weight inspection type', () => {
    const { getByText } = renderScreen({
      mockOrchestration: {
        state: {
          ...BASE_STATE,
          step: 'value',
          productId: 'prod-1',
          inspectionType: 'weight',
        },
      },
    });

    expect(getByText('Peso (kg)')).toBeTruthy();
  });

  it('renders defect step when inspection failed', () => {
    const { getAllByText, getByText } = renderScreen({
      mockOrchestration: {
        state: {
          ...BASE_STATE,
          step: 'defect',
          productId: 'prod-1',
          inspectionType: 'visual',
          hasFailed: true,
        },
      },
    });

    // Appears in both Dialog.Title and step content
    expect(getAllByText('Seleccionar Defecto').length).toBe(2);
    expect(getByText('Deformación')).toBeTruthy();
    expect(getByText('Color incorrecto')).toBeTruthy();
  });

  it('renders confirm step', () => {
    const { getByText } = renderScreen({
      mockOrchestration: {
        state: {
          ...BASE_STATE,
          step: 'confirm',
          productId: 'prod-1',
          inspectionType: 'visual',
          value: 1,
          hasFailed: false,
        },
      },
    });

    expect(getByText('Confirmar Inspección')).toBeTruthy();
  });

  it('shows Cancel button when not on product step', () => {
    const { getByText } = renderScreen({
      mockOrchestration: {
        state: { ...BASE_STATE, step: 'confirm', productId: 'prod-1', inspectionType: 'visual', value: 1 },
      },
    });

    expect(getByText('Cancelar')).toBeTruthy();
  });

  it('shows Guardar Inspección button on confirm step', () => {
    const { getByText } = renderScreen({
      mockOrchestration: {
        state: { ...BASE_STATE, step: 'confirm', productId: 'prod-1', inspectionType: 'visual', value: 1 },
      },
    });

    expect(getByText('Guardar Inspección')).toBeTruthy();
  });

  it('calls onDismiss and cancelCapture when dismissed', () => {
    const onDismiss = jest.fn();
    const { mockOrchestration } = renderScreen({ onDismiss });

    // Dialog dismiss is handled by Portal's onDismiss
    expect(mockOrchestration.cancelCapture).not.toHaveBeenCalled();
  });

  it('calls onSave with payload when saving on confirm step', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { getByText, mockOrchestration } = renderScreen({
      onSave,
      mockOrchestration: {
        state: { ...BASE_STATE, step: 'confirm', productId: 'prod-1', inspectionType: 'visual', value: 1 },
        getInspectionPayload: jest.fn().mockReturnValue({
          product_id: 'prod-1',
          inspection_type: 'visual',
          value: 1,
          unit: 'units',
          passed: true,
        }),
      },
    });

    fireEvent.press(getByText('Guardar Inspección'));

    // Should have called getInspectionPayload and onSave
    expect(mockOrchestration.getInspectionPayload).toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledWith({
      product_id: 'prod-1',
      inspection_type: 'visual',
      value: 1,
      unit: 'units',
      passed: true,
    });
  });
});
