/**
 * Pure OEE calculator.
 * Receives an array of IOeeEvent for a single shift/machine and returns OEE metrics.
 */

import type { IOeeEvent } from './types';
import { PARO_BY_CODE, type ParoMacro, DEFAULT_PPM } from '../config/catalogs';

export interface OeeMetrics {
  disponibilidad: number; // 0-100%
  rendimiento: number;    // 0-100%
  calidad: number;        // 0-100%
  oee: number;            // 0-100%

  // Detalle
  tiempoPlanificadoMin: number;
  tiempoParoProdMin: number;
  tiempoParoMttoMin: number;
  tiempoOperandoMin: number;
  totalCajas: number;
  totalRechazos: number;
  cajasBuenas: number;
  ppmUtilizado: number;
  usandoFallbackPpm: boolean;
}

export function computeOee(
  events: IOeeEvent[],
  productoPpm: number
): OeeMetrics {
  // 1. Sort events by timestamp ascending
  const sorted = [...events].filter(e => !e.deleted).sort((a, b) => a.timestamp - b.timestamp);

  // 2. Find shift boundaries
  const shiftStart = sorted.find(e => e.event_type === 'shift_start');
  const shiftEnd = sorted.find(e => e.event_type === 'shift_end');

  // 3. Calculate planned time
  let tiempoPlanificadoMin = 0;
  if (shiftStart && shiftEnd) {
    tiempoPlanificadoMin = (shiftEnd.timestamp - shiftStart.timestamp) / 60000;
  } else if (shiftStart) {
    // Ongoing shift — use current time
    tiempoPlanificadoMin = (Date.now() - shiftStart.timestamp) / 60000;
  }

  // 4. Calculate downtimes
  const downtimePairs: { start: IOeeEvent; end?: IOeeEvent }[] = [];
  const openDowntimes: IOeeEvent[] = [];

  for (const event of sorted) {
    if (event.event_type === 'downtime_start') {
      openDowntimes.push(event);
    } else if (event.event_type === 'downtime_end' && event.related_event_id) {
      const startIdx = openDowntimes.findIndex(d => d.id === event.related_event_id);
      if (startIdx !== -1) {
        const start = openDowntimes.splice(startIdx, 1)[0];
        downtimePairs.push({ start, end: event });
      }
    }
  }
  // Any remaining openDowntimes are unmatched (should be blocked by UI, but handle gracefully)
  for (const start of openDowntimes) {
    downtimePairs.push({ start });
  }

  let tiempoParoProdMin = 0;
  let tiempoParoMttoMin = 0;

  for (const pair of downtimePairs) {
    const durationMs = pair.end
      ? pair.end.timestamp - pair.start.timestamp
      : pair.start ? Date.now() - pair.start.timestamp : 0;
    const durationMin = durationMs / 60000;

    const reason = pair.start.reason_code ? PARO_BY_CODE[pair.start.reason_code] : undefined;
    const macro: ParoMacro | undefined = reason?.macro;

    if (macro === 'MTTO') {
      tiempoParoMttoMin += durationMin;
    } else {
      // PROD and unknown reasons count as production downtime
      tiempoParoProdMin += durationMin;
    }
  }

  const totalParoMin = tiempoParoProdMin + tiempoParoMttoMin;
  const tiempoOperandoMin = Math.max(0, tiempoPlanificadoMin - totalParoMin);

  // 5. Calculate boxes and rejects
  const totalCajas = sorted
    .filter(e => e.event_type === 'box_count')
    .reduce((sum, e) => sum + (e.quantity ?? 0), 0);

  const totalRechazos = sorted
    .filter(e => e.event_type === 'reject_count')
    .reduce((sum, e) => sum + (e.quantity ?? 0), 0);

  const cajasBuenas = Math.max(0, totalCajas - totalRechazos);

  // 6. Calculate metrics
  const disponibilidad = tiempoPlanificadoMin > 0
    ? (tiempoOperandoMin / tiempoPlanificadoMin) * 100
    : 0;

  const rendimiento = tiempoOperandoMin > 0 && productoPpm > 0
    ? ((totalCajas / tiempoOperandoMin) / productoPpm) * 100
    : 0;

  const calidad = totalCajas > 0
    ? (cajasBuenas / totalCajas) * 100
    : 0;

  const oee = (disponibilidad / 100) * (rendimiento / 100) * (calidad / 100) * 100;

  return {
    disponibilidad: Math.min(100, Math.max(0, disponibilidad)),
    rendimiento: Math.min(100, Math.max(0, rendimiento)),
    calidad: Math.min(100, Math.max(0, calidad)),
    oee: Math.min(100, Math.max(0, oee)),
    tiempoPlanificadoMin,
    tiempoParoProdMin,
    tiempoParoMttoMin,
    tiempoOperandoMin,
    totalCajas,
    totalRechazos,
    cajasBuenas,
    ppmUtilizado: productoPpm,
    usandoFallbackPpm: productoPpm === DEFAULT_PPM,
  };
}
