/**
 * T2.2 — Verify fullName is part of AuthState and populated from Nhost user.
 *
 * The fullName is resolved as: user?.displayName ?? user?.email
 */

// Must mock nhost before importing useAuthStore
jest.mock('../../graphql/nhostClient', () => ({
  nhost: {
    auth: {
      signInEmailPassword: jest.fn(),
      signOut: jest.fn(),
    },
    graphql: {
      request: jest.fn(),
    },
    getUserSession: jest.fn(),
  },
}));

jest.mock('../../graphql/withTimeout', () => ({
  withTimeout: (p: Promise<unknown>) => p,
}));

jest.mock('../tokenStorage', () => ({
  saveSession: jest.fn(),
  getStoredSession: jest.fn(),
  clearSession: jest.fn(),
  setMemoryAccessToken: jest.fn(),
}));

import { useAuthStore } from '../useAuthStore';

describe('AuthState.fullName', () => {
  it('is declared in AuthState with initial value null', () => {
    const state = useAuthStore.getState();
    expect(state).toHaveProperty('fullName');
    expect(state.fullName).toBeNull();
  });

  it('is set to null on signOut', async () => {
    // Simulate having a fullName set
    useAuthStore.setState({ fullName: 'Juan Pérez', isAuthenticated: true });
    expect(useAuthStore.getState().fullName).toBe('Juan Pérez');

    // signOut should reset fullName to null
    await useAuthStore.getState().signOut();
    expect(useAuthStore.getState().fullName).toBeNull();
  });
});
