/**
 * EmptyInspectionList unit tests.
 *
 * Spec compliance:
 * - QC-12: SHALL empty state CTA when no inspections
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { PaperProvider } from 'react-native-paper';
import { EmptyInspectionList } from '../atoms/EmptyInspectionList';

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

// ─── Helpers ────────────────────────────────────────────────────────────────────

function renderEmptyList(overrides: Record<string, any> = {}) {
  const props = {
    ...overrides,
  };

  return {
    ...render(
      <PaperProvider>
        <EmptyInspectionList {...props} />
      </PaperProvider>
    ),
    props,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('EmptyInspectionList', () => {
  it('renders default message when no message prop', () => {
    const { getByText } = renderEmptyList();

    expect(getByText('No hay inspecciones de calidad registradas')).toBeTruthy();
  });

  it('renders custom message when provided', () => {
    const { getByText } = renderEmptyList({
      message: 'No hay datos para este turno',
    });

    expect(getByText('No hay datos para este turno')).toBeTruthy();
  });

  it('shows CTA button when showCta is true and onCtaPress provided', () => {
    const onCtaPress = jest.fn();
    const { getByText } = renderEmptyList({
      showCta: true,
      onCtaPress,
    });

    expect(getByText('Nueva Inspección')).toBeTruthy();
  });

  it('hides CTA button when showCta is false even with onCtaPress', () => {
    const onCtaPress = jest.fn();
    const { queryByText } = renderEmptyList({
      showCta: false,
      onCtaPress,
    });

    expect(queryByText('Nueva Inspección')).toBeNull();
  });

  it('hides CTA button when showCta is true but onCtaPress is not provided', () => {
    const { queryByText } = renderEmptyList({
      showCta: true,
    });

    expect(queryByText('Nueva Inspección')).toBeNull();
  });

  it('fires onCtaPress when CTA button is pressed', () => {
    const onCtaPress = jest.fn();
    const { getByText } = renderEmptyList({
      showCta: true,
      onCtaPress,
    });

    fireEvent.press(getByText('Nueva Inspección'));
    expect(onCtaPress).toHaveBeenCalledTimes(1);
  });

  it('renders custom CTA label when provided', () => {
    const onCtaPress = jest.fn();
    const { getByText } = renderEmptyList({
      showCta: true,
      onCtaPress,
      ctaLabel: 'Comenzar Inspección',
    });

    expect(getByText('Comenzar Inspección')).toBeTruthy();
  });

  it('renders the list icon', () => {
    const { getByText } = renderEmptyList();
    expect(getByText('📋')).toBeTruthy();
  });
});
