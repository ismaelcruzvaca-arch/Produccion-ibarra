/**
 * Plant Config Repository Hook — read/write operations on the plant_config collection.
 *
 * Pattern: Repository + Hook (Anti-Corruption Layer)
 * Why:
 * - Centralizes access to plant_config key-value store.
 * - Provides typed getters/setters instead of raw RxDB queries.
 *
 * Uses `updated_at` (not `client_updated_at`) matching the newer data contract.
 */

import { useCallback, useMemo } from 'react';
import type { Observable } from 'rxjs';
import type { RxDocument } from 'rxdb';

import { nowMs } from '../utils/timestamp';
import type { IPlantConfig } from '../core/types';
import { useDatabase } from '../data/DatabaseContext';
import { getDeviceId } from '../sync/deviceId';

export interface PlantConfigRepository {
  /** Emits all non-deleted config entries on change */
  docs$: Observable<RxDocument<IPlantConfig>[]>;

  /** Get a config value by key, returns null if not found */
  get: (key: string) => Promise<string | null>;

  /** Set a config value — creates or updates the entry */
  set: (key: string, value: string, description?: string) => Promise<RxDocument<IPlantConfig>>;

  /**
   * Get the micro-stop threshold in minutes.
   * Returns the configured value or DEFAULT_THRESHOLD (5 minutes) if not set.
   */
  getMicroStopThreshold: () => Promise<number>;

  /**
   * Set the micro-stop threshold.
   * @param minutes - Integer value >= 1
   */
  setMicroStopThreshold: (minutes: number) => Promise<RxDocument<IPlantConfig>>;

  // ── Wave 5: Conciliation Config ──────────────────────────────────────────

  /** Get departments required for conciliation (comma-separated config, parsed to array) */
  getConciliationRequiredDepartments: () => Promise<string[]>;
  /** Set departments required for conciliation */
  setConciliationRequiredDepartments: (departments: string[]) => Promise<RxDocument<IPlantConfig>>;

  /** Get minimum duration (minutes) for a stop to require conciliation */
  getConciliationThresholdMin: () => Promise<number>;
  /** Set minimum duration for conciliation */
  setConciliationThresholdMin: (minutes: number) => Promise<RxDocument<IPlantConfig>>;

  /** Get minimum duration (minutes) for a stop to require RCA analysis */
  getRcaThresholdMin: () => Promise<number>;
  /** Set minimum duration for RCA */
  setRcaThresholdMin: (minutes: number) => Promise<RxDocument<IPlantConfig>>;

  /** Get escalation deadline in hours (from conciliation creation) */
  getEscalationHours: () => Promise<number>;
  /** Set escalation deadline in hours */
  setEscalationHours: (hours: number) => Promise<RxDocument<IPlantConfig>>;

  /** Get number of recurrences of same reason_code before auto-RCA trigger */
  getRcaRecurrenceCount: () => Promise<number>;
  /** Set RCA recurrence count threshold */
  setRcaRecurrenceCount: (count: number) => Promise<RxDocument<IPlantConfig>>;

  /** Get department → reason_codes mapping (parsed from JSON config) */
  getDepartmentReasonCodes: () => Promise<Record<string, string[]>>;
  /** Set department → reason_codes mapping */
  setDepartmentReasonCodes: (codes: Record<string, string[]>) => Promise<RxDocument<IPlantConfig>>;
}

export const DEFAULT_MICRO_STOP_THRESHOLD = 5;

// ── Wave 5: Conciliation Defaults ────────────────────────────────────────────

