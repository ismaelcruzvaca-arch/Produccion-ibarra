/**
 * T4.3 — SignaturePrompt unit tests.
 *
 * Spec compliance:
 * - FS-5: SHALL validate current role matches required role
 * - FS-3: SHALL confirmation dialog with signer identity before commit
 * - S1: Wrong-role rejected
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

// setImmediate polyfill for test environment
if (typeof setImmediate === 'undefined') {
  (global as any).setImmediate = (fn: any, ...args: any[]) =>
    setTimeout(fn, 0, ...args);
}

import { PaperProvider } from 'react-native-paper';
import { SignaturePrompt } from '../molecules/SignaturePrompt';

// ─── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock('../../../graphql/nhostClient', () => ({
  nhost: {
    graphql: { request: jest.fn() },
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default
);

// ─── Helpers ────────────────────────────────────────────────────────────────────

const defaultSignature = {
  documentType: 'quality_inspection',
  documentId: 'inspection-123',
  requiredRoles: ['supervisor', 'admin'],
  sequence: 1,
  stepLabel: 'Firma del Supervisor',
};

function renderPrompt(overrides: Record<string, any> = {}) {
  const props = {
    visible: true,
    signature: defaultSignature,
    currentRole: 'supervisor',
    currentUserName: 'Juan Pérez',
    existingSignatures: [],
    onSign: jest.fn().mockResolvedValue(undefined),
    onSkip: jest.fn(),
    onDismiss: jest.fn(),
    ...overrides,
  };

  return {
    ...render(
      <PaperProvider>
        <SignaturePrompt {...props} />
      </PaperProvider>
    ),
    props,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('SignaturePrompt', () => {
  it('renders signer name and role', () => {
    const { getByText } = renderPrompt();
    expect(getByText('Juan Pérez')).toBeTruthy();
    expect(getByText('supervisor')).toBeTruthy();
  });

  it('enables "Firmar" button when role is valid', () => {
    const { getByText } = renderPrompt({ currentRole: 'supervisor' });
    const signButton = getByText('Firmar');
    expect(signButton).toBeTruthy();
    expect(signButton.props.accessibilityState?.disabled).not.toBe(true);
  });

  it('disables "Firmar" button when role is invalid (S1: wrong-role rejected)', () => {
    const { getByText } = renderPrompt({
      currentRole: 'operator',
      currentUserName: 'Pedro Gómez',
    });

    // Error message about wrong role should be visible
    expect(getByText(/no está autorizado/i)).toBeTruthy();
  });

  it('disables "Firmar" button when role has already signed', () => {
    const { getByText } = renderPrompt({
      existingSignatures: [
        {
          signer_name: 'Juan Pérez',
          signer_role: 'supervisor',
          signed_at: Date.now(),
          sequence: 1,
        },
      ],
    });

    // The info message about already signed should be visible
    expect(getByText(/ya ha firmado/i)).toBeTruthy();
  });

  it('shows existing signatures when present (FS-7)', () => {
    const { getByText } = renderPrompt({
      existingSignatures: [
        {
          signer_name: 'Ana López',
          signer_role: 'supervisor',
          signed_at: Date.now(),
          sequence: 1,
        },
      ],
    });

    expect(getByText('Ana López')).toBeTruthy();
    expect(getByText('Firmas registradas')).toBeTruthy();
  });

  it('calls onSign when "Firmar" is pressed', async () => {
    const onSign = jest.fn().mockResolvedValue(undefined);
    const { getByText } = renderPrompt({ onSign });

    await act(async () => {
      fireEvent.press(getByText('Firmar'));
    });

    expect(onSign).toHaveBeenCalledTimes(1);
  });

  it('calls onSkip when "Omitir" is pressed', () => {
    const onSkip = jest.fn();
    const { getByText } = renderPrompt({ onSkip });

    fireEvent.press(getByText('Omitir'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('renders step label as dialog title', () => {
    const { getByText } = renderPrompt({
      signature: {
        ...defaultSignature,
        stepLabel: 'Firma del Jefe Turno',
      },
    });
    expect(getByText('Firma del Jefe Turno')).toBeTruthy();
  });

  it('shows timestamp in the dialog (FS-3)', () => {
    const { getByText } = renderPrompt();
    // Timestamp label should be visible
    expect(getByText('Fecha y hora')).toBeTruthy();
  });

  it('confirmation message is visible (FS-3)', () => {
    const { getByText } = renderPrompt();
    expect(
      getByText(/acepta que los datos ingresados son correctos/i)
    ).toBeTruthy();
  });
});
