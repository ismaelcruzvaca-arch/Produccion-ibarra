/**
 * T1.3–T1.6 — Form-specific schema validation tests.
 *
 * Verifies the RxDB schemas for toaster_logs, mixing_batches, extractor_checks,
 * and vitamin_kits collections match their respective specs.
 */

import {
  toasterLogSchema,
  mixingBatchSchema,
  extractorCheckSchema,
  vitaminKitSchema,
} from '../schemas';

// ─── T1.3: toasterLogSchema ─────────────────────────────────────────────────────

describe('toasterLogSchema (F-PD-16)', () => {
  it('has version 0 and primaryKey id', () => {
    expect(toasterLogSchema.version).toBe(0);
    expect(toasterLogSchema.primaryKey).toBe('id');
  });

  it('requires base fields: id, updated_at, is_deleted', () => {
    const required = toasterLogSchema.required as string[];
    expect(required).toContain('id');
    expect(required).toContain('updated_at');
    expect(required).toContain('is_deleted');
  });

  it('uses updated_at NOT client_updated_at', () => {
    const props = toasterLogSchema.properties as Record<string, any>;
    expect(props.updated_at).toBeDefined();
    expect(props.client_updated_at).toBeUndefined();
  });

  it('has temperature fields (superior, media, inferior) per TF-1', () => {
    const props = toasterLogSchema.properties as Record<string, any>;
    expect(props.temp_superior.type).toBe('number');
    expect(props.temp_media.type).toBe('number');
    expect(props.temp_inferior.type).toBe('number');
  });

  it('has rpm and vapor_pressure fields per TF-1', () => {
    const props = toasterLogSchema.properties as Record<string, any>;
    expect(props.rpm.type).toBe('number');
    expect(props.vapor_pressure.type).toBe('number');
  });

  it('has humidity fields per TF-2', () => {
    const props = toasterLogSchema.properties as Record<string, any>;
    expect(props.cacao_crudo_humidity.type).toBe('number');
    expect(props.cacao_tostado_humidity.type).toBe('number');
  });

  it('has production tracking fields per TF-3', () => {
    const props = toasterLogSchema.properties as Record<string, any>;
    expect(props.pesadas.type).toBe('number');
    expect(props.silo.type).toBe('string');
    expect(props.lotes.type).toBe('string');
  });

  it('has tiempo_muerto fields per TF-4', () => {
    const props = toasterLogSchema.properties as Record<string, any>;
    expect(props.tiempo_muerto_min.type).toBe('number');
    expect(props.tiempo_muerto_cause.type).toBe('string');
  });

  it('has inventory fields per TF-5 (initial and final)', () => {
    const props = toasterLogSchema.properties as Record<string, any>;
    const invFields = ['cascarilla', 'polvillo', 'granilla', 'cacao_crudo', 'azucar'];
    invFields.forEach((field) => {
      expect(props[`inv_ini_${field}`].type).toBe('number');
      expect(props[`inv_fin_${field}`].type).toBe('number');
    });
  });
});

// ─── T1.4: mixingBatchSchema ────────────────────────────────────────────────────

