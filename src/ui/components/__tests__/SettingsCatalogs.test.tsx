/**
 * 4.3 Verify SettingsCatalogs hidden for operator role.
 */

import React from 'react';
import { render } from '@testing-library/react-native';

import { PaperProvider } from 'react-native-paper';
import { SettingsCatalogs } from '../organisms/settings/SettingsCatalogs';

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

// ─── Auto-mock stores ───────────────────────────────────────────────────────────

jest.mock('../../../auth/useAuthStore');
jest.mock('../../store/catalogStore');

// ─── Default mock implementations ───────────────────────────────────────────────

beforeEach(() => {
  const { useAuthStore } = jest.requireMock('../../../auth/useAuthStore');
  const { useCatalogStore } = jest.requireMock('../../store/catalogStore');

  useAuthStore.mockReset();
  useAuthStore.mockImplementation((selector: any) => {
    const state = { role: 'admin' };
    return selector ? selector(state) : state;
  });

  useCatalogStore.mockReset();
  useCatalogStore.mockImplementation((selector: any) => {
    const state = {
      stopReasons: [
        { id: 'sr-1', code: 'SR01', label: 'Fallo mecánico', is_active: true },
      ],
      lines: [
        { id: 'line-1', name: 'Línea 1', is_active: true },
      ],
      machines: [
        { id: 'mach-1', line_id: 'line-1', name: 'Máquina 1', is_active: true },
      ],
      selectedLine: null,
      isLoading: false,
      lastFetchedAt: Date.now(),
      invalidateCache: jest.fn(),
    };
    return selector ? selector(state) : state;
  });
});

// ─── Helpers ────────────────────────────────────────────────────────────────────

function renderCatalogs() {
  return render(
    <PaperProvider>
      <SettingsCatalogs />
    </PaperProvider>,
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('SettingsCatalogs', () => {
  it('renders section title for all roles', () => {
    const { getByText } = renderCatalogs();
    expect(getByText('Razones de Paro')).toBeTruthy();
  });

  it('renders catalog section titles for admin role', () => {
    const { getByText } = renderCatalogs();
    expect(getByText('Razones de Paro')).toBeTruthy();
    expect(getByText('Líneas')).toBeTruthy();
    expect(getByText('Máquinas')).toBeTruthy();
  });

  it('renders read-only message for operator role', () => {
    const { useAuthStore } = jest.requireMock('../../../auth/useAuthStore');
    useAuthStore.mockImplementation((selector: any) => {
      const state = { role: 'operator' };
      return selector ? selector(state) : state;
    });

    const { getByText } = renderCatalogs();
    expect(getByText('Catálogos')).toBeTruthy();
    expect(getByText('Los catálogos son solo de lectura para su rol.')).toBeTruthy();
  });

  it('renders read-only message for supervisor role', () => {
    const { useAuthStore } = jest.requireMock('../../../auth/useAuthStore');
    useAuthStore.mockImplementation((selector: any) => {
      const state = { role: 'supervisor' };
      return selector ? selector(state) : state;
    });

    const { getByText } = renderCatalogs();
    expect(getByText('Catálogos')).toBeTruthy();
    expect(getByText('Los catálogos son solo de lectura para su rol.')).toBeTruthy();
  });

  it('renders items from store for admin role', () => {
    const { getByText } = renderCatalogs();
    expect(getByText('Fallo mecánico')).toBeTruthy();
    expect(getByText('Línea 1')).toBeTruthy();
    expect(getByText('Máquina 1')).toBeTruthy();
  });
});
