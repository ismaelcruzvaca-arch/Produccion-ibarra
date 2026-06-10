import { useState, useEffect } from 'react';
import type { IOeeEvent, IQualityDataProvider } from '../../core/types';
import { computeOee, type OeeMetrics } from '../../core/oeeCalculator';
import { DEFAULT_PPM } from '../../config/catalogs';

export interface UseOeeCalculatorResult {
  metrics: OeeMetrics;
  isLoading: boolean;
  isUsingFallbackPpm: boolean; // CRITICAL: Wave 3 reads this for warning indicator
}

const INITIAL_OEE_METRICS: OeeMetrics = {
  disponibilidad: 0,
  rendimiento: 0,
  calidad: 0,
  oee: 0,
  tiempoPlanificadoMin: 0,
  tiempoParoProdMin: 0,
  tiempoParoMttoMin: 0,
  tiempoOperandoMin: 0,
  totalCajas: 0,
  totalRechazos: 0,
  cajasBuenas: 0,
  ppmUtilizado: 0,
  usandoFallbackPpm: false,
  hasAnomalies: false,
};

/**
 * Hook that computes OEE metrics from a list of events.
 *
 * @param events - OEE events for the current shift
 * @param ppm - Target PPM from the selected product (theoretical_ppm).
 *              If undefined, falls back to DEFAULT_PPM and flags usandoFallbackPpm.
 *              Wave 8: resolved in the UI layer (oee.tsx) from catalogStore.
 * @param qualityProvider - Optional quality data provider for reading rejected
 *                          quantity from quality inspections instead of OEE events.
 * @param shiftSessionId - Required when qualityProvider is provided; the active
 *                         shift session ID to query quality data against.
 */
export function useOeeCalculator(
  events: IOeeEvent[],
  ppm?: number,
  qualityProvider?: IQualityDataProvider,
  shiftSessionId?: string,
): UseOeeCalculatorResult {
  const [metrics, setMetrics] = useState<OeeMetrics>(INITIAL_OEE_METRICS);

  useEffect(() => {
    computeOee(events, ppm ?? DEFAULT_PPM, qualityProvider, shiftSessionId).then(setMetrics);
  }, [events, ppm, qualityProvider, shiftSessionId]);

  return {
    metrics,
    isLoading: events.length === 0,
    isUsingFallbackPpm: metrics.usandoFallbackPpm,
  };
}