describe('mixingBatchSchema (F-PD-17)', () => {
  it('has version 0 and primaryKey id', () => {
    expect(mixingBatchSchema.version).toBe(0);
    expect(mixingBatchSchema.primaryKey).toBe('id');
  });

  it('uses updated_at NOT client_updated_at', () => {
    const props = mixingBatchSchema.properties as Record<string, any>;
    expect(props.updated_at).toBeDefined();
    expect(props.client_updated_at).toBeUndefined();
  });

  it('has mezcladora, agitador, batch_sequence per MF-1', () => {
    const props = mixingBatchSchema.properties as Record<string, any>;
    expect(props.mezcladora.type).toBe('string');
    expect(props.agitador.type).toBe('string');
    expect(props.batch_sequence.type).toBe('number');
  });

  it('has ingredient fields per MF-2', () => {
    const props = mixingBatchSchema.properties as Record<string, any>;
    const ingredients = ['azucar_kg', 'licor_kg', 'cocoa_kg', 'grasa_vegetal_kg', 'lecitina_kg', 'reproceso_kg'];
    ingredients.forEach((field) => {
      expect(props[field].type).toBe('number');
    });
  });

  it('has viscosity and discharge_temp per MF-3', () => {
    const props = mixingBatchSchema.properties as Record<string, any>;
    expect(props.viscosity_cps.type).toBe('number');
    expect(props.discharge_temp.type).toBe('number');
  });

  it('has calculated totals per MF-5', () => {
    const props = mixingBatchSchema.properties as Record<string, any>;
    expect(props.mezcladas.type).toBe('number');
    expect(props.molidas.type).toBe('number');
    expect(props.reproceso_total.type).toBe('number');
    expect(props.desperdicio.type).toBe('number');
  });

  it('has inventory fields per MF-4 (initial, final, consumo)', () => {
    const props = mixingBatchSchema.properties as Record<string, any>;
    const components = ['azucar', 'licor', 'cocoa', 'grasa_vegetal', 'lecitina', 'reproceso'];
    components.forEach((comp) => {
      expect(props[`inv_ini_${comp}`].type).toBe('number');
      expect(props[`inv_fin_${comp}`].type).toBe('number');
      expect(props[`consumo_${comp}`].type).toBe('number');
    });
  });
});

// ─── T1.5: extractorCheckSchema ──────────────────────────────────────────────────

describe('extractorCheckSchema (F-PD-18)', () => {
  it('has version 0 and primaryKey id', () => {
    expect(extractorCheckSchema.version).toBe(0);
    expect(extractorCheckSchema.primaryKey).toBe('id');
  });

  it('uses updated_at NOT client_updated_at', () => {
    const props = extractorCheckSchema.properties as Record<string, any>;
    expect(props.updated_at).toBeDefined();
    expect(props.client_updated_at).toBeUndefined();
  });

  it('has 8 extractor toggles per EF-1', () => {
    const props = extractorCheckSchema.properties as Record<string, any>;
    for (let i = 1; i <= 8; i++) {
      expect(props[`extractor_${i}_on`].type).toBe('boolean');
    }
  });

  it('has cedazo_tt_last_cleaning per EF-2', () => {
    const props = extractorCheckSchema.properties as Record<string, any>;
    expect(props.cedazo_tt_last_cleaning.type).toBe('number');
  });
});

// ─── T1.6: vitaminKitSchema ──────────────────────────────────────────────────────

describe('vitaminKitSchema (F-PD-06)', () => {
  it('has version 0 and primaryKey id', () => {
    expect(vitaminKitSchema.version).toBe(0);
    expect(vitaminKitSchema.primaryKey).toBe('id');
  });

  it('uses updated_at NOT client_updated_at', () => {
    const props = vitaminKitSchema.properties as Record<string, any>;
    expect(props.updated_at).toBeDefined();
    expect(props.client_updated_at).toBeUndefined();
  });

  it('has orden, kit, semi_terminado per VF-2', () => {
    const props = vitaminKitSchema.properties as Record<string, any>;
    expect(props.orden.type).toBe('string');
    expect(props.kit.type).toBe('string');
    expect(props.semi_terminado.type).toBe('string');
  });

  it('has ingredients array per VF-2 (ingredients with lotes)', () => {
    const props = vitaminKitSchema.properties as Record<string, any>;
    expect(props.ingredients.type).toBe('array');
  });

  it('has verification booleans per VF-3', () => {
    const props = vitaminKitSchema.properties as Record<string, any>;
    expect(props.verif_produccion.type).toBe('boolean');
    expect(props.verif_calidad.type).toBe('boolean');
  });

  it('has weight fields per VF-4', () => {
    const props = vitaminKitSchema.properties as Record<string, any>;
    expect(props.peso_bascula_kg.type).toBe('number');
    expect(props.peso_fisico_kg.type).toBe('number');
  });
});
