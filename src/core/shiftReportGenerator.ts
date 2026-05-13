/**
 * Generates a production report (IReport) from OEE events at shift end.
 * Pure function — receives events, returns report data.
 */

import type { IOeeEvent, IReport, ReportData } from './types';
import { computeOee } from './oeeCalculator';
import { DEFAULT_PPM, PRODUCTOS } from '../config/catalogs';
import { generateUuid } from '../utils/uuid';
import { nowMs } from '../utils/timestamp';

export interface ShiftReportInput {
  events: IOeeEvent[];
  shiftId: string;
  lineId: string;
  productoId?: string;
}

export function generateShiftReport(input: ShiftReportInput): IReport {
  const producto = input.productoId
    ? PRODUCTOS.find(p => p.id === input.productoId)
    : undefined;
  const ppm = producto?.theoreticalPpm ?? DEFAULT_PPM;

  const metrics = computeOee(input.events, ppm);

  const reportData: ReportData = {
    line_id: input.lineId,
    total_pieces: metrics.totalCajas,
    rejected_pieces: metrics.totalRechazos,
    downtime_minutes: metrics.tiempoParoProdMin + metrics.tiempoParoMttoMin,
  };

  return {
    id: generateUuid(),
    updated_at: nowMs(),
    deleted: false,
    template_id: 'oee-shift-summary',
    data: reportData,
  };
}
