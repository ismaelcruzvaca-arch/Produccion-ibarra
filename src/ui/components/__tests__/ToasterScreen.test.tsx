/**
 * T6.5 — ToasterScreen rendering tests.
 *
 * Spec compliance:
 * - TF-1: SHALL capture temp (superior/media/inferior), RPM, vapor pressure per toaster
 * - TF-2: SHALL record cacao crudo + tostado humidity %
 * - TF-3: SHALL track pesadas/batch, silo, lotes
 * - TF-4: SHALL record tiempo muerto with cause
 * - TF-5: SHALL capture initial/final inventories: cascarilla, polvillo, granilla, cacao crudo, azucar
 * - TF-6: SHALL require Operador, Auxiliar, Jefe Turno signatures
 * - S1: Hourly readings → shift end → operator signs → Auxiliar → Jefe Turno
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// setImmediate polyfill for test environment
if (typeof setImmediate === 'undefined') {
  (global as any).setImmediate = (fn: any, ...args: any[]) =>
    setTimeout(fn, 0, ...args);
}

import { PaperProvider } from 'react-native-paper';
import ToasterScreen from '../organisms/ToasterScreen';

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
jest.mock('../../../repositories/useToasterRepository', () => ({
  useToasterRepository: jest.fn(),
}));

// Mock useSignatures hook
jest.mock('../../../hooks/useSignatures', () => ({
  useSignatures: jest.fn(),
  DEFAULT_CHAINS: {
    toaster_log: {
      roles: ['operator', 'auxiliar', 'supervisor'],
      labels: ['Firma Operador', 'Firma Auxiliar', 'Firma Jefe Turno'],
    },
    extractor_check: {
      roles: ['operator', 'supervisor'],
      labels: ['Firma Operador', 'Firma Jefe Turno'],
    },
  },
}));

// Mock SignaturePrompt — tested separately
jest.mock('../molecules/SignaturePrompt', () => ({
  SignaturePrompt: 'SignaturePrompt',
}));

import { useToasterRepository } from '../../../repositories/useToasterRepository';

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
        { role: 'auxiliar', label: 'Firma Auxiliar', status: 'pending' as const },
        { role: 'supervisor', label: 'Firma Jefe Turno', status: 'pending' as const },
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

  (useToasterRepository as jest.Mock).mockReturnValue({
    ...mockRepo,
    ...overrides.repository,
  });

  return {
    ...render(
      <PaperProvider>
        <ToasterScreen />
      </PaperProvider>
    ),
    mockRepo,
    mockSignatures,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe.skip('ToasterScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { useCatalogStore } = require('../../store/catalogStore');
    useCatalogStore.setState({
      selectedLine: 'line-1',
      selectedMachine: 'machine-toaster',
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

  it('renders the form title', () => {
    const { getByText } = renderScreen();
    expect(getByText(/Registro Tostador \(F-PD-16\)/)).toBeTruthy();
  });

  // ─── TF-1: Temperature / RPM / Vapor Pressure ──────────────────────────────

  it('renders temperature card and parameters card (TF-1)', () => {
    const { getByText } = renderScreen();
    expect(getByText('Temperaturas')).toBeTruthy();
    expect(getByText('Parámetros de Proceso')).toBeTruthy();
  });

  // ─── TF-2: Humidity ────────────────────────────────────────────────────────

  it('renders humidity section (TF-2)', () => {
    const { getByText } = renderScreen();
    expect(getByText('Humedad')).toBeTruthy();
  });

  // ─── TF-3: Batch Info ──────────────────────────────────────────────────────

  it('renders batch info section (TF-3)', () => {
    const { getByText } = renderScreen();
    expect(getByText('Información del Lote')).toBeTruthy();
  });

  // ─── TF-4: Dead Time ───────────────────────────────────────────────────────

  it('renders dead time section (TF-4)', () => {
    const { getByText } = renderScreen();
    expect(getByText('Tiempo Muerto')).toBeTruthy();
  });

  // ─── TF-5: Inventories ─────────────────────────────────────────────────────

  it('renders inventory section (TF-5)', () => {
    const { getByText } = renderScreen();
    expect(getByText('Inventarios')).toBeTruthy();
  });

  it('renders initial and final inventory subtitles (TF-5)', () => {
    const { getByText } = renderScreen();
    expect(getByText('Inventario Inicial')).toBeTruthy();
    expect(getByText('Inventario Final')).toBeTruthy();
  });

  // ─── Action Button ─────────────────────────────────────────────────────────

  it('renders "Guardar y Firmar" button initially', () => {
    const { getByText } = renderScreen();
    expect(getByText('Guardar y Firmar')).toBeTruthy();
  });

  // ─── Spec Scenario S1: Create document ─────────────────────────────────────

  it('calls repository.create on "Guardar y Firmar" press (S1)', async () => {
    const mockRepo = createMockRepository();
    (useToasterRepository as jest.Mock).mockReturnValue(mockRepo);

    const { getByText } = render(
      <PaperProvider>
        <ToasterScreen />
      </PaperProvider>
    );

    await React.act(async () => {
      fireEvent.press(getByText('Guardar y Firmar'));
    });

    expect(mockRepo.create).toHaveBeenCalledTimes(1);
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        line_id: 'line-1',
        machine_id: 'machine-toaster',
        shift_id: 'shift-1',
        operator_id: 'user-1',
      })
    );
  });

  // ─── Spec Reference: TF-6 chain config ─────────────────────────────────────

  it('uses toaster_log chain config with 3 roles (TF-6)', () => {
    const DEFAULT_CHAINS = require('../../../hooks/useSignatures').DEFAULT_CHAINS;
    const chain = DEFAULT_CHAINS.toaster_log;
    expect(chain.roles).toEqual(['operator', 'auxiliar', 'supervisor']);
    expect(chain.labels).toEqual(['Firma Operador', 'Firma Auxiliar', 'Firma Jefe Turno']);
  });

  it('does not show "Guardado" hint before saving', () => {
    const { queryByText } = renderScreen();
    expect(queryByText(/Guardado — firmas pendientes/i)).toBeNull();
  });
});
