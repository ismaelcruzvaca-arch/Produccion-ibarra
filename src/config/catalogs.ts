/**
 * Downtime reason catalogs — F-PD-21 (Cavemil 02) compliant.
 *
 * Pattern: Static Catalog with DB-Ready Structure
 * Why:
 * - All data is type-safe and readonly for compile-time guarantees.
 * - The flat `PARO_REASONS` array is the single source of truth.
 * - Lookup maps (`PARO_BY_CODE`, `PARO_BY_MACRO`) are derived at load time.
 * - **Future migration**: Replace `PARO_REASONS` with a Nhost query; the
 *   `ParoReason` interface and lookup maps remain unchanged.
 */

export type ParoCategory = 'produccion' | 'mantenimiento' | 'calidad' | 'seguridad' | 'otros';
export type ParoMacro = 'PROD' | 'MTTO' | 'OTROS';

export interface ParoReason {
  code: string;
  label: string;
  category: ParoCategory;
  macro: ParoMacro;
  stopsLine: boolean;
}

/**
 * Master catalog of all downtime reasons per F-PD-21.
 * Organized by macro category for readability.
 *
 * TODO: Replace this static array with a Nhost/Hasura query in Phase 3.
 */
export const PARO_REASONS: readonly ParoReason[] = [
  // ── Producción (PROD) ──
  { code: 'FMP', label: 'Falta materia prima',          category: 'produccion', macro: 'PROD', stopsLine: true  },
  { code: 'AT',  label: 'Arranque de turno',            category: 'produccion', macro: 'PROD', stopsLine: false },
  { code: 'FME', label: 'Falta material empaque',       category: 'produccion', macro: 'PROD', stopsLine: true  },
  { code: 'AO',  label: 'Ajuste de operación',          category: 'produccion', macro: 'PROD', stopsLine: false },
  { code: 'CP',  label: 'Cambio de presentación',       category: 'produccion', macro: 'PROD', stopsLine: true  },
  { code: 'CN',  label: 'Cambio de nomenclatura',       category: 'produccion', macro: 'PROD', stopsLine: true  },
  { code: 'EQ',  label: 'Espera de químico',            category: 'produccion', macro: 'PROD', stopsLine: false },

  // ── Mantenimiento (MTTO) ──
  { code: 'FC',  label: 'Falla de Cavemil',             category: 'mantenimiento', macro: 'MTTO', stopsLine: true  },
  { code: 'FS',  label: 'Falla de Servicios',           category: 'mantenimiento', macro: 'MTTO', stopsLine: true  },
  { code: 'FM',  label: 'Falla de molino',              category: 'mantenimiento', macro: 'MTTO', stopsLine: true  },
  { code: 'FT',  label: 'Falla de tostador',            category: 'mantenimiento', macro: 'MTTO', stopsLine: true  },
  { code: 'MC',  label: 'Mantenimiento correctivo',     category: 'mantenimiento', macro: 'MTTO', stopsLine: true  },
  { code: 'MP',  label: 'Mantenimiento preventivo',     category: 'mantenimiento', macro: 'MTTO', stopsLine: true  },

  // ── Calidad (CAL) ──
  { code: 'RCC', label: 'Retrabajo por calidad',        category: 'calidad', macro: 'OTROS', stopsLine: true  },
  { code: 'AC',  label: 'Ajuste de calidad',            category: 'calidad', macro: 'OTROS', stopsLine: false },
  { code: 'EMC', label: 'Evaluación material cliente',  category: 'calidad', macro: 'OTROS', stopsLine: true  },

  // ── Seguridad (SEG) ──
  { code: 'IS',  label: 'Incidente de seguridad',       category: 'seguridad', macro: 'OTROS', stopsLine: true  },
  { code: 'EP',  label: 'Ejercicio de protección civil',category: 'seguridad', macro: 'OTROS', stopsLine: true  },

  // ── Otros / Administrativo (OTROS) ──
  { code: 'FPRH',label: 'Falta personal (RH)',          category: 'otros', macro: 'OTROS', stopsLine: true  },
  { code: 'DALM',label: 'Demora almacén',               category: 'otros', macro: 'OTROS', stopsLine: true  },
  { code: 'CAP', label: 'Capacitación',                 category: 'otros', macro: 'OTROS', stopsLine: true  },
  { code: 'LIM', label: 'Limpieza general',             category: 'otros', macro: 'OTROS', stopsLine: false },
  { code: 'REU', label: 'Reunión / Junta',              category: 'otros', macro: 'OTROS', stopsLine: true  },
] as const;

export const PARO_BY_CODE: Record<string, ParoReason> = Object.fromEntries(
  PARO_REASONS.map((r) => [r.code, r]),
);

export const PARO_BY_MACRO: Record<string, ParoReason[]> = PARO_REASONS.reduce(
  (acc, r) => {
    (acc[r.macro] ??= []).push(r);
    return acc;
  },
  {} as Record<string, ParoReason[]>,
);

export interface Turno {
  id: string;
  label: string;
  startHour: number;
  endHour: number;
}

export const TURNOS: readonly Turno[] = [
  { id: 'c7d7760b-d3f2-596a-b0ee-88e4f2ab8b34', label: 'Turno 1 (06-14)', startHour: 6,  endHour: 14 },
  { id: '17efa643-1ca5-585c-ab03-7ea8711efca0', label: 'Turno 2 (14-22)', startHour: 14, endHour: 22 },
  { id: '85c10e19-6f06-5866-a031-00515a69a8c0', label: 'Turno 3 (22-06)', startHour: 22, endHour: 6  },
] as const;

export function getCurrentTurno(): Turno {
  const now = new Date();
  const hour = now.getHours();
  for (const turno of TURNOS) {
    if (turno.startHour < turno.endHour) {
      if (hour >= turno.startHour && hour < turno.endHour) return turno;
    } else {
      // Turno cruza medianoche (ej. 22-6)
      if (hour >= turno.startHour || hour < turno.endHour) return turno;
    }
  }
  return TURNOS[0];
}

export interface Producto {
  id: string;
  code: string;
  name: string;
  theoreticalPpm: number;
}

export const PRODUCTOS: readonly Producto[] = [
  { id: '9f5558cc-06fa-5aa5-aa03-9d74e7121526', code: 'CHOC-500', name: 'Chocolate 500g', theoreticalPpm: 2.5 },
  { id: '887476c0-218b-5131-bf2a-63dd7cdf3861', code: 'CHOC-250', name: 'Chocolate 250g', theoreticalPpm: 3.0 },
] as const;

export const DEFAULT_PPM = 1.0;
