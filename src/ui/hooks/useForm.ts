/**
 * useForm — Generic validation hook with field-level errors.
 *
 * Pattern: Hook (Controller)
 * Why:
 * - Centralizes form validation logic for Quality, Shift, and production forms.
 * - Field-level errors, dirty/touched tracking, configurable validation rules.
 *
 * ValidationRules:
 * - required: field must be non-empty/non-null
 * - min: minimum number value
 * - max: maximum number value
 * - pattern: regex pattern for string fields
 * - custom: custom validation function
 *
 * Usage:
 *   const form = useForm({ name: '', age: 0 }, {
 *     name: { required: 'El nombre es obligatorio' },
 *     age: { required: true, min: { value: 18, message: 'Debe ser mayor de edad' } },
 *   });
 *
 *   form.setField('name', 'Juan');
 *   form.validate(); // returns boolean
 */

import { useState, useCallback, useRef } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

type ValidationRule<T> = {
  required?: boolean | string;
  min?: { value: number; message: string };
  max?: { value: number; message: string };
  pattern?: { value: RegExp; message: string };
  custom?: (value: T[keyof T], values: T) => string | null;
};

export type ValidationRules<T extends Record<string, any>> = {
  [K in keyof T]?: ValidationRule<T>;
};

export interface UseFormReturn<T extends Record<string, any>> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  dirty: boolean;
  isValid: boolean;
  setField: (field: keyof T, value: T[keyof T]) => void;
  setFieldTouched: (field: keyof T) => void;
  validate: () => boolean;
  validateField: (field: keyof T) => string | null;
  reset: (values?: T) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validateFieldValue<T extends Record<string, any>>(
  field: keyof T,
  value: T[keyof T],
  values: T,
  rules?: ValidationRule<T>,
): string | null {
  if (!rules) return null;

  // Required check
  if (rules.required) {
    const isEmpty = value === undefined || value === null || value === '';
    if (isEmpty) {
      return typeof rules.required === 'string' ? rules.required : 'Este campo es obligatorio';
    }
  }

  // Min check (numbers)
  if (rules.min !== undefined && typeof value === 'number') {
    if (value < rules.min.value) {
      return rules.min.message;
    }
  }

  // Max check (numbers)
  if (rules.max !== undefined && typeof value === 'number') {
    if (value > rules.max.value) {
      return rules.max.message;
    }
  }

  // Pattern check (strings)
  if (rules.pattern !== undefined && typeof value === 'string' && value !== '') {
    if (!rules.pattern.value.test(value)) {
      return rules.pattern.message;
    }
  }

  // Custom validation
  if (rules.custom) {
    return rules.custom(value, values);
  }

  return null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useForm<T extends Record<string, any>>(
  initialValues: T,
  validationRules?: ValidationRules<T>,
): UseFormReturn<T> {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const initialRef = useRef<T>(initialValues);

  const dirty = Object.keys(values).some(
    (key) => values[key as keyof T] !== initialRef.current[key as keyof T],
  );

  const isValid = Object.keys(errors).length === 0;

  const setField = useCallback(
    (field: keyof T, value: T[keyof T]) => {
      setValues((prev) => ({ ...prev, [field]: value }));

      // Validate on change if field was already touched
      if (touched[field]) {
        const rule = validationRules?.[field];
        const error = validateFieldValue(field, value, { ...values, [field]: value }, rule);
        setErrors((prev) => {
          const next = { ...prev };
          if (error) {
            next[field] = error;
          } else {
            delete next[field];
          }
          return next;
        });
      }
    },
    [touched, validationRules, values],
  );

  const setFieldTouched = useCallback(
    (field: keyof T) => {
      setTouched((prev) => ({ ...prev, [field]: true }));

      // Validate the field when it's touched
      const rule = validationRules?.[field];
      const error = validateFieldValue(field, values[field], values, rule);
      setErrors((prev) => {
        const next = { ...prev };
        if (error) {
          next[field] = error;
        } else {
          delete next[field];
        }
        return next;
      });
    },
    [validationRules, values],
  );

  const validateField = useCallback(
    (field: keyof T): string | null => {
      const rule = validationRules?.[field];
      const error = validateFieldValue(field, values[field], values, rule);
      setErrors((prev) => {
        const next = { ...prev };
        if (error) {
          next[field] = error;
        } else {
          delete next[field];
        }
        return next;
      });
      setTouched((prev) => ({ ...prev, [field]: true }));
      return error;
    },
    [validationRules, values],
  );

  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof T, string>> = {};
    const allTouched: Partial<Record<keyof T, boolean>> = {};

    for (const field of Object.keys(values) as Array<keyof T>) {
      const rule = validationRules?.[field];
      const error = validateFieldValue(field, values[field], values, rule);
      if (error) {
        newErrors[field] = error;
      }
      allTouched[field] = true;
    }

    setErrors(newErrors);
    setTouched(allTouched);
    return Object.keys(newErrors).length === 0;
  }, [validationRules, values]);

  const reset = useCallback(
    (newValues?: T) => {
      setValues(newValues ?? initialRef.current);
      setErrors({});
      setTouched({});
    },
    [],
  );

  return {
    values,
    errors,
    touched,
    dirty,
    isValid,
    setField,
    setFieldTouched,
    validate,
    validateField,
    reset,
  };
}
