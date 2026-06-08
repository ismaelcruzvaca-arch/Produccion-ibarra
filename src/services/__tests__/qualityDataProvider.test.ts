/**
 * QualityDataProvider Unit Tests
 *
 * Tests for the quality data adapter that reads rejected quantity
 * from quality inspections and defect logs by shift session ID.
 *
 * Scenarios:
 * - Mixed dispositions: only rechazado + reproceso are counted
 * - Empty session: returns 0
 * - Only liberado inspections: returns 0
 * - RxDB query error: rejects with descriptive error
 */

import { QualityDataProvider } from '../qualityDataProvider';
import type { RxDocument } from 'rxdb';
import type { IQualityInspection, IDefectLog } from '../../core/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function mockRxDoc<T>(data: T): RxDocument<T> {
  return {
    get: (field: keyof T) => data[field],
  } as unknown as RxDocument<T>;
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('QualityDataProvider', () => {
  let mockInspectionsRepo: { findByShiftSession: jest.Mock };
  let mockDefectLogsRepo: { findByInspection: jest.Mock };
  let provider: QualityDataProvider;

  beforeEach(() => {
    mockInspectionsRepo = {
      findByShiftSession: jest.fn(),
    };
    mockDefectLogsRepo = {
      findByInspection: jest.fn(),
    };
    provider = new QualityDataProvider(
      mockInspectionsRepo as any,
      mockDefectLogsRepo as any,
    );
  });

  // ─── Mixed dispositions ──────────────────────────────────────────────────
  it('sums defect_count for rechazado and reproceso dispositions only', async () => {
    const inspections = [
      { id: 'i-1', disposition: 'rechazado' },
      { id: 'i-2', disposition: 'reproceso' },
      { id: 'i-3', disposition: 'liberado' },
    ].map(mockRxDoc<IQualityInspection>);

    mockInspectionsRepo.findByShiftSession.mockResolvedValueOnce(inspections);

    mockDefectLogsRepo.findByInspection
      .mockResolvedValueOnce(
        [{ id: 'd-1', defect_count: 3 }].map(mockRxDoc<IDefectLog>),
      )
      .mockResolvedValueOnce(
        [{ id: 'd-2', defect_count: 2 }].map(mockRxDoc<IDefectLog>),
      );

    const result = await provider.getRejectedQuantity('S-001');

    expect(result).toBe(5); // 3 + 2 = 5 (liberado excluded)
    expect(mockInspectionsRepo.findByShiftSession).toHaveBeenCalledWith('S-001');
    expect(mockDefectLogsRepo.findByInspection).toHaveBeenCalledTimes(2);
  });

  // ─── Empty session ID ────────────────────────────────────────────────────
  it('returns 0 for empty session ID without querying RxDB', async () => {
    const result = await provider.getRejectedQuantity('');

    expect(result).toBe(0);
    expect(mockInspectionsRepo.findByShiftSession).not.toHaveBeenCalled();
    expect(mockDefectLogsRepo.findByInspection).not.toHaveBeenCalled();
  });

  // ─── No inspections for session ──────────────────────────────────────────
  it('returns 0 when no inspections exist for the session', async () => {
    mockInspectionsRepo.findByShiftSession.mockResolvedValueOnce([]);

    const result = await provider.getRejectedQuantity('S-002');

    expect(result).toBe(0);
    expect(mockInspectionsRepo.findByShiftSession).toHaveBeenCalledWith('S-002');
    expect(mockDefectLogsRepo.findByInspection).not.toHaveBeenCalled();
  });

  // ─── Only liberado ───────────────────────────────────────────────────────
  it('returns 0 when all inspections are liberado', async () => {
    const inspections = [
      { id: 'i-1', disposition: 'liberado' },
      { id: 'i-2', disposition: 'liberado' },
    ].map(mockRxDoc<IQualityInspection>);

    mockInspectionsRepo.findByShiftSession.mockResolvedValueOnce(inspections);

    const result = await provider.getRejectedQuantity('S-003');

    expect(result).toBe(0);
    // No defect logs should be queried since there are no rejected inspections
    expect(mockDefectLogsRepo.findByInspection).not.toHaveBeenCalled();
  });

  // ─── RxDB error ──────────────────────────────────────────────────────────
  it('rejects with descriptive error when inspections query fails', async () => {
    mockInspectionsRepo.findByShiftSession.mockRejectedValueOnce(
      new Error('RxDB query failed: collection quality_inspections not found'),
    );

    await expect(provider.getRejectedQuantity('S-004')).rejects.toThrow(
      'RxDB query failed',
    );
  });

  it('rejects with descriptive error when defect logs query fails', async () => {
    const inspections = [
      { id: 'i-1', disposition: 'rechazado' },
    ].map(mockRxDoc<IQualityInspection>);

    mockInspectionsRepo.findByShiftSession.mockResolvedValueOnce(inspections);
    mockDefectLogsRepo.findByInspection.mockRejectedValueOnce(
      new Error('RxDB query failed: collection defect_logs not found'),
    );

    await expect(provider.getRejectedQuantity('S-005')).rejects.toThrow(
      'RxDB query failed',
    );
  });

  // ─── Multiple defect logs per inspection ─────────────────────────────────
  it('sums multiple defect logs across multiple rejected inspections', async () => {
    const inspections = [
      { id: 'i-1', disposition: 'rechazado' },
      { id: 'i-2', disposition: 'rechazado' },
    ].map(mockRxDoc<IQualityInspection>);

    mockInspectionsRepo.findByShiftSession.mockResolvedValueOnce(inspections);

    mockDefectLogsRepo.findByInspection
      .mockResolvedValueOnce(
        [
          { id: 'd-1', defect_count: 1 },
          { id: 'd-2', defect_count: 4 },
        ].map(mockRxDoc<IDefectLog>),
      )
      .mockResolvedValueOnce(
        [{ id: 'd-3', defect_count: 7 }].map(mockRxDoc<IDefectLog>),
      );

    const result = await provider.getRejectedQuantity('S-006');

    expect(result).toBe(12); // (1+4) + 7 = 12
    expect(mockDefectLogsRepo.findByInspection).toHaveBeenCalledTimes(2);
  });
});
