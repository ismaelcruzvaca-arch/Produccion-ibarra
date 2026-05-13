import { useMemo } from 'react';
import type { IOeeEvent } from '../../core/types';
import { computeOee, type OeeMetrics } from '../../core/oeeCalculator';
import { DEFAULT_PPM, PRODUCTOS } from '../../config/catalogs';

export interface UseOeeCalculatorResult {
  metrics: OeeMetrics;
  isLoading: boolean;
  isUsingFallbackPpm: boolean; // CRITICAL: Wave 3 reads this for ⚠️ warning
}

export function useOeeCalculator(
  events: IOeeEvent[],
  productoId?: string
): UseOeeCalculatorResult {
  const metrics = useMemo(() => {
    // Detect product from shift_start event or use provided productoId
    const producto = productoId
      ? PRODUCTOS.find(p => p.id === productoId)
      : undefined;

    const ppm = producto?.theoreticalPpm ?? DEFAULT_PPM;

    return computeOee(events, ppm);
  }, [events, productoId]);

  return {
    metrics,
    isLoading: events.length === 0,
    isUsingFallbackPpm: metrics.usandoFallbackPpm,
  };
}
