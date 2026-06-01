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
}

export const DEFAULT_MICRO_STOP_THRESHOLD = 5;

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

  return useMemo(
    () => ({ docs$, get, set, getMicroStopThreshold, setMicroStopThreshold }),
    [docs$, get, set, getMicroStopThreshold, setMicroStopThreshold],
  );
}
