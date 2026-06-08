/**
 * QualityDataProvider — Adapter between the Quality module and the OEE calculator.
 *
 * Pattern: Service / Adapter (Dependency Inversion)
 * Why:
 * - Implements IQualityDataProvider interface defined in core/types.ts.
 * - Reads quality_inspections by shift_session_id from RxDB via repositories.
 * - Sums defect_count from defect_logs where inspection disposition is
 *   'rechazado' or 'reproceso'.
 * - Returns 0 for empty session IDs (no RxDB query needed).
 * - Constructor injection for repositories (no RxDB dependency in core).
 *
 * @see IQualityDataProvider
 */

import type { IQualityDataProvider } from '../core/types';
import type { QualityInspectionsRepository } from '../repositories/useQualityInspectionsRepository';
import type { DefectLogsRepository } from '../repositories/useDefectLogsRepository';

export class QualityDataProvider implements IQualityDataProvider {
  constructor(
    private inspectionsRepo: QualityInspectionsRepository,
    private defectLogsRepo: DefectLogsRepository,
  ) {}

  async getRejectedQuantity(shiftSessionId: string): Promise<number> {
    // Early return for empty session ID — no RxDB query
    if (!shiftSessionId) return 0;

    const inspections = await this.inspectionsRepo.findByShiftSession(shiftSessionId);

    // Filter inspections with rejected or rework disposition
    const rejected = inspections.filter(
      (i) => i.get('disposition') === 'rechazado' || i.get('disposition') === 'reproceso',
    );

    if (rejected.length === 0) return 0;

    let total = 0;
    for (const inspection of rejected) {
      const defects = await this.defectLogsRepo.findByInspection(inspection.get('id'));
      total += defects.reduce((sum, d) => sum + d.get('defect_count'), 0);
    }
    return total;
  }
}
