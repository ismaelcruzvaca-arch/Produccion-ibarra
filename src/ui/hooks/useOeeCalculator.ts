import { useMemo } from 'react';
import type { IOeeEvent } from '../../core/types';
import { computeOee, type OeeMetrics } from '../../core/oeeCalculator';
import { DEFAULT_PPM } from '../../config/catalogs';

export interface UseOeeCalculatorResult {
  metrics: OeeMetrics;
  isLoading: boolean;
  isUsingFallbackPpm: boolean; // CRITICAL: Wave 3 reads this for ⚠️ warning
}

/**
 * Hook that computes OEE metrics from a list of events.
 *
 * @param events - OEE events for the current shift
 * @param ppm - Target PPM from the selected product (theoretical_ppm).
 *              If undefined, falls back to DEFAULT_PPM and flags usandoFallbackPpm.
 *              Wave 8: resolved in the UI layer (oee.tsx) from catalogStore.
 */
export function useOeeCalculator(
  events: IOeeEvent[],
  ppm?: number
): UseOeeCalculatorResult {
  const metrics = useMemo(() => {
    return computeOee(events, ppm ?? DEFAULT_PPM);
  }, [events, ppm]);

  return {
    metrics,
    isLoading: events.length === 0,
    isUsingFallbackPpm: metrics.usandoFallbackPpm,
  };
}
