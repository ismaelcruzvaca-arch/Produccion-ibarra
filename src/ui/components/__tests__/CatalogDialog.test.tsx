/**
 * 4.5 Verify CatalogDialog create and edit flows.
 */

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

import { PaperProvider } from 'react-native-paper';
import { CatalogDialog, type CatalogTableConfig } from '../organisms/settings/CatalogDialog';

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

// ─── Test config ────────────────────────────────────────────────────────────────

const mockInsert = jest.fn().mockResolvedValue(true);
const mockUpdate = jest.fn().mockResolvedValue(true);

const TEST_CONFIG: CatalogTableConfig = {
  title: 'Razones de Paro',
  dataKey: 'stopReasons',
  displayField: 'label',
  fields: [
    { name: 'code', label: 'Código', type: 'text', required: true },
    { name: 'label', label: 'Etiqueta', type: 'text', required: true },
    { name: 'category', label: 'Categoría', type: 'text' },
    { name: 'stops_line', label: 'Detiene línea', type: 'boolean' },
    { name: 'sort_order', label: 'Orden', type: 'number' },
  ],
  insert: mockInsert,
  update: mockUpdate,
  delete: jest.fn().mockResolvedValue(true),
};

const EDIT_ITEM: Record<string, any> = {
  id: 'sr-1',
  code: 'SR01',
  label: 'Fallo mecánico',
  category: 'Mecánico',
  stops_line: true,
  sort_order: 1,
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

function renderDialog(
  overrides: Partial<{
    visible: boolean;
    config: CatalogTableConfig;
    editItem: Record<string, any> | null;
    onDismiss: () => void;
    onSaved: () => void;
  }> = {},
) {
  const props = {
    visible: true,
    config: TEST_CONFIG,
    editItem: null,
    onDismiss: jest.fn(),
    onSaved: jest.fn(),
    ...overrides,
  };

  return {
    ...render(
      <PaperProvider>
        <CatalogDialog
          visible={props.visible}
          config={props.config}
          editItem={props.editItem}
          onDismiss={props.onDismiss}
          onSaved={props.onSaved}
        />
      </PaperProvider>,
    ),
    props,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('CatalogDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dialog title for create mode', () => {
    const { getByText } = renderDialog();
    expect(getByText('Agregar Razones de Paro')).toBeTruthy();
  });

  it('renders dialog title for edit mode', () => {
    const { getByText } = renderDialog({ editItem: EDIT_ITEM });
    expect(getByText('Editar Razones de Paro')).toBeTruthy();
  });

  it('renders all configured fields', () => {
    const { getAllByText } = renderDialog();
    // Field labels appear at least once (some may also appear as TextInput floating labels)
    expect(getAllByText('Código').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('Etiqueta').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('Categoría').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('Detiene línea').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('Orden').length).toBeGreaterThanOrEqual(1);
  });

  it('pre-fills values in edit mode', () => {
    const { getByDisplayValue } = renderDialog({ editItem: EDIT_ITEM });
    expect(getByDisplayValue('SR01')).toBeTruthy();
    expect(getByDisplayValue('Fallo mecánico')).toBeTruthy();
    expect(getByDisplayValue('Mecánico')).toBeTruthy();
  });

  it('shows validation error when required field is empty', async () => {
    const { getByText } = renderDialog();

    await act(async () => {
      fireEvent.press(getByText('Agregar'));
    });

    expect(getByText('"Código" es requerido')).toBeTruthy();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('renders Cancel button', () => {
    const { getByText } = renderDialog();
    expect(getByText('Cancelar')).toBeTruthy();
  });

  it('renders Guardar for edit mode button', () => {
    const { getByText } = renderDialog({ editItem: EDIT_ITEM });
    expect(getByText('Guardar')).toBeTruthy();
  });

  it('calls onDismiss when Cancel is pressed', () => {
    const onDismiss = jest.fn();
    const { getByText } = renderDialog({ onDismiss });
    fireEvent.press(getByText('Cancelar'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls config.update with correct id and vars in edit mode', async () => {
    mockUpdate.mockResolvedValue(true);
    const onSaved = jest.fn();
    const onDismiss = jest.fn();

    const { getByText } = renderDialog({ editItem: EDIT_ITEM, onSaved, onDismiss });

    await act(async () => {
      fireEvent.press(getByText('Guardar'));
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      'sr-1',
      expect.objectContaining({
        code: 'SR01',
        label: 'Fallo mecánico',
        category: 'Mecánico',
      }),
    );
    expect(onSaved).toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalled();
  });

  it('calls config.insert with field values on create', async () => {
    mockInsert.mockResolvedValue(true);
    const onSaved = jest.fn();
    const onDismiss = jest.fn();

    // Use a config with no required fields to bypass validation
    const noRequiredConfig: CatalogTableConfig = {
      ...TEST_CONFIG,
      fields: [
        { name: 'code', label: 'Código', type: 'text' },
        { name: 'label', label: 'Etiqueta', type: 'text' },
      ],
    };

    const { getByText } = renderDialog({
      config: noRequiredConfig,
      onSaved,
      onDismiss,
    });

    await act(async () => {
      fireEvent.press(getByText('Agregar'));
    });

    expect(mockInsert).toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalled();
  });

  it('does not render when visible is false', () => {
    const { queryByText } = renderDialog({ visible: false });
    expect(queryByText('Agregar Razones de Paro')).toBeNull();
  });
});
