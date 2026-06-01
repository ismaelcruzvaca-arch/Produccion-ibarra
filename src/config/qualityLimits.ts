/**
 * Quality Limits — configuration constants for quality trend visualizations.
 *
 * Pattern: Config Object (same shape as OEE_LIMITS in src/config/oeeLimits.ts)
 * Why: Centralized constants so chart logic, hooks, and tests reference the same values.
 */

export const TREND_SAMPLE_COUNT = 20;
export const QUALITY_EMPTY_INDICATOR = '—';

export const QUALITY_LIMITS = {
  TREND_SAMPLE_COUNT,
  QUALITY_EMPTY_INDICATOR,
} as const;
