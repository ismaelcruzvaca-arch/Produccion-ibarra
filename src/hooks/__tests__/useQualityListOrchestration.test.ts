/**
 * useQualityListOrchestration unit tests.
 *
 * Spec compliance:
 * - QC-1: MUST display inspections for active shift, timestamp DESC
 * - QC-11: SHOULD pull-to-refresh offline resilient
 * - QC-12: SHALL empty state CTA when no inspections
 */
import { renderHook, act } from '@testing-library/react-native';
import { useQualityListOrchestration } from '../useQualityListOrchestration';

// ─── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock('../../graphql/nhostClient', () => ({
  nhost: { graphql: { request: jest.fn() } },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(), getItem: jest.fn(), removeItem: jest.fn(),
}));

// Mock the repository
const mockFindByShiftSession = jest.fn();

jest.mock('../../repositories/useQualityInspectionsRepository', () => ({
  useQualityInspectionsRepository: () => ({
    findByShiftSession: mockFindByShiftSession,
    inspections$: { subscribe: jest.fn() },
  }),
}));

// ─── Fixtures ───────────────────────────────────────────────────────────────────

const createMockDoc = (id: string, overrides: Record<string, any> = {}) => ({
  toJSON: () => ({
    id,
    updated_at: overrides.updated_at ?? 1000 + parseInt(id.replace('insp-', ''), 10),
    is_deleted: false,
    line_id: 'line-1',
    machine_id: 'machine-1',
    shift_session_id: 'shift-1',
    operator_id: 'op-1',
    product_id: 'prod-1',
    inspection_type: 'visual',
    value: 1,
    unit: 'units',
    passed: true,
    ...overrides,
  }),
});

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('useQualityListOrchestration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty list state initially', () => {
    const { result } = renderHook(() => useQualityListOrchestration());

    expect(result.current.state.inspections).toEqual([]);
    expect(result.current.state.isLoading).toBe(false);
    expect(result.current.state.isRefreshing).toBe(false);
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.lastUpdated).toBeNull();
  });

  it('loads inspections and updates state on success', async () => {
    const mockDocs = [
      createMockDoc('insp-1', { inspection_type: 'visual' }),
      createMockDoc('insp-2', { inspection_type: 'weight' }),
    ];
    mockFindByShiftSession.mockResolvedValue(mockDocs);

    const { result } = renderHook(() => useQualityListOrchestration());

    await act(async () => {
      await result.current.loadInspections('shift-1');
    });

    expect(result.current.state.inspections).toHaveLength(2);
    expect(result.current.state.isLoading).toBe(false);
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.lastUpdated).not.toBeNull();
  });

  it('sets error when loadInspections fails', async () => {
    mockFindByShiftSession.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useQualityListOrchestration());

    await act(async () => {
      await result.current.loadInspections('shift-1');
    });

    expect(result.current.state.inspections).toEqual([]);
    expect(result.current.state.isLoading).toBe(false);
    expect(result.current.state.error).toBe('Network error');
  });

  it('sets empty list when shiftSessionId is empty', async () => {
    const { result } = renderHook(() => useQualityListOrchestration());

    await act(async () => {
      await result.current.loadInspections('');
    });

    expect(result.current.state.inspections).toEqual([]);
    expect(result.current.state.error).toBe('No hay sesión de turno activa');
    expect(mockFindByShiftSession).not.toHaveBeenCalled();
  });

  it('supports pull-to-refresh via refreshInspections', async () => {
    const mockDocs = [createMockDoc('insp-1')];
    mockFindByShiftSession.mockResolvedValue(mockDocs);

    const { result } = renderHook(() => useQualityListOrchestration());

    await act(async () => {
      await result.current.refreshInspections('shift-1');
    });

    expect(result.current.state.inspections).toHaveLength(1);
    expect(result.current.state.isRefreshing).toBe(false);
    expect(result.current.state.error).toBeNull();
  });

  it('sets error on refresh failure', async () => {
    mockFindByShiftSession.mockRejectedValue(new Error('Refresh failed'));

    const { result } = renderHook(() => useQualityListOrchestration());

    await act(async () => {
      await result.current.refreshInspections('shift-1');
    });

    expect(result.current.state.isRefreshing).toBe(false);
    expect(result.current.state.error).toBe('Refresh failed');
  });

  it('calls repository.findByShiftSession with correct session ID', async () => {
    mockFindByShiftSession.mockResolvedValue([]);

    const { result } = renderHook(() => useQualityListOrchestration());

    await act(async () => {
      await result.current.loadInspections('shift-session-42');
    });

    expect(mockFindByShiftSession).toHaveBeenCalledWith('shift-session-42');
  });

  it('loads all inspections returned by repository', async () => {
    const mockDocs = [
      createMockDoc('insp-1', { inspection_type: 'visual', updated_at: 3000 }),
      createMockDoc('insp-2', { inspection_type: 'weight', updated_at: 1000 }),
    ];
    mockFindByShiftSession.mockResolvedValue(mockDocs);

    const { result } = renderHook(() => useQualityListOrchestration());

    await act(async () => {
      await result.current.loadInspections('shift-1');
    });

    // Sorting is delegated to the repository's findByShiftSession query
    // (sort: [{ updated_at: 'desc' }]), so we verify count and pass-through
    expect(result.current.state.inspections).toHaveLength(2);
    expect(result.current.state.inspections[0].id).toBe('insp-1');
    expect(result.current.state.inspections[1].id).toBe('insp-2');
  });
});
