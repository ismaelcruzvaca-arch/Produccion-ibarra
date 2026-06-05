/**
 * 4.4 Verify CatalogSection fetches and displays catalog data.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { PaperProvider } from 'react-native-paper';
import { CatalogSection } from '../organisms/settings/CatalogSection';
import type { CatalogTableConfig } from '../organisms/settings/CatalogDialog';

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

// ─── Test config ────────────────────────────────────────────────────────────────

const mockInsert = jest.fn().mockResolvedValue(true);
const mockUpdate = jest.fn().mockResolvedValue(true);
const mockDelete = jest.fn().mockResolvedValue(true);

const TEST_CONFIG: CatalogTableConfig = {
  title: 'Razones de Paro',
  dataKey: 'stopReasons',
  displayField: 'label',
  fields: [
    { name: 'code', label: 'Código', type: 'text', required: true },
    { name: 'label', label: 'Etiqueta', type: 'text', required: true },
  ],
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
};

// ─── Default mock implementations ───────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

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
        { id: 'sr-1', code: 'SR01', label: 'Fallo mecánico', category: 'Mecánico', is_active: true },
        { id: 'sr-2', code: 'SR02', label: 'Fallo eléctrico', category: 'Eléctrico', is_active: true },
      ],
      lines: [],
      machines: [],
      isLoading: false,
      invalidateCache: jest.fn(),
    };
    return selector ? selector(state) : state;
  });
});

// ─── Helpers ────────────────────────────────────────────────────────────────────

function renderSection(config: CatalogTableConfig = TEST_CONFIG) {
  return render(
    <PaperProvider>
      <CatalogSection config={config} />
    </PaperProvider>,
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('CatalogSection', () => {
  it('renders the section title', () => {
    const { getByText } = renderSection();
    expect(getByText('Razones de Paro')).toBeTruthy();
  });

  it('renders catalog items from store', () => {
    const { getByText } = renderSection();
    expect(getByText('Fallo mecánico')).toBeTruthy();
    expect(getByText('Fallo eléctrico')).toBeTruthy();
  });

  it('shows add button for admin role', () => {
    const { getByText } = renderSection();
    expect(getByText('Agregar')).toBeTruthy();
  });

  it('does not show add button for operator role', () => {
    const { useAuthStore } = jest.requireMock('../../../auth/useAuthStore');
    useAuthStore.mockImplementation((selector: any) => {
      const state = { role: 'operator' };
      return selector ? selector(state) : state;
    });
    const { queryByText } = renderSection();
    expect(queryByText('Agregar')).toBeNull();
  });

  it('shows empty text when no items', () => {
    const { useCatalogStore } = jest.requireMock('../../store/catalogStore');
    useCatalogStore.mockImplementation((selector: any) => {
      const state = { stopReasons: [], isLoading: false, invalidateCache: jest.fn() };
      return selector ? selector(state) : state;
    });
    const { getByText } = renderSection();
    expect(getByText('Sin registros')).toBeTruthy();
  });

  it('opens create dialog when Agregar is pressed', () => {
    const { getByText } = renderSection();
    fireEvent.press(getByText('Agregar'));
    expect(getByText('Agregar Razones de Paro')).toBeTruthy();
  });
});
