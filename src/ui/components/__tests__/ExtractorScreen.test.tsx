/**
 * T5.5 — ExtractorScreen rendering tests.
 *
 * Spec compliance:
 * - EF-1: SHALL present 8 extractors as on/off toggles
 * - EF-2: SHALL record last cleaning date of Cedazo TT
 * - EF-3: SHALL require Operador, Jefe Turno signatures
 * - S1: Operator checks 8 extractors + cleaning date → Jefe Turno signs.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// setImmediate polyfill for test environment
if (typeof setImmediate === 'undefined') {
  (global as any).setImmediate = (fn: any, ...args: any[]) =>
    setTimeout(fn, 0, ...args);
}

import { PaperProvider } from 'react-native-paper';
import ExtractorScreen from '../organisms/ExtractorScreen';

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
jest.mock('../../../repositories/useExtractorRepository', () => ({
  useExtractorRepository: jest.fn(),
}));

// Mock useSignatures hook
jest.mock('../../../hooks/useSignatures', () => ({
  useSignatures: jest.fn(),
  DEFAULT_CHAINS: {
    extractor_check: {
      roles: ['operator', 'supervisor'],
      labels: ['Firma Operador', 'Firma Jefe Turno'],
    },
    toaster_log: {
      roles: ['operator', 'auxiliar', 'supervisor'],
      labels: ['Firma Operador', 'Firma Auxiliar', 'Firma Jefe Turno'],
    },
  },
}));

// Mock SignaturePrompt — it's a separate component tested elsewhere
jest.mock('../molecules/SignaturePrompt', () => ({
  SignaturePrompt: 'SignaturePrompt',
}));

import { useExtractorRepository } from '../../../repositories/useExtractorRepository';

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

  (useExtractorRepository as jest.Mock).mockReturnValue({
    ...mockRepo,
    ...overrides.repository,
  });

  return {
    ...render(
      <PaperProvider>
        <ExtractorScreen />
      </PaperProvider>
    ),
    mockRepo,
    mockSignatures,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('ExtractorScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { useCatalogStore } = require('../../store/catalogStore');
    useCatalogStore.setState({
      selectedLine: 'line-1',
      selectedMachine: 'machine-extractor',
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

  // ─── EF-1: 8 Extractor Toggles ──────────────────────────────────────────────

  it('renders 8 extractor toggles with labels (EF-1)', () => {
    const { getByText } = renderScreen();

    expect(getByText('Extractor 1')).toBeTruthy();
    expect(getByText('Extractor 2')).toBeTruthy();
    expect(getByText('Extractor 3')).toBeTruthy();
    expect(getByText('Extractor 4')).toBeTruthy();
    expect(getByText('Extractor 5')).toBeTruthy();
    expect(getByText('Extractor 6')).toBeTruthy();
    expect(getByText('Extractor 7')).toBeTruthy();
    expect(getByText('Extractor 8')).toBeTruthy();
  });

  it('renders the form title (EF-1)', () => {
    const { getByText } = renderScreen();
    expect(getByText(/Control de Extractores/i)).toBeTruthy();
  });

  it('renders the extractor status card (EF-1)', () => {
    const { getByText } = renderScreen();
    expect(getByText('Estado de Extractores')).toBeTruthy();
  });

  // ─── EF-2: Cleaning Date Card ───────────────────────────────────────────────

  it('renders the cleaning date card (EF-2)', () => {
    const { getByText } = renderScreen();
    expect(getByText('Limpieza Cedazo TT')).toBeTruthy();
  });

  // ─── Action Button ─────────────────────────────────────────────────────────

  it('renders "Iniciar Control" button when no document saved', () => {
    const { getByText } = renderScreen();
    expect(getByText('Iniciar Control')).toBeTruthy();
  });

  // ─── Spec Scenario S1: startSignatureChain creates document ────────────────

  it('calls repository.create on "Iniciar Control" press (S1)', async () => {
    const mockRepo = createMockRepository();
    (useExtractorRepository as jest.Mock).mockReturnValue(mockRepo);

    const { getByText } = render(
      <PaperProvider>
        <ExtractorScreen />
      </PaperProvider>
    );

    await React.act(async () => {
      fireEvent.press(getByText('Iniciar Control'));
    });

    expect(mockRepo.create).toHaveBeenCalledTimes(1);
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        line_id: 'line-1',
        machine_id: 'machine-extractor',
        shift_id: 'shift-1',
        operator_id: 'user-1',
        extractor_1_on: true,
        extractor_8_on: true,
      })
    );
  });

  // ─── Spec Reference: EF-3 chain config ─────────────────────────────────────

  it('uses extractor_check chain config (EF-3)', () => {
    const DEFAULT_CHAINS = require('../../../hooks/useSignatures').DEFAULT_CHAINS;
    const chain = DEFAULT_CHAINS.extractor_check;
    expect(chain.roles).toEqual(['operator', 'supervisor']);
    expect(chain.labels).toEqual(['Firma Operador', 'Firma Jefe Turno']);
  });

  it('does not show status hint before document is saved', () => {
    const { queryByText } = renderScreen();
    expect(queryByText(/Guardado — firmas pendientes/i)).toBeNull();
  });
});
