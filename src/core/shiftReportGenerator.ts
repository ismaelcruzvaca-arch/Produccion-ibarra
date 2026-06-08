/**
 * Generates a production report (IReport) from OEE events at shift end.
 * Pure function — receives events, returns report data.
 *
 * Wave 8: productoId replaced with ppm (numeric) to decouple core from
 * UI-layer catalogs. The caller (oee.tsx) resolves ppm from the catalogStore.
 */

import type { IOeeEvent, IReport, ReportData } from './types';
import { computeOee } from './oeeCalculator';
import { DEFAULT_PPM } from '../config/catalogs';
import { generateUuid } from '../utils/uuid';
import { nowMs } from '../utils/timestamp';

export interface ShiftReportInput {
  events: IOeeEvent[];
  shiftId: string;
  lineId: string;
  /** Target PPM from the selected product. Falls back to DEFAULT_PPM if undefined. */
  ppm?: number;
  /** Optional shift session ID for quality data lookup. */
  shiftSessionId?: string;
}

export async function generateShiftReport(input: ShiftReportInput): Promise<IReport> {
  const ppm = input.ppm ?? DEFAULT_PPM;
  const metrics = await computeOee(input.events, ppm, undefined, input.shiftSessionId);

  const reportData: ReportData = {
    line_id: input.lineId,
    total_pieces: metrics.totalCajas,
    rejected_pieces: metrics.totalRechazos,
    downtime_minutes: metrics.tiempoParoProdMin + metrics.tiempoParoMttoMin,
  };

  const now = nowMs();
  return {
    id: generateUuid(),
    created_at: now,
    updated_at: now,
    is_deleted: false,
    template_id: 'oee-shift-summary',
    data: reportData,
  };
}

