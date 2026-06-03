/**
 * 4.1 Verify SettingsProfile renders user info from useAuthStore.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { PaperProvider } from 'react-native-paper';
import { SettingsProfile } from '../organisms/settings/SettingsProfile';

// ─── Standard mocks ─────────────────────────────────────────────────────────────

jest.mock('../../../graphql/nhostClient', () => ({
  nhost: { graphql: { request: jest.fn() } },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(), getItem: jest.fn(), removeItem: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default
);

// ─── Auto-mock stores — all exports become jest.fn() ─────────────────────────

jest.mock('../../../auth/useAuthStore');
jest.mock('../../store/catalogStore');

// Mock SyncMonitor to avoid RxDB replication context
jest.mock('../SyncMonitor', () => ({
  SyncMonitor: () => null,
}));

// ─── Default mock implementations ───────────────────────────────────────────────

beforeEach(() => {
  const { useAuthStore } = jest.requireMock('../../../auth/useAuthStore');
  const { useCatalogStore } = jest.requireMock('../../store/catalogStore');

  useAuthStore.mockImplementation((selector: any) => {
    const state = {
      fullName: 'Juan Pérez',
      role: 'admin',
      signOut: jest.fn(),
      isLoading: false,
      isAuthenticated: true,
    };
    return selector ? selector(state) : state;
  });

  useCatalogStore.mockImplementation((selector: any) => {
    const state = {
      selectedLine: 'line-1',
      getLineById: (id: string) =>
        id === 'line-1' ? { id: 'line-1', name: 'Línea Principal', is_active: true } : undefined,
      lines: [],
    };
    return selector ? selector(state) : state;
  });
});

// ─── Helpers ────────────────────────────────────────────────────────────────────

function renderProfile() {
  return render(
    <PaperProvider>
      <SettingsProfile />
    </PaperProvider>,
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('SettingsProfile', () => {
  it('renders the user full name', () => {
    const { getByText } = renderProfile();
    expect(getByText('Juan Pérez')).toBeTruthy();
  });

  it('shows "Usuario" fallback when fullName is null', () => {
    const { useAuthStore } = jest.requireMock('../../../auth/useAuthStore');
    useAuthStore.mockImplementation((selector: any) => {
      const state = { fullName: null, role: 'admin', signOut: jest.fn() };
      return selector ? selector(state) : state;
    });
    const { getByText } = renderProfile();
    expect(getByText('Usuario')).toBeTruthy();
  });

  it('renders admin badge for admin role', () => {
    const { getByText } = renderProfile();
    expect(getByText('Admin')).toBeTruthy();
  });

  it('renders operator badge for operator role', () => {
    const { useAuthStore } = jest.requireMock('../../../auth/useAuthStore');
    useAuthStore.mockImplementation((selector: any) => {
      const state = { fullName: 'Ana López', role: 'operator', signOut: jest.fn() };
      return selector ? selector(state) : state;
    });
    const { getByText } = renderProfile();
    expect(getByText('Operador')).toBeTruthy();
  });

  it('renders supervisor badge for supervisor role', () => {
    const { useAuthStore } = jest.requireMock('../../../auth/useAuthStore');
    useAuthStore.mockImplementation((selector: any) => {
      const state = { fullName: 'Carlos Ruiz', role: 'supervisor', signOut: jest.fn() };
      return selector ? selector(state) : state;
    });
    const { getByText } = renderProfile();
    expect(getByText('Supervisor')).toBeTruthy();
  });

  it('renders assigned line name when selectedLine is set', () => {
    const { getByText } = renderProfile();
    expect(getByText('Línea: Línea Principal')).toBeTruthy();
  });

  it('does not render line info when no selectedLine', () => {
    const { useCatalogStore } = jest.requireMock('../../store/catalogStore');
    useCatalogStore.mockImplementation((selector: any) => {
      const state = { selectedLine: null, getLineById: () => undefined };
      return selector ? selector(state) : state;
    });
    const { queryByText } = renderProfile();
    expect(queryByText(/Línea:/)).toBeNull();
  });

  it('renders logout button with Cerrar Sesión text', () => {
    const { getByText } = renderProfile();
    expect(getByText('Cerrar Sesión')).toBeTruthy();
  });

  it('calls signOut when logout button is pressed', () => {
    const { useAuthStore } = jest.requireMock('../../../auth/useAuthStore');
    const mockSignOut = jest.fn();
    useAuthStore.mockImplementation((selector: any) => {
      const state = { fullName: 'Juan Pérez', role: 'admin', signOut: mockSignOut };
      return selector ? selector(state) : state;
    });

    const { getByText } = renderProfile();
    fireEvent.press(getByText('Cerrar Sesión'));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
