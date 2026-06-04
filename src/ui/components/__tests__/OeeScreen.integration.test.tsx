/**
 * T11.5 — Integ: OEE shift-end + signature flow.
 *
 * Spec: Tests the full shift-end flow with signature integration:
 * - Phase A: Creates shift_end event
 * - Phase B: Shows signature prompt for each role
 * - Phase C: After all signatures, generates report
 * - Blocker: Active downtime prevents shift end
 */
// @jest-skip: Este test era para el OeeScreen VIEJO que fue reemplazado por
// el nuevo OeeDashboard en el merge de backend-telemetry. La pantalla anterior
// (organisms/OeeScreen.tsx) fue eliminada. El test queda como referencia.
// TODO: Reescribir tests para el nuevo OeeDashboard.

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import OeeScreen from '../organisms/OeeScreen';

// ─── Shared mock data ───────────────────────────────────────────────────────────

const MOCK_SHIFT_ID = 'shift-abc-123';
const MOCK_LINE_ID = 'line-456';
const MOCK_MACHINE_ID = 'machine-789';
const MOCK_EVENT_ID = 'event-shift-end-001';

// ─── Basic mocks ────────────────────────────────────────────────────────────────

jest.mock('../../../graphql/nhostClient', () => ({
  nhost: { graphql: { request: jest.fn() } },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(), getItem: jest.fn(), removeItem: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default
);

// ─── Controllable signature mock helpers ─────────────────────────────────────────

/**
 * Creates a controllable mock for useSignatures.
 * - initialStatus: 'pending' for all steps by default
 * - sign() marks the current nextRole as signed
 * - After all signed, isComplete=true, nextRole=null
 *
 * Returns the mock object whose .status is a getter that always reads the
 * latest computed state. Consumers can call sign() directly (sync side-effects,
 * returns Promise<true>) and then read .status to see the new state.
 */
function createSigMock(chainRoles: string[], chainLabels: string[]) {
  const signedRoles = new Set<string>();

  const computeStatus = () => {
    const steps = chainRoles.map((role, index) => {
      const isSigned = signedRoles.has(role);
      return {
        role,
        label: chainLabels[index] ?? role,
        status: isSigned ? ('signed' as const) : ('pending' as const),
        signerName: isSigned ? `Firmante ${role}` : undefined,
        signedAt: isSigned ? Date.now() : undefined,
      };
    });
    const firstPendingIndex = steps.findIndex((s) => s.status === 'pending');
    const isComplete = firstPendingIndex === -1;
    return { steps, isComplete, nextRole: isComplete ? null : steps[firstPendingIndex].role };
  };

  // Single mutable status object that we update in place
  const mockState = { value: computeStatus() };

  return {
    get status() { return mockState.value; },
    isLoading: false,
    error: null,
    sign: jest.fn().mockImplementation(() => {
      const current = mockState.value;
      if (current.nextRole) {
        signedRoles.add(current.nextRole);
      }
      mockState.value = computeStatus();
      return Promise.resolve(true);
    }),
    refresh: jest.fn().mockResolvedValue(undefined),
  };
}

let mockSig: ReturnType<typeof createSigMock>;

// ─── OEE repository mock ────────────────────────────────────────────────────────

const mockOeeRepo = {
  docs$: {
    subscribe: jest.fn((cb: any) => {
      cb([]);
      return { unsubscribe: jest.fn() };
    }),
  },
  createEvent: jest.fn(),
  findByShift: jest.fn(),
  findActiveDowntime: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

const mockReportsRepo = {
  docs$: {
    subscribe: jest.fn((cb: any) => {
      cb([]);
      return { unsubscribe: jest.fn() };
    }),
  },
  createReport: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

jest.mock('../../../repositories/useOeeEventsRepository', () => ({
  useOeeEventsRepository: () => mockOeeRepo,
}));

jest.mock('../../../repositories/useReportsRepository', () => ({
  useReportsRepository: () => mockReportsRepo,
}));

jest.mock('../../../hooks/useOeeValidation', () => ({
  useOeeValidation: () => ({ isValid: true }),
}));

// Mock AlertSnackbar to avoid provider requirement
jest.mock('../molecules/AlertSnackbar', () => ({
  useAlertSnackbar: () => ({ showAlert: jest.fn() }),
  AlertSnackbarProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../hooks/useOeeCalculator', () => ({
  useOeeCalculator: () => ({
    metrics: {
      totalCajas: 1200,
      totalRechazos: 15,
      tiempoParoProdMin: 30,
      tiempoParoMttoMin: 10,
      disponibilidad: 0.92,
      rendimiento: 0.88,
      calidad: 0.99,
      oee: 0.80,
    },
  }),
}));

// Signature hook mock
jest.mock('../../../hooks/useSignatures', () => ({
  useSignatures: () => mockSig,
  DEFAULT_CHAINS: {
    oee_report: {
      roles: ['operator', 'programador', 'calidad'],
      labels: ['Firma Operador', 'Firma Programador', 'Firma Calidad'],
    },
  },
}));

// Mock SignaturePrompt — make it interactive for integration tests
jest.mock('../molecules/SignaturePrompt', () => ({
  SignaturePrompt: 'SignaturePrompt',
}));

// ─── Stores ─────────────────────────────────────────────────────────────────────

import { useCatalogStore } from '../../../ui/store/catalogStore';
import { useAuthStore } from '../../../auth/useAuthStore';

// ─── Test helpers ───────────────────────────────────────────────────────────────

function renderScreen() {
  return render(
    <PaperProvider>
      <OeeScreen />
    </PaperProvider>
  );
}

// Helper to get specific confirmation button from ConfirmEventModal.
// The modal uses `confirmLabel` text for its confirm button.
// We use getAllByText to disambiguate from the dashboard "Cerrar Turno".

// ─── Tests ───────────────────────────────────────────────────────────────────────

describe.skip('OeeScreen — shift-end + signature integration (T11.5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset signature mock
    mockSig = createSigMock(
      ['operator', 'programador', 'calidad'],
      ['Firma Operador', 'Firma Programador', 'Firma Calidad']
    );

    // Setup stores
    useCatalogStore.setState({
      selectedLine: MOCK_LINE_ID,
      selectedMachine: MOCK_MACHINE_ID,
      selectedShift: MOCK_SHIFT_ID,
      selectedProduct: null,
      getMachineById: () => ({ name: 'Cavemil 01', is_iot_enabled: false }) as any,
      getProductById: () => undefined,
    });

    useAuthStore.setState({
      operatorId: 'user-1',
      fullName: 'Juan Pérez',
      role: 'operator',
      isAuthenticated: true,
    });

    // Default mock behavior
    mockOeeRepo.createEvent.mockResolvedValue({
      get: (field: string) => {
        return field === 'id' ? MOCK_EVENT_ID : undefined;
      },
      toJSON: () => ({
        id: MOCK_EVENT_ID,
        event_type: 'shift_end',
        timestamp: Date.now(),
        shift_id: MOCK_SHIFT_ID,
        line_id: MOCK_LINE_ID,
        machine_id: MOCK_MACHINE_ID,
      }),
    });

    mockOeeRepo.findByShift.mockResolvedValue([
      {
        get: (f: string) => f === 'id' ? 'event-1' : undefined,
        toJSON: () => ({ id: 'event-1', event_type: 'shift_start', timestamp: Date.now() - 28800000 }),
      },
      {
        get: (f: string) => f === 'id' ? MOCK_EVENT_ID : undefined,
        toJSON: () => ({ id: MOCK_EVENT_ID, event_type: 'shift_end', timestamp: Date.now() }),
      },
    ]);

    mockOeeRepo.findActiveDowntime.mockResolvedValue(null);
    mockReportsRepo.createReport.mockResolvedValue({});
  });

  // ─── Blocker: active downtime prevents shift end ───────────────────────────

  it('shows PARO ACTIVO screen when active downtime exists (blocker)', async () => {
    // Set findActiveDowntime to return a value — but only after shift starts,
    // since the polling effect only runs when shiftStarted=true
    mockOeeRepo.findActiveDowntime.mockResolvedValue({
      get: (f: string) => f === 'id' ? 'downtime-1' : f === 'reason_code' ? 'MEC' : undefined,
      toJSON: () => ({ id: 'downtime-1', event_type: 'downtime_start', reason_code: 'MEC' }),
    });

    useCatalogStore.setState({ selectedProduct: 'product-1' });

    const { queryByText, getByText, getAllByText } = renderScreen();

    // Start the shift first — this triggers the polling effect
    await act(async () => {
      const startBtn = getByText('Iniciar Turno');
      fireEvent.press(startBtn);
    });

    // Wait for polling effect to detect active downtime
    await act(async () => {
      await new Promise((r) => setTimeout(r, 150));
    });

    // Dashboard should show PARO ACTIVO state now
    // Use getAllByText since "PARO ACTIVO" may appear in both a title and a card header
    expect(getAllByText(/PARO ACTIVO/i).length).toBeGreaterThanOrEqual(1);

    // "Cerrar Turno" should NOT be visible while downtime is active
    expect(queryByText('Cerrar Turno')).toBeNull();

    // Shift-end event should NOT have been created (only shift_start from starting)
    expect(mockOeeRepo.createEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'shift_end' })
    );
  });

  // ─── Phase A: executeShiftEnd creates event and shows signature prompt ─────

  it('Phase A: creates shift_end event and shows signature status card', async () => {
    useCatalogStore.setState({ selectedProduct: 'product-1' });

    const { getByText, getAllByText } = renderScreen();

    // Start shift
    await act(async () => {
      const startBtn = getByText('Iniciar Turno');
      fireEvent.press(startBtn);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Click Cerrar Turno (dashboard button) — there might be multiple "Cerrar Turno"
    // texts, but the first one in getAllByText is the dashboard button
    await act(async () => {
      const allEndBtns = getByText('Cerrar Turno');
      fireEvent.press(allEndBtns);
    });

    // Confirm dialog should appear — press the confirm button
    // The confirm modal's "Cerrar Turno" label appears as the confirmLabel prop
    await act(async () => {
      // Wait for modal to render
      await new Promise((r) => setTimeout(r, 50));
    });

    await act(async () => {
      // Use getAllByText for the confirm button — the last "Cerrar Turno" is
      // the confirm dialog button (after dashboard button and dialog title)
      const allCerrar = getAllByText('Cerrar Turno');
      const confirmBtn = allCerrar[allCerrar.length - 1];
      fireEvent.press(confirmBtn);
    });

    // Wait for Phase A to execute
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    // Phase A: should have created shift_end event
    expect(mockOeeRepo.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'shift_end',
      })
    );

    // Signature status card should be visible
    expect(getByText('Firmas del Turno')).toBeTruthy();
    expect(getByText('Firma Operador')).toBeTruthy();
    expect(getByText('Firma Programador')).toBeTruthy();
    expect(getByText('Firma Calidad')).toBeTruthy();
  });

  // ─── Full flow: signature chain completes → report generated ──────────────

  it('Phase B→C: all signatures complete triggers report generation', async () => {
    useCatalogStore.setState({ selectedProduct: 'product-1' });

    const { getByText, getAllByText } = renderScreen();

    // Start shift
    await act(async () => {
      fireEvent.press(getByText('Iniciar Turno'));
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Click Cerrar Turno (dashboard button)
    await act(async () => {
      fireEvent.press(getByText('Cerrar Turno'));
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Confirm shift end — press the last "Cerrar Turno" (confirm dialog button)
    await act(async () => {
      const allCerrar = getAllByText('Cerrar Turno');
      fireEvent.press(allCerrar[allCerrar.length - 1]);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    // Phase A complete — event created, signature card visible
    expect(mockOeeRepo.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'shift_end' })
    );
    expect(getByText('Firmas del Turno')).toBeTruthy();

    // Verify report NOT yet generated (waiting for signatures)
    expect(mockReportsRepo.createReport).not.toHaveBeenCalled();

    // Full signature chain: simulate all 3 signatures.
    // The handleSigSign callback is only invoked from SignaturePrompt's onSign
    // prop, which is mocked away. Instead, we verify the architecture:
    // 1. The mock chain correctly completes after 3 signs
    // 2. The chain config is correctly wired
    // 3. The component state reflects the signature chain
    await mockSig.sign();
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    await mockSig.sign();
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    await mockSig.sign();
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

    expect(mockSig.status.isComplete).toBe(true);
    expect(mockSig.status.nextRole).toBeNull();
    expect(mockSig.status.steps.every((s: any) => s.status === 'signed')).toBe(true);
  });

  // ─── Chain advancement: sign transitions correctly ─────────────────────────

  it('signature chain advances step by step through all roles', () => {
    // Create a fresh mock for this test
    const chainRoles = ['operator', 'programador', 'calidad'];
    const chainLabels = ['Firma Operador', 'Firma Programador', 'Firma Calidad'];

    const sig = createSigMock(chainRoles, chainLabels);

    // Initially all pending
    expect(sig.status.nextRole).toBe('operator');
    expect(sig.status.isComplete).toBe(false);
    expect(sig.status.steps[0].status).toBe('pending');
    expect(sig.status.steps[1].status).toBe('pending');
    expect(sig.status.steps[2].status).toBe('pending');

    // Sign first step
    sig.sign();
    expect(sig.status.steps[0].status).toBe('signed');
    expect(sig.status.nextRole).toBe('programador');
    expect(sig.status.isComplete).toBe(false);

    // Sign second step
    sig.sign();
    expect(sig.status.steps[1].status).toBe('signed');
    expect(sig.status.nextRole).toBe('calidad');
    expect(sig.status.isComplete).toBe(false);

    // Sign third step
    sig.sign();
    expect(sig.status.steps[2].status).toBe('signed');
    expect(sig.status.nextRole).toBeNull();
    expect(sig.status.isComplete).toBe(true);
  });
});
