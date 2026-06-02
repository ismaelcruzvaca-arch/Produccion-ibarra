/**
 * T11.4 — Integ: FormRouter renders correct organism.
 *
 * Spec FR-1: resolves form from operator_profiles.line_id + machine_id
 * Spec FR-2: defaults to OEE when no station match
 *
 * Tests that forms.tsx renders the correct organism based on
 * useCatalogStore.selectedMachine, using substring matching.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

// setImmediate polyfill for test environment
if (typeof setImmediate === 'undefined') {
  (global as any).setImmediate = (fn: any, ...args: any[]) =>
    setTimeout(fn, 0, ...args);
}

import { PaperProvider } from 'react-native-paper';

// ─── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock('../../src/graphql/nhostClient', () => ({
  nhost: { graphql: { request: jest.fn() } },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(), getItem: jest.fn(), removeItem: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default
);

// Mock screen components to verify they are rendered
jest.mock('../../src/ui/components/organisms/OeeScreen', () => {
  const { View, Text } = require('react-native');
  return () => <View testID="OeeScreen"><Text>OEE Screen</Text></View>;
});

jest.mock('../../src/ui/components/organisms/ToasterScreen', () => {
  const { View, Text } = require('react-native');
  return () => <View testID="ToasterScreen"><Text>Toaster Screen</Text></View>;
});

jest.mock('../../src/ui/components/organisms/MixingScreen', () => {
  const { View, Text } = require('react-native');
  return () => <View testID="MixingScreen"><Text>Mixing Screen</Text></View>;
});

jest.mock('../../src/ui/components/organisms/ExtractorScreen', () => {
  const { View, Text } = require('react-native');
  return () => <View testID="ExtractorScreen"><Text>Extractor Screen</Text></View>;
});

jest.mock('../../src/ui/components/organisms/VitaminScreen', () => {
  const { View, Text } = require('react-native');
  return () => <View testID="VitaminScreen"><Text>Vitamin Screen</Text></View>;
});

// ─── Store mocks ─────────────────────────────────────────────────────────────────

// We'll directly control useCatalogStore state before each test
import { useCatalogStore } from '../../src/ui/store/catalogStore';

describe('FormRouter — organism rendering (T11.4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function renderForms() {
    const FormsScreen = require('../(tabs)/forms').default;
    return render(
      <PaperProvider>
        <FormsScreen />
      </PaperProvider>
    );
  }

  it('renders OeeScreen when no machine is selected (FR-2 default)', () => {
    useCatalogStore.setState({
      selectedLine: null,
      selectedMachine: null,
      selectedShift: null,
    });

    const { queryByTestId } = renderForms();
    expect(queryByTestId('OeeScreen')).toBeTruthy();
    expect(queryByTestId('ToasterScreen')).toBeNull();
    expect(queryByTestId('MixingScreen')).toBeNull();
    expect(queryByTestId('ExtractorScreen')).toBeNull();
    expect(queryByTestId('VitaminScreen')).toBeNull();
  });

  it('renders OeeScreen for an unknown machine (FR-2 default)', () => {
    useCatalogStore.setState({
      selectedLine: 'line-1',
      selectedMachine: 'machine-unknown',
      selectedShift: 'shift-1',
    });

    // Mock getMachineById to return an unknown machine
    useCatalogStore.setState({
      getMachineById: () => ({ name: 'Cavemil 01' }) as any,
    });

    const { queryByTestId } = renderForms();
    expect(queryByTestId('OeeScreen')).toBeTruthy();
  });

  it('renders ToasterScreen for Tostador machine (S1)', () => {
    useCatalogStore.setState({
      selectedLine: 'line-1',
      selectedMachine: 'machine-toaster',
      selectedShift: 'shift-1',
      getMachineById: () => ({ name: 'Tostador 01' }) as any,
    });

    const { queryByTestId } = renderForms();
    expect(queryByTestId('ToasterScreen')).toBeTruthy();
    expect(queryByTestId('OeeScreen')).toBeNull();
  });

  it('renders MixingScreen for Mezcladora machine', () => {
    useCatalogStore.setState({
      selectedLine: 'line-1',
      selectedMachine: 'machine-mixer',
      selectedShift: 'shift-1',
      getMachineById: () => ({ name: 'Mezcladora 01' }) as any,
    });

    const { queryByTestId } = renderForms();
    expect(queryByTestId('MixingScreen')).toBeTruthy();
    expect(queryByTestId('OeeScreen')).toBeNull();
  });

  it('renders ExtractorScreen for Extractor machine', () => {
    useCatalogStore.setState({
      selectedLine: 'line-1',
      selectedMachine: 'machine-extractor',
      selectedShift: 'shift-1',
      getMachineById: () => ({ name: 'Extractor de grasa' }) as any,
    });

    const { queryByTestId } = renderForms();
    expect(queryByTestId('ExtractorScreen')).toBeTruthy();
    expect(queryByTestId('OeeScreen')).toBeNull();
  });

  it('renders VitaminScreen for Vitamin machine', () => {
    useCatalogStore.setState({
      selectedLine: 'line-1',
      selectedMachine: 'machine-vitamin',
      selectedShift: 'shift-1',
      getMachineById: () => ({ name: 'Vitamin Kit A' }) as any,
    });

    const { queryByTestId } = renderForms();
    expect(queryByTestId('VitaminScreen')).toBeTruthy();
    expect(queryByTestId('OeeScreen')).toBeNull();
  });

  it('renders Agitador as MixingScreen', () => {
    useCatalogStore.setState({
      selectedLine: 'line-1',
      selectedMachine: 'machine-agitator',
      selectedShift: 'shift-1',
      getMachineById: () => ({ name: 'Agitador 01' }) as any,
    });

    const { queryByTestId } = renderForms();
    expect(queryByTestId('MixingScreen')).toBeTruthy();
  });
});
