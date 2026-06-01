/**
 * FormRouter — resolves a machine name to a FormType via substring matching.
 *
 * Pattern: Pure Function + Lookup Table
 * Why: Deterministic mapping from machine name to form type. No side effects.
 *
 * Spec:
 * - FR-1: SHALL resolve form from operator_profiles.line_id + machine_id
 * - FR-2: SHALL default to OEE when no station match
 * - S1: Tostador 01 → F-PD-16 (toaster)
 * - S2: Cavemil → F-PD-21 (oee)
 * - S3: No machine_id → OEE
 *
 * Machine name substring matching rules:
 * - "Tostador" → 'toaster'  (F-PD-16)
 * - "Mezcladora" or "Agitador" → 'mixing'  (F-PD-17)
 * - "Extractor" → 'extractor'  (F-PD-18)
 * - "Vitamin" or "Vitamina" → 'vitamin'  (F-PD-06)
 * - Everything else → 'oee'  (F-PD-21, default)
 */

/** Union of all supported form types. */
export type FormType = 'oee' | 'toaster' | 'mixing' | 'extractor' | 'vitamin';

/** Ordered lookup table: [substring, formType][]. First match wins. */
const FORM_MAPPINGS: Array<[string, FormType]> = [
  ['tostador', 'toaster'],
  ['mezcladora', 'mixing'],
  ['agitador', 'mixing'],
  ['extractor', 'extractor'],
  ['vitamin', 'vitamin'],
  ['vitamina', 'vitamin'],
];

/**
 * Resolves a machine name to a FormType using case-insensitive substring matching.
 *
 * @param machineName - The machine name from the catalog (e.g., "Tostador 01", "Cavemil-03")
 * @returns The resolved FormType, defaulting to 'oee' when no match is found.
 */
export function resolveFormType(machineName: string): FormType {
  const normalized = machineName.trim().toLowerCase();

  if (!normalized) {
    return 'oee';
  }

  for (const [substring, formType] of FORM_MAPPINGS) {
    if (normalized.includes(substring)) {
      return formType;
    }
  }

  return 'oee';
}
