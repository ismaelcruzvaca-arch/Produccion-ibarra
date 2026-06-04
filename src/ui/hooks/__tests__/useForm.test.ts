import { renderHook, act } from '@testing-library/react-native';
import { useForm } from '../useForm';

describe('useForm', () => {
  // ─── Initialization ───────────────────────────────────────────────────

  it('initializes with values, clean errors, and not dirty', () => {
    const { result } = renderHook(() =>
      useForm({ name: 'Juan', age: 25 }),
    );

    expect(result.current.values).toEqual({ name: 'Juan', age: 25 });
    expect(result.current.errors).toEqual({});
    expect(result.current.touched).toEqual({});
    expect(result.current.dirty).toBe(false);
    expect(result.current.isValid).toBe(true);
  });

  // ─── Required validation ──────────────────────────────────────────────

  it('returns error for required field with empty value', () => {
    const { result } = renderHook(() =>
      useForm(
        { name: '' },
        { name: { required: 'El nombre es obligatorio' } },
      ),
    );

    act(() => {
      result.current.validate();
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors.name).toBe('El nombre es obligatorio');
  });

  it('passes required validation when field has value', () => {
    const { result } = renderHook(() =>
      useForm(
        { name: 'Juan' },
        { name: { required: 'El nombre es obligatorio' } },
      ),
    );

    act(() => {
      result.current.validate();
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors.name).toBeUndefined();
  });

  it('uses default message for required field with boolean true', () => {
    const { result } = renderHook(() =>
      useForm(
        { name: '' },
        { name: { required: true } },
      ),
    );

    act(() => {
      result.current.validate();
    });

    expect(result.current.errors.name).toBe('Este campo es obligatorio');
  });

  // ─── Field-level errors (setField, setFieldTouched) ───────────────────

  it('validates field on touch', () => {
    const { result } = renderHook(() =>
      useForm(
        { name: '' },
        { name: { required: 'El nombre es obligatorio' } },
      ),
    );

    act(() => {
      result.current.setFieldTouched('name');
    });

    expect(result.current.touched.name).toBe(true);
    expect(result.current.errors.name).toBe('El nombre es obligatorio');
  });

  it('validates on setField when field was already touched', () => {
    const { result } = renderHook(() =>
      useForm(
        { name: '' },
        { name: { required: 'El nombre es obligatorio' } },
      ),
    );

    // Touch the field first
    act(() => {
      result.current.setFieldTouched('name');
    });
    expect(result.current.errors.name).toBe('El nombre es obligatorio');

    // Fill the field — error should clear automatically
    act(() => {
      result.current.setField('name', 'Juan');
    });

    expect(result.current.errors.name).toBeUndefined();
  });

  it('clears only the touched field error on change, not others', () => {
    const { result } = renderHook(() =>
      useForm(
        { name: '', email: '' },
        {
          name: { required: 'El nombre es obligatorio' },
          email: { required: 'El email es obligatorio' },
        },
      ),
    );

    // Touch both
    act(() => {
      result.current.setFieldTouched('name');
      result.current.setFieldTouched('email');
    });

    expect(result.current.errors.name).toBeTruthy();
    expect(result.current.errors.email).toBeTruthy();

    // Fix name only
    act(() => {
      result.current.setField('name', 'Juan');
    });

    expect(result.current.errors.name).toBeUndefined();
    expect(result.current.errors.email).toBeTruthy();
  });

  // ─── Min/Max validation ───────────────────────────────────────────────

  it('validates min value for numbers', () => {
    const { result } = renderHook(() =>
      useForm(
        { age: 15 },
        { age: { min: { value: 18, message: 'Debe ser mayor de edad' } } },
      ),
    );

    act(() => {
      result.current.validate();
    });

    expect(result.current.errors.age).toBe('Debe ser mayor de edad');

    // Fix
    act(() => {
      result.current.setField('age', 20);
    });
    act(() => {
      result.current.validate();
    });

    expect(result.current.errors.age).toBeUndefined();
  });

  it('validates max value for numbers', () => {
    const { result } = renderHook(() =>
      useForm(
        { quantity: 150 },
        { quantity: { max: { value: 100, message: 'Excede el máximo' } } },
      ),
    );

    act(() => {
      result.current.validate();
    });

    expect(result.current.errors.quantity).toBe('Excede el máximo');
  });

  it('validates both min and max', () => {
    const { result } = renderHook(() =>
      useForm(
        { temperature: 5 },
        {
          temperature: {
            min: { value: 10, message: 'Muy baja' },
            max: { value: 40, message: 'Muy alta' },
          },
        },
      ),
    );

    act(() => {
      result.current.validateField('temperature');
    });

    expect(result.current.errors.temperature).toBe('Muy baja');
  });

  // ─── Pattern validation ───────────────────────────────────────────────

  it('validates pattern for string fields', () => {
    const { result } = renderHook(() =>
      useForm(
        { email: 'not-an-email' },
        {
          email: {
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: 'Email inválido',
            },
          },
        },
      ),
    );

    act(() => {
      result.current.validate();
    });

    expect(result.current.errors.email).toBe('Email inválido');
  });

  it('passes pattern validation with valid value', () => {
    const { result } = renderHook(() =>
      useForm(
        { email: 'test@example.com' },
        {
          email: {
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: 'Email inválido',
            },
          },
        },
      ),
    );

    act(() => {
      result.current.validate();
    });

    expect(result.current.errors.email).toBeUndefined();
  });

  it('ignores pattern check when string is empty (required handles it)', () => {
    const { result } = renderHook(() =>
      useForm(
        { email: '' },
        {
          email: {
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: 'Email inválido',
            },
          },
        },
      ),
    );

    act(() => {
      result.current.validate();
    });

    // Empty string should not fail pattern (only required catches it)
    expect(result.current.errors.email).toBeUndefined();
  });

  // ─── Custom validation ────────────────────────────────────────────────

  it('validates custom rule', () => {
    const { result } = renderHook(() =>
      useForm(
        { password: 'abc123', confirm: 'xyz789' },
        {
          confirm: {
            custom: (value, values) =>
              value !== values.password
                ? 'Las contraseñas no coinciden'
                : null,
          },
        },
      ),
    );

    act(() => {
      result.current.validate();
    });

    expect(result.current.errors.confirm).toBe('Las contraseñas no coinciden');
  });

  it('passes custom validation when rule returns null', () => {
    const { result } = renderHook(() =>
      useForm(
        { password: 'abc123', confirm: 'abc123' },
        {
          confirm: {
            custom: (value, values) =>
              value !== values.password
                ? 'Las contraseñas no coinciden'
                : null,
          },
        },
      ),
    );

    act(() => {
      result.current.validate();
    });

    expect(result.current.errors.confirm).toBeUndefined();
  });

  // ─── validateField (single field) ─────────────────────────────────────

  it('validates a single field with validateField', () => {
    const { result } = renderHook(() =>
      useForm(
        { name: '', email: '' },
        {
          name: { required: 'El nombre es obligatorio' },
          email: { required: 'El email es obligatorio' },
        },
      ),
    );

    let error: string | null = '';
    act(() => {
      error = result.current.validateField('name');
    });

    expect(error).toBe('El nombre es obligatorio');
    expect(result.current.errors.name).toBe('El nombre es obligatorio');
    // Email should not be validated
    expect(result.current.errors.email).toBeUndefined();
  });

  it('sets touched when validateField is called', () => {
    const { result } = renderHook(() =>
      useForm(
        { name: '' },
        { name: { required: 'El nombre es obligatorio' } },
      ),
    );

    act(() => {
      result.current.validateField('name');
    });

    expect(result.current.touched.name).toBe(true);
  });

  // ─── Reset ────────────────────────────────────────────────────────────

  it('resets to initial values', () => {
    const { result } = renderHook(() =>
      useForm({ name: '', age: 0 }),
    );

    act(() => {
      result.current.setField('name', 'Juan');
      result.current.setField('age', 30);
    });

    expect(result.current.values.name).toBe('Juan');
    expect(result.current.dirty).toBe(true);

    act(() => {
      result.current.reset();
    });

    expect(result.current.values).toEqual({ name: '', age: 0 });
    expect(result.current.errors).toEqual({});
    expect(result.current.touched).toEqual({});
    expect(result.current.dirty).toBe(false);
    expect(result.current.isValid).toBe(true);
  });

  it('resets to provided values', () => {
    const { result } = renderHook(() =>
      useForm({ name: '' }),
    );

    act(() => {
      result.current.reset({ name: 'Predetermined' });
    });

    expect(result.current.values.name).toBe('Predetermined');
  });

  it('clears validation errors on reset', () => {
    const { result } = renderHook(() =>
      useForm(
        { name: '' },
        { name: { required: 'El nombre es obligatorio' } },
      ),
    );

    act(() => {
      result.current.validate();
    });
    expect(result.current.isValid).toBe(false);

    act(() => {
      result.current.setField('name', 'Juan');
      result.current.reset();
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toEqual({});
  });

  // ─── Dirty tracking ──────────────────────────────────────────────────

  it('tracks dirty state correctly', () => {
    const { result } = renderHook(() =>
      useForm({ name: 'Juan', age: 25 }),
    );

    expect(result.current.dirty).toBe(false);

    act(() => {
      result.current.setField('name', 'Pedro');
    });

    expect(result.current.dirty).toBe(true);

    act(() => {
      result.current.setField('name', 'Juan');
    });

    // dirty checks if ANY field changed from initial, so after changing
    // name to Pedro then back to Juan, dirty should be false again
    expect(result.current.dirty).toBe(false);
  });

  // ─── isValid derived state ────────────────────────────────────────────

  it('isValid is false when there are errors', () => {
    const { result } = renderHook(() =>
      useForm(
        { name: '' },
        { name: { required: true } },
      ),
    );

    expect(result.current.isValid).toBe(true); // No errors yet

    act(() => {
      result.current.validate();
    });

    expect(result.current.isValid).toBe(false);
  });

  it('isValid is true when all errors are cleared', () => {
    const { result } = renderHook(() =>
      useForm(
        { name: '' },
        { name: { required: true } },
      ),
    );

    act(() => {
      result.current.validate();
    });
    expect(result.current.isValid).toBe(false);

    act(() => {
      result.current.setField('name', 'Juan');
    });
    // Validating after setting the field
    act(() => {
      result.current.validate();
    });

    expect(result.current.isValid).toBe(true);
  });
});