/** Default departments required for conciliation (comma-separated) */
export const DEFAULT_CONCILIATION_REQUIRED_DEPARTMENTS = 'MTTO,CALIDAD,LOGISTICA';
/** Default minimum duration in minutes for conciliation */
export const DEFAULT_CONCILIATION_THRESHOLD_MIN = '15';
/** Default minimum duration in minutes for RCA analysis */
export const DEFAULT_CONCILIATION_RCA_THRESHOLD_MIN = '30';
/** Default escalation deadline in hours */
export const DEFAULT_CONCILIATION_ESCALATION_HOURS = '24';
/** Default recurrence count for auto-RCA trigger */
export const DEFAULT_CONCILIATION_RCA_RECURRENCE_COUNT = '3';
/** Default department → reason_codes mapping (JSON) */
export const DEFAULT_CONCILIATION_DEPARTMENT_REASON_CODES = '{"MTTO":["FC","FS","FM","FT","MC","MP"],"CALIDAD":["RCC","AC","EMC"],"LOGISTICA":["FMP","FME"],"RH":["FP","FPRH"],"PRODUCCION":["CP","AO","AT","BV","LF","PAP","PAA","MD","LIM","REU","CAP"]}';

export function usePlantConfigRepository(): PlantConfigRepository {
  const db = useDatabase();

  const docs$: Observable<RxDocument<IPlantConfig>[]> = useMemo(
    () =>
      db.collections.plant_config
        .find({ selector: { is_deleted: { $eq: false } } })
        .$,
    [db],
  );

  const get = useCallback(
    async (key: string): Promise<string | null> => {
      const doc = await db.collections.plant_config.findOne(key).exec();
      if (!doc) return null;
      const value = doc.get('value') as string;
      return value;
    },
    [db],
  );

  const set = useCallback(
    async (key: string, value: string, description?: string) => {
      const deviceId = await getDeviceId();
      const existing = await db.collections.plant_config.findOne(key).exec();
      if (existing) {
        await existing.patch({ value, description: description ?? existing.get('description'), updated_at: nowMs() });
        return existing as RxDocument<IPlantConfig>;
      }
      const newDoc: IPlantConfig = {
        key,
        value,
        description,
        updated_at: nowMs(),
        device_id: deviceId,
        is_deleted: false,
      };
      const result = await db.collections.plant_config.insert(newDoc);
      return result as RxDocument<IPlantConfig>;
    },
    [db],
  );

  const getMicroStopThreshold = useCallback(async (): Promise<number> => {
    const val = await get('micro_stop_threshold_min');
    if (val === null) return DEFAULT_MICRO_STOP_THRESHOLD;
    const parsed = parseInt(val, 10);
    return Number.isNaN(parsed) || parsed < 1 ? DEFAULT_MICRO_STOP_THRESHOLD : parsed;
  }, [get]);

  const setMicroStopThreshold = useCallback(
    async (minutes: number) => {
      const value = String(Math.max(1, Math.round(minutes)));
      return set(
        'micro_stop_threshold_min',
        value,
        'Umbral de micro-paro en minutos — paros con duración menor se excluyen de conciliación',
      );
    },
    [set],
  );

  // ── Wave 5: Conciliation Config Getters/Setters ───────────────────────────

  const getConciliationRequiredDepartments = useCallback(async (): Promise<string[]> => {
    const val = await get('conciliation_required_departments');
    if (val === null) return DEFAULT_CONCILIATION_REQUIRED_DEPARTMENTS.split(',');
    return val.split(',').map((d) => d.trim()).filter(Boolean);
  }, [get]);

  const setConciliationRequiredDepartments = useCallback(
    async (departments: string[]) => {
      return set(
        'conciliation_required_departments',
        departments.join(','),
        'Departamentos requeridos para conciliación (separados por coma)',
      );
    },
    [set],
  );

  const getConciliationThresholdMin = useCallback(async (): Promise<number> => {
    const val = await get('conciliation_threshold_min');
    if (val === null) return parseInt(DEFAULT_CONCILIATION_THRESHOLD_MIN, 10);
    const parsed = parseInt(val, 10);
    return Number.isNaN(parsed) || parsed < 1 ? parseInt(DEFAULT_CONCILIATION_THRESHOLD_MIN, 10) : parsed;
  }, [get]);

  const setConciliationThresholdMin = useCallback(
    async (minutes: number) => {
      const value = String(Math.max(1, Math.round(minutes)));
      return set(
        'conciliation_threshold_min',
        value,
        'Duración mínima en minutos para que un paro requiera conciliación',
      );
    },
    [set],
  );

  const getRcaThresholdMin = useCallback(async (): Promise<number> => {
    const val = await get('rca_threshold_min');
    if (val === null) return parseInt(DEFAULT_CONCILIATION_RCA_THRESHOLD_MIN, 10);
    const parsed = parseInt(val, 10);
    return Number.isNaN(parsed) || parsed < 1 ? parseInt(DEFAULT_CONCILIATION_RCA_THRESHOLD_MIN, 10) : parsed;
  }, [get]);

  const setRcaThresholdMin = useCallback(
    async (minutes: number) => {
      const value = String(Math.max(1, Math.round(minutes)));
      return set(
        'rca_threshold_min',
        value,
        'Duración mínima en minutos para que un paro requiera análisis RCA',
      );
    },
    [set],
  );

  const getEscalationHours = useCallback(async (): Promise<number> => {
    const val = await get('conciliation_escalation_hours');
    if (val === null) return parseInt(DEFAULT_CONCILIATION_ESCALATION_HOURS, 10);
    const parsed = parseInt(val, 10);
    return Number.isNaN(parsed) || parsed < 1 ? parseInt(DEFAULT_CONCILIATION_ESCALATION_HOURS, 10) : parsed;
  }, [get]);

  const setEscalationHours = useCallback(
    async (hours: number) => {
      const value = String(Math.max(1, Math.round(hours)));
      return set(
        'conciliation_escalation_hours',
        value,
        'Plazo en horas para escalación de conciliación no resuelta',
      );
    },
    [set],
  );

  const getRcaRecurrenceCount = useCallback(async (): Promise<number> => {
    const val = await get('conciliation_rca_recurrence_count');
    if (val === null) return parseInt(DEFAULT_CONCILIATION_RCA_RECURRENCE_COUNT, 10);
    const parsed = parseInt(val, 10);
    return Number.isNaN(parsed) || parsed < 1 ? parseInt(DEFAULT_CONCILIATION_RCA_RECURRENCE_COUNT, 10) : parsed;
  }, [get]);

  const setRcaRecurrenceCount = useCallback(
    async (count: number) => {
      const value = String(Math.max(1, Math.round(count)));
      return set(
        'conciliation_rca_recurrence_count',
        value,
        'Número de recurrencias del mismo código de paro para activar RCA automático',
      );
    },
    [set],
  );

  const getDepartmentReasonCodes = useCallback(async (): Promise<Record<string, string[]>> => {
    const val = await get('conciliation_department_reason_codes');
    if (val === null) return JSON.parse(DEFAULT_CONCILIATION_DEPARTMENT_REASON_CODES) as Record<string, string[]>;
    try {
      return JSON.parse(val) as Record<string, string[]>;
    } catch {
      return JSON.parse(DEFAULT_CONCILIATION_DEPARTMENT_REASON_CODES) as Record<string, string[]>;
    }
  }, [get]);

  const setDepartmentReasonCodes = useCallback(
    async (codes: Record<string, string[]>) => {
      return set(
        'conciliation_department_reason_codes',
        JSON.stringify(codes),
        'Departamento y códigos de paro asociados para conciliación (JSON)',
      );
    },
    [set],
  );

  return useMemo(
    () => ({
      docs$, get, set,
      getMicroStopThreshold, setMicroStopThreshold,
      getConciliationRequiredDepartments, setConciliationRequiredDepartments,
      getConciliationThresholdMin, setConciliationThresholdMin,
      getRcaThresholdMin, setRcaThresholdMin,
      getEscalationHours, setEscalationHours,
      getRcaRecurrenceCount, setRcaRecurrenceCount,
      getDepartmentReasonCodes, setDepartmentReasonCodes,
    }),
    [
      docs$, get, set,
      getMicroStopThreshold, setMicroStopThreshold,
      getConciliationRequiredDepartments, setConciliationRequiredDepartments,
      getConciliationThresholdMin, setConciliationThresholdMin,
      getRcaThresholdMin, setRcaThresholdMin,
      getEscalationHours, setEscalationHours,
      getRcaRecurrenceCount, setRcaRecurrenceCount,
      getDepartmentReasonCodes, setDepartmentReasonCodes,
    ],
  );
}
