/**
 * RxDB database initialization and singleton management.
 *
 * Pattern: Singleton + Factory
 * Why:
 * - The database is created once and shared across the entire app via React Context.
 * - Lazy initialization defers the async open until first access (avoids blocking the UI).
 * - Dexie.js is used as the storage engine on all platforms (PWA strategy).
 *
 * Storage: Dexie.js (IndexedDB wrapper) — works in all browser environments
 * (mobile PWA, desktop PWA, web). Avoids RxDB Premium license entirely.
 *
 * Dev mode: In development (__DEV__), RxDBDevModePlugin is added to catch schema
 * violations early. This must be stripped in production to avoid runtime overhead.
 */

import { createRxDatabase, addRxPlugin, type RxDatabase, type RxCollection } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';

import {
  assetSchema, assetTypeSchema, workOrderSchema, workOrderSchemaMigrationStrategy,
  reportSchema, oeeEventSchema, syncErrorSchema,
  qualityInspectionSchema, defectLogSchema, weightLogSchema, shiftSessionSchema, operatorSchema, productWeightStandardSchema,
  downtimeConciliationSchema, plantConfigSchema, shiftSummarySchema,
} from './schemas';
import type { IAsset, IAssetType, IWorkOrder, IReport, IOeeEvent, ISyncError, IQualityInspection, IDefectLog, IWeightLog, IShiftSession, IOperator, IProductWeightStandard, IDowntimeConciliation, IPlantConfig, IShiftSummary } from '../core/types';

// ─── Database Collections Type ──────────────────────────────────────────────────

/** Typing for the database and its collections. */
export type ChocolateIbarraDatabase = RxDatabase<{
  assets: RxCollection<IAsset>;
  asset_types: RxCollection<IAssetType>;
  work_orders: RxCollection<IWorkOrder>;
  reports: RxCollection<IReport>;
  oee_events: RxCollection<IOeeEvent>;
  sync_errors: RxCollection<ISyncError>;
  quality_inspections: RxCollection<IQualityInspection>;
  defect_logs: RxCollection<IDefectLog>;
  weight_logs: RxCollection<IWeightLog>;
  shift_sessions: RxCollection<IShiftSession>;
  operators: RxCollection<IOperator>;
  product_weight_standards: RxCollection<IProductWeightStandard>;
  downtime_conciliation: RxCollection<IDowntimeConciliation>;
  plant_config: RxCollection<IPlantConfig>;
  shift_summary: RxCollection<IShiftSummary>;
}>;

// ─── Database Singleton ────────────────────────────────────────────────────────

let dbPromise: Promise<ChocolateIbarraDatabase> | null = null;

/**
 * Returns a singleton RxDB instance named 'chocolate_ibarra_db'.
 * Lazily initialized on first call — subsequent calls return the same promise.
 *
 * The database is created with:
 * - multiInstance: true — allows multiple app instances (e.g., main thread + workers)
 * - eventReduce: true — enables event-reduce optimization for observables
 *
 * After creation, collections are registered via addCollections().
 *
 * @returns Promise<ChocolateIbarraDatabase>
 */
export async function getDatabase(): Promise<ChocolateIbarraDatabase> {
  if (!dbPromise) {
    // Enable dev mode in development to catch schema violations early
    if (__DEV__) {
      addRxPlugin(RxDBDevModePlugin);
    }

    const storage = getRxStorageDexie();

    dbPromise = createRxDatabase<ChocolateIbarraDatabase>({
      name: 'chocolate_ibarra_db',
      storage,
      multiInstance: true, // allow multiple instances across web workers
      eventReduce: true, // event reduce for better performance
    }).then(async (db) => {
      // Register all collections with their schemas
      await db.addCollections({
        assets: { schema: assetSchema },
        asset_types: { schema: assetTypeSchema },
        work_orders: { schema: workOrderSchema, migrationStrategies: { 1: workOrderSchemaMigrationStrategy } },
        reports: { schema: reportSchema },
        oee_events: { schema: oeeEventSchema },
        sync_errors: { schema: syncErrorSchema },
        quality_inspections: { schema: qualityInspectionSchema },
        defect_logs: { schema: defectLogSchema },
        weight_logs: { schema: weightLogSchema },
        shift_sessions: { schema: shiftSessionSchema },
        operators: { schema: operatorSchema },
        product_weight_standards: { schema: productWeightStandardSchema },
        downtime_conciliation: { schema: downtimeConciliationSchema },
        plant_config: { schema: plantConfigSchema },
        shift_summary: { schema: shiftSummarySchema },
      });
      return db as ChocolateIbarraDatabase;
    });
  }
  return dbPromise;
}