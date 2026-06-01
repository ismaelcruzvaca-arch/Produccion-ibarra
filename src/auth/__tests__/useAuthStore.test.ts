/**
 * Unit tests for useAuthStore — fetchOperatorProfile role resolution.
 *
 * Pattern: Zustand store state inspection with mocked Nhost GraphQL client.
 * Why not render a component:
 *   fetchOperatorProfile is a pure store action with no UI side effects.
 *   Testing via getState/setState is faster and avoids React component setup.
 *
 * Run: npx jest src/auth/__tests__/useAuthStore.test.ts
 */

import { useAuthStore } from '../useAuthStore';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../graphql/nhostClient', () => ({
  nhost: {
    graphql: {
      request: jest.fn(),
    },
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setUser(userId: string) {
  useAuthStore.setState({
    user: { id: userId },
    isAuthenticated: true,
    isLoading: false,
    error: null,
  });
}

function mockProfileResponse(
  profile: { id: string; full_name: string; role: string } | null,
  assignments: { line_id: string }[] = [],
) {
  const { nhost } = require('../../graphql/nhostClient');
  (nhost.graphql.request as jest.Mock)
    .mockReset()
    .mockResolvedValueOnce({ data: { operator_profiles_by_pk: profile } })
    .mockResolvedValueOnce({ data: { user_line_assignments: assignments } });
}

function mockNetworkError() {
  const { nhost } = require('../../graphql/nhostClient');
  (nhost.graphql.request as jest.Mock)
    .mockReset()
    .mockRejectedValue(new Error('Network error'));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useAuthStore — fetchOperatorProfile role', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
      operatorId: null,
      assignedLines: [],
      selectedLine: null,
      role: null,
    });
  });

  it('should set store.role from profile when fetchOperatorProfile succeeds', async () => {
    setUser('user-001');
    mockProfileResponse({ id: 'user-001', full_name: 'Operator A', role: 'operator' });

    await useAuthStore.getState().fetchOperatorProfile();

    expect(useAuthStore.getState().role).toBe('operator');
  });

  it('should set store.role to supervisor when profile role is supervisor', async () => {
    setUser('user-002');
    mockProfileResponse({ id: 'user-002', full_name: 'Supervisor B', role: 'supervisor' });

    await useAuthStore.getState().fetchOperatorProfile();

    expect(useAuthStore.getState().role).toBe('supervisor');
  });

  it('should set store.role to admin when profile role is admin', async () => {
    setUser('user-003');
    mockProfileResponse({ id: 'user-003', full_name: 'Admin C', role: 'admin' });

    await useAuthStore.getState().fetchOperatorProfile();

    expect(useAuthStore.getState().role).toBe('admin');
  });

  it('should default to operator when profile role is null', async () => {
    setUser('user-004');
    mockProfileResponse({ id: 'user-004', full_name: 'User D', role: null as unknown as string });

    await useAuthStore.getState().fetchOperatorProfile();

    expect(useAuthStore.getState().role).toBe('operator');
  });

  it('should default to operator when no operator_profiles row exists (profile is null)', async () => {
    setUser('user-005');
    mockProfileResponse(null);

    await useAuthStore.getState().fetchOperatorProfile();

    expect(useAuthStore.getState().role).toBe('operator');
  });

  it('should set role to operator on network error fallback', async () => {
    setUser('user-006');
    mockNetworkError();

    await useAuthStore.getState().fetchOperatorProfile();

    // On network failure, the catch block defaults role to 'operator'
    expect(useAuthStore.getState().role).toBe('operator');
  });

  it('should not change role when user is null (fetchOperatorProfile returns early)', async () => {
    // user is already null from beforeEach — fetchOperatorProfile should return
    // before making any GraphQL calls
    await useAuthStore.getState().fetchOperatorProfile();

    // The function returns early when user is null, so role stays null
    expect(useAuthStore.getState().role).toBeNull();
  });

  it('should not change role when user has no id', async () => {
    useAuthStore.setState({ user: { name: 'no-id-user' } });

    await useAuthStore.getState().fetchOperatorProfile();

    // The function returns early when user has no id, so role stays null
    expect(useAuthStore.getState().role).toBeNull();
  });
});
