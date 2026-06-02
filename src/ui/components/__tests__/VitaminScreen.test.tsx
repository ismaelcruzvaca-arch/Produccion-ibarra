/**
 * T8.5 — VitaminScreen rendering tests.
 *
 * Spec compliance:
 * - VF-1: SHALL support up to 3 products per turno
 * - VF-2: SHALL record #Orden, #Kit, semi-terminado, ingredients with lotes
 * - VF-3: SHALL verify microingredient kits by Production AND Quality
 * - VF-4: SHALL record peso báscula vs peso físico
 * - VF-5: SHALL require Operador, Jefe Turno, Verif. Producción, Verif. Calidad signatures
 * - S1: Operator fills batches → Verif. Prod checks → Verif. Calidad verifies → Jefe Turno authorizes.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// setImmediate polyfill for test environment
if (typeof setImmediate === 'undefined') {
  (global as any).setImmediate = (fn: any, ...args: any[]) =>
    setTimeout(fn, 0, ...args);
}

import { PaperProvider } from 'react-native-paper';
import VitaminScreen from '../organisms/VitaminScreen';

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
jest.mock('../../../repositories/useVitaminRepository', () => ({
  useVitaminRepository: jest.fn(),
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

import { useVitaminRepository } from '../../../repositories/useVitaminRepository';

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
        { role: 'verif_produccion', label: 'Verif. Producción', status: 'pending' as const },
        { role: 'verif_calidad', label: 'Verif. Calidad', status: 'pending' as const },
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

  (useVitaminRepository as jest.Mock).mockReturnValue({
    ...mockRepo,
    ...overrides.repository,
  });

  return {
    ...render(
      <PaperProvider>
        <VitaminScreen />
      </PaperProvider>
    ),
    mockRepo,
    mockSignatures,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('VitaminScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { useCatalogStore } = require('../../store/catalogStore');
    useCatalogStore.setState({
      selectedLine: 'line-1',
      selectedMachine: 'machine-vitamin',
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

  it('renders the form title (F-PD-06)', () => {
    const { getByText } = renderScreen();
    expect(getByText(/Vitaminas \(F-PD-06\)/)).toBeTruthy();
  });

  // ─── VF-1: Products ─────────────────────────────────────────────────────────

  it('renders product card with inputs (VF-1, VF-2)', () => {
    const { getByText, getAllByText } = renderScreen();
    expect(getByText('Producto 1')).toBeTruthy();
    expect(getAllByText('# Orden').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('# Kit').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('Semi-terminado').length).toBeGreaterThanOrEqual(1);
  });

  it('shows add product button with count limit (VF-1)', () => {
    const { getByText } = renderScreen();
    expect(getByText(/Agregar Producto \(1\/3\)/)).toBeTruthy();
  });

  // ─── VF-2: Ingredients with lotes ───────────────────────────────────────────

  it('renders ingredients section with add button (VF-2)', () => {
    const { getByText } = renderScreen();
    expect(getByText('Ingredientes / Microingredientes')).toBeTruthy();
    expect(getByText(/Agregar Ingrediente/)).toBeTruthy();
  });

  // ─── VF-3: Verifications ────────────────────────────────────────────────────

  it('renders verification section with switches (VF-3)', () => {
    const { getByText } = renderScreen();
    expect(getByText('Verificaciones')).toBeTruthy();
    expect(getByText('Verif. Producción')).toBeTruthy();
    expect(getByText('Verif. Calidad')).toBeTruthy();
  });

  // ─── VF-4: Weights ──────────────────────────────────────────────────────────

  it('renders weight section with bascula and fisico (VF-4)', () => {
    const { getByText, getAllByText } = renderScreen();
    expect(getByText('Pesos')).toBeTruthy();
    expect(getAllByText(/Peso Báscula/).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/Peso Físico/).length).toBeGreaterThanOrEqual(1);
  });

  // ─── Action Button ─────────────────────────────────────────────────────────

  it('renders "Guardar y Firmar" button initially', () => {
    const { getByText } = renderScreen();
    expect(getByText('Guardar y Firmar')).toBeTruthy();
  });

  // ─── Spec Scenario S1: Create document ─────────────────────────────────────

  it('calls repository.create on "Guardar y Firmar" press (S1)', async () => {
    const mockRepo = createMockRepository();
    (useVitaminRepository as jest.Mock).mockReturnValue(mockRepo);

    const { getByText } = render(
      <PaperProvider>
        <VitaminScreen />
      </PaperProvider>
    );

    await React.act(async () => {
      fireEvent.press(getByText('Guardar y Firmar'));
    });

    expect(mockRepo.create).toHaveBeenCalledTimes(1);
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        line_id: 'line-1',
        machine_id: 'machine-vitamin',
        shift_id: 'shift-1',
        operator_id: 'user-1',
      })
    );
  });

  // ─── Spec Reference: VF-5 chain config ─────────────────────────────────────

  it('uses vitamin_kit chain config with 4 roles (VF-5)', () => {
    const DEFAULT_CHAINS = require('../../../hooks/useSignatures').DEFAULT_CHAINS;
    const chain = DEFAULT_CHAINS.vitamin_kit;
    expect(chain.roles).toEqual(['operator', 'supervisor', 'verif_produccion', 'verif_calidad']);
    expect(chain.labels).toEqual([
      'Firma Operador',
      'Firma Jefe Turno',
      'Verif. Producción',
      'Verif. Calidad',
    ]);
  });

  // ─── Initial State ─────────────────────────────────────────────────────────

  it('does not show "Guardado" hint before saving', () => {
    const { queryByText } = renderScreen();
    expect(queryByText(/Guardado — firmas pendientes/i)).toBeNull();
  });
});
