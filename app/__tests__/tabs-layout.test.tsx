/**
 * Unit tests for TabLayout supervisor tab visibility logic.
 *
 * Pattern: Component render with mocked Zustand store + Expo Router Tabs.
 * The isSupervisor flag controls whether the "Alertas" tab is rendered.
 *
 * Run: npx jest app/__tests__/tabs-layout.test.ts
 */

import React from 'react';
import { render } from '@testing-library/react-native';

// ─── Mocks (must be before all imports) ───────────────────────────────────────

// Mock useAuthStore to control role values directly
const mockUseAuthStore = jest.fn();
jest.mock('../../src/auth/useAuthStore', () => ({
  useAuthStore: (selector: (state: any) => any) => mockUseAuthStore(selector),
}));

// Mock expo-router Tabs — must use createElement, not JSX, because jest.mock
// factory functions run before JSX transform is loaded.
jest.mock('expo-router', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    Tabs: Object.assign(
      (props: { children: React.ReactNode }) =>
        React.createElement(View, { testID: 'tabs-container' }, props.children),
      {
        Screen: (props: { options: any }) => {
          const tabBarButton = props.options?.tabBarButton;
          const isVisible = tabBarButton === undefined;
          const title = props.options?.title ?? 'unknown';
          return React.createElement(
            View,
            { testID: `tab-${title}` },
            React.createElement(
              Text,
              { testID: `tab-visible-${title}` },
              isVisible ? 'visible' : 'hidden',
            ),
          );
        },
      },
    ),
  };
});

// Mock vector icons
jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

// Mock the sync error count hook
jest.mock('../../src/hooks/useSyncErrorCount', () => ({
  useSyncErrorCount: jest.fn(() => 0),
}));

// Mock react-native-safe-area-context (required by expo-router internals)
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

// ─── Import after mocks ───────────────────────────────────────────────────────

import TabLayout from '../(tabs)/_layout'; // eslint-disable-line import/order

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TabLayout — isSupervisor logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: useSyncErrorCount returns 0
    const { useSyncErrorCount } = require('../../src/hooks/useSyncErrorCount');
    (useSyncErrorCount as jest.Mock).mockReturnValue(0);
  });

  it('should show supervisor tab when role is supervisor', () => {
    mockUseAuthStore.mockImplementation((selector: (s: any) => any) =>
      selector({ role: 'supervisor' }),
    );

    const { getByTestId } = render(<TabLayout />);

    expect(getByTestId('tab-visible-Alertas').children[0]).toBe('visible');
  });

  it('should show supervisor tab when role is admin', () => {
    mockUseAuthStore.mockImplementation((selector: (s: any) => any) =>
      selector({ role: 'admin' }),
    );

    const { getByTestId } = render(<TabLayout />);

    expect(getByTestId('tab-visible-Alertas').children[0]).toBe('visible');
  });

  it('should hide supervisor tab when role is operator', () => {
    mockUseAuthStore.mockImplementation((selector: (s: any) => any) =>
      selector({ role: 'operator' }),
    );

    const { getByTestId } = render(<TabLayout />);

    expect(getByTestId('tab-visible-Alertas').children[0]).toBe('hidden');
  });

  it('should hide supervisor tab when role is null', () => {
    mockUseAuthStore.mockImplementation((selector: (s: any) => any) =>
      selector({ role: null }),
    );

    const { getByTestId } = render(<TabLayout />);

    expect(getByTestId('tab-visible-Alertas').children[0]).toBe('hidden');
  });

  it('should show Inicio, OEE, Alertas, and Ajustes tabs', () => {
    mockUseAuthStore.mockImplementation((selector: (s: any) => any) =>
      selector({ role: 'operator' }),
    );

    const { getByTestId } = render(<TabLayout />);

    // All four tab names should be present
    expect(getByTestId('tab-Inicio')).toBeTruthy();
    expect(getByTestId('tab-OEE')).toBeTruthy();
    expect(getByTestId('tab-Alertas')).toBeTruthy();
    expect(getByTestId('tab-Ajustes')).toBeTruthy();
  });
});
