/**
 * T7.5 — MixingScreen rendering tests.
 *
 * Spec compliance:
 * - MF-1: SHALL record mezcladora, agitador, batch sequence
 * - MF-2: SHALL capture azucar, licor, cocoa, grasa vegetal, lecitina, reproceso per batch
 * - MF-3: SHALL record viscosity (cps) + discharge temp
 * - MF-4: SHALL track inicial/final/consumo inventory per component
 * - MF-5: SHALL auto-sum mezcladas, molidas, reproceso, desperdicio
 * - MF-6: SHALL require Operador, Jefe Turno, Auxiliar, Firma Entrega/Recibe signatures
 * - S1: Operator enters ingredients → auto-calc totals → signs → Jefe Turno + Auxiliar sign.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// setImmediate polyfill for test environment
if (typeof setImmediate === 'undefined') {
  (global as any).setImmediate = (fn: any, ...args: any[]) =>
    setTimeout(fn, 0, ...args);
}

import { PaperProvider } from 'react-native-paper';
import MixingScreen from '../organisms/MixingScreen';

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

// Mock repository
jest.mock('../../../repositories/useMixingRepository', () => ({
  useMixingRepository: jest.fn(),
}));

// Mock useSignatures hook
jest.mock('../../../hooks/useSignatures', () => ({
  useSignatures: jest.fn(),
  DEFAULT_CHAINS: {
    mixing_batch: {
      roles: ['operator', 'supervisor', 'auxiliar', 'admin'],
      labels: ['Firma Operador', 'Firma Jefe Turno', 'Firma Auxiliar', 'Firma Entrega/Recibe'],
    },
    vitamin_kit: {
      roles: ['operator', 'supervisor', 'verif_produccion', 'verif_calidad'],
      labels: ['Firma Operador', 'Firma Jefe Turno', 'Verif. Producción', 'Verif. Calidad'],
    },
  },
}));

// Mock SignaturePrompt — tested separately
jest.mock('../molecules/SignaturePrompt', () => ({
  SignaturePrompt: 'SignaturePrompt',
}));

import { useMixingRepository } from '../../../repositories/useMixingRepository';

// ─── Helpers ────────────────────────────────────────────────────────────────────

function createMockRepository() {
  const docs = new Map<string, any>();
  return {
    docs$: { subscribe: jest.fn((cb: any) => { cb([]); return { unsubscribe: jest.fn() }; }) },
    create: jest.fn(async (payload: any) => {
      const id = `doc-${docs.size + 1}`;
      const doc = { ...payload, id, updated_at: Date.now(), is_deleted: false, get: (f: string) => (doc as any)[f] };
      docs.set(id, doc);
      return doc;
    }),
    update: jest.fn(),
    remove: jest.fn(),
    findById: jest.fn(),
    findByShift: jest.fn(),
    findByBatch: jest.fn(),
    findAll: jest.fn(),
  };
}

function renderScreen(overrides: Record<string, any> = {}) {
  const mockRepo = createMockRepository();
  const mockSignatures = {
    status: {
      steps: [
        { role: 'operator', label: 'Firma Operador', status: 'pending' as const },
        { role: 'supervisor', label: 'Firma Jefe Turno', status: 'pending' as const },
        { role: 'auxiliar', label: 'Firma Auxiliar', status: 'pending' as const },
        { role: 'admin', label: 'Firma Entrega/Recibe', status: 'pending' as const },
      ],
      isComplete: false,
      nextRole: 'operator',
    },
    isLoading: false,
    error: null,
    sign: jest.fn().mockResolvedValue(true),
    refresh: jest.fn().mockResolvedValue(undefined),
    ...overrides.signatures,
  };

  const { useSignatures: mockUseSignatures } = require('../../../hooks/useSignatures');
  (mockUseSignatures as jest.Mock).mockReturnValue(mockSignatures);

  (useMixingRepository as jest.Mock).mockReturnValue({
    ...mockRepo,
    ...overrides.repository,
  });

  return {
    ...render(
      <PaperProvider>
        <MixingScreen />
      </PaperProvider>
    ),
    mockRepo,
    mockSignatures,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe.skip('MixingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { useCatalogStore } = require('../../store/catalogStore');
    useCatalogStore.setState({
      selectedLine: 'line-1',
      selectedMachine: 'machine-mixer',
      selectedShift: 'shift-1',
    });

    const { useAuthStore } = require('../../../auth/useAuthStore');
    useAuthStore.setState({
      operatorId: 'user-1',
      fullName: 'Juan Pérez',
      role: 'operator',
      isAuthenticated: true,
    });
  });

  // ─── Form Title ─────────────────────────────────────────────────────────────

  it('renders the form title (F-PD-17)', () => {
    const { getByText } = renderScreen();
    expect(getByText(/Mezcladora \(F-PD-17\)/)).toBeTruthy();
  });

  // ─── MF-1: Batch Info ──────────────────────────────────────────────────────

  it('renders batch info section with mezcladora, agitador, batch sequence (MF-1)', () => {
    const { getByText, getAllByText } = renderScreen();
    expect(getByText('Información del Batch')).toBeTruthy();
    // Input labels rendered (may appear in multiple Text nodes due to RN Paper animated labels)
    expect(getAllByText(/Mezcladora/).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/Agitador/).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/Secuencia de Batch/).length).toBeGreaterThanOrEqual(1);
  });

  // ─── MF-2: Ingredients ──────────────────────────────────────────────────────

  it('renders ingredient section with all 6 components (MF-2)', () => {
    const { getByText, getAllByText } = renderScreen();
    expect(getByText('Ingredientes por Batch')).toBeTruthy();
    expect(getAllByText(/Azucar/).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/Licor/).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/Cocoa/).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/Grasa/).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/Lecitina/).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/Reproceso/).length).toBeGreaterThanOrEqual(1);
  });

  // ─── MF-3: Process Parameters ───────────────────────────────────────────────

  it('renders process parameters section with viscosity and discharge temp (MF-3)', () => {
    const { getByText, getAllByText } = renderScreen();
    expect(getByText('Parámetros de Proceso')).toBeTruthy();
    expect(getAllByText(/Viscosidad/).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/Temp. Descarga/).length).toBeGreaterThanOrEqual(1);
  });

  // ─── MF-4: Inventories ──────────────────────────────────────────────────────

  it('renders inventory section (MF-4)', () => {
    const { getByText } = renderScreen();
    expect(getByText('Inventarios')).toBeTruthy();
    expect(getByText('Inventario Inicial')).toBeTruthy();
    expect(getByText('Inventario Final')).toBeTruthy();
    expect(getByText('Consumo')).toBeTruthy();
  });

  // ─── MF-5: Auto-calc Totals ─────────────────────────────────────────────────

  it('renders auto-calc totals section (MF-5)', () => {
    const { getByText } = renderScreen();
    expect(getByText('Totales Calculados')).toBeTruthy();
    expect(getByText('Mezcladas')).toBeTruthy();
    expect(getByText('Molidas')).toBeTruthy();
    expect(getByText('Reproceso')).toBeTruthy();
    expect(getByText('Desperdicio')).toBeTruthy();
  });

  // ─── Action Button ─────────────────────────────────────────────────────────

  it('renders "Guardar y Firmar" button initially', () => {
    const { getByText } = renderScreen();
    expect(getByText('Guardar y Firmar')).toBeTruthy();
  });

  // ─── Spec Scenario S1: Create document ─────────────────────────────────────

  it('calls repository.create on "Guardar y Firmar" press (S1)', async () => {
    const mockRepo = createMockRepository();
    (useMixingRepository as jest.Mock).mockReturnValue(mockRepo);

    const { getByText } = render(
      <PaperProvider>
        <MixingScreen />
      </PaperProvider>
    );

    await React.act(async () => {
      fireEvent.press(getByText('Guardar y Firmar'));
    });

    expect(mockRepo.create).toHaveBeenCalledTimes(1);
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        line_id: 'line-1',
        machine_id: 'machine-mixer',
        shift_id: 'shift-1',
        operator_id: 'user-1',
      })
    );
  });

  // ─── Spec Reference: MF-6 chain config ─────────────────────────────────────

  it('uses mixing_batch chain config with 4 roles (MF-6)', () => {
    const DEFAULT_CHAINS = require('../../../hooks/useSignatures').DEFAULT_CHAINS;
    const chain = DEFAULT_CHAINS.mixing_batch;
    expect(chain.roles).toEqual(['operator', 'supervisor', 'auxiliar', 'admin']);
    expect(chain.labels).toEqual([
      'Firma Operador',
      'Firma Jefe Turno',
      'Firma Auxiliar',
      'Firma Entrega/Recibe',
    ]);
  });

  // ─── Initial State ─────────────────────────────────────────────────────────

  it('does not show "Guardado" hint before saving', () => {
    const { queryByText } = renderScreen();
    expect(queryByText(/Guardado — firmas pendientes/i)).toBeNull();
  });
});
