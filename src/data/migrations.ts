/**
 * RxDB migration strategies for all collections.
 *
 * Pattern: Each entry is a MigrationStrategies object keyed by the target version number.
 * The function receives the old document data and returns the new document shape.
 * When a schema version is bumped, a migration strategy MUST be added here
 * so RxDB can migrate existing IndexedDB documents to the new schema shape.
 *
 * See: https://rxdb.info/migration-schema.html
 *
 * Migrations by collection:
 * - assetSchema v0→v1: rename `deleted` → `is_deleted`
 * - assetSchema v1→v2: remove `client_updated_at`, add `created_at` + `updated_at`
 * - assetTypeSchema v0→v1: remove `client_updated_at`, add `created_at` + `updated_at`
 * - workOrderSchema v0→v1: remove `client_updated_at`, add `created_at` + `updated_at`
 * - reportSchema v0→v1: add `created_at`
 * - oeeEventSchema v0→v1: add `created_at`, make `device_id` optional
 * - syncErrorSchema v0→v1: add `created_at`, `updated_at`, `is_deleted`
 * - signatureSchema v0→v1: add `created_at`
 * - toasterLogSchema v0→v1: add `created_at`
 * - mixingBatchSchema v0→v1: add `created_at`
 * - extractorCheckSchema v0→v1: add `created_at`
 * - vitaminKitSchema v0→v1: add `created_at`
 * - qualityInspectionSchema v0→v1: add `created_at`
 * - defectLogSchema v0→v1: add `created_at`
 * - weightLogSchema v0→v1: add `created_at`
 */

import type { MigrationStrategies } from 'rxdb';

/**
 * Helper: returns the current epoch ms timestamp.
 * Used as default value for `created_at` and `updated_at` during migrations.
 */
function now(): number {
  return Date.now();
}

export const MIGRATIONS: Record<string, MigrationStrategies> = {
  // ── Asset Schema ──────────────────────────────────────────────────────────
  // v0→v1: rename `deleted` → `is_deleted` (PR1)
  // v1→v2: remove `client_updated_at`, add `created_at` + `updated_at`
  assetSchema: {
    1: (oldDoc: any) => {
      return {
        ...oldDoc,
        is_deleted: oldDoc.is_deleted ?? oldDoc.deleted ?? false,
        deleted: undefined,
        client_updated_at: oldDoc.client_updated_at ?? now(),
      };
    },
    2: (oldDoc: any) => {
      const ts = oldDoc.client_updated_at ?? now();
      return {
        ...oldDoc,
        client_updated_at: undefined,
        created_at: ts,
        updated_at: ts,
      };
    },
  },

  // ── Asset Type Schema v0→v1 ───────────────────────────────────────────────
  // Replace `client_updated_at` with `created_at` + `updated_at`
  assetTypeSchema: {
    1: (oldDoc: any) => {
      const ts = oldDoc.client_updated_at ?? now();
      return {
        ...oldDoc,
        client_updated_at: undefined,
        created_at: ts,
        updated_at: ts,
      };
    },
  },

  // ── Work Order Schema v0→v1 ───────────────────────────────────────────────
  // Replace `client_updated_at` with `created_at` + `updated_at`
  // v1→v2: Add lifecycle fields from wo-lifecycle-outbox
  workOrderSchema: {
    1: (oldDoc: any) => {
      const ts = oldDoc.client_updated_at ?? now();
      return {
        ...oldDoc,
        client_updated_at: undefined,
        created_at: ts,
        updated_at: ts,
      };
    },
    2: (oldDoc: any) => {
      return {
        ...oldDoc,
        lifecycle_phase: undefined,
        symptom_note: undefined,
        cause_note: undefined,
        action_note: undefined,
        actual_start_at: undefined,
        completed_at: undefined,
        cmms_wo_id: undefined,
      };
    },
  },

  // ── Report Schema v0→v1 ──────────────────────────────────────────────────
  // Add `created_at` (documents already had `updated_at`)
  reportSchema: {
    1: (oldDoc: any) => {
      return {
        ...oldDoc,
        created_at: oldDoc.created_at ?? oldDoc.updated_at ?? now(),
      };
    },
  },

  // ── OEE Event Schema v0→v1 ───────────────────────────────────────────────
  // Add `created_at`; `device_id` becomes optional (no data loss needed)
  oeeEventSchema: {
    1: (oldDoc: any) => {
      return {
        ...oldDoc,
        created_at: oldDoc.created_at ?? oldDoc.updated_at ?? now(),
        // device_id stays — it's just no longer required in schema
      };
    },
  },

  // ── Sync Error Schema v0→v1 ──────────────────────────────────────────────
  // Add `created_at`, `updated_at`, `is_deleted`
  syncErrorSchema: {
    1: (oldDoc: any) => {
      const now_ts = now();
      return {
        ...oldDoc,
        created_at: oldDoc.created_at ?? oldDoc.fecha ?? now_ts,
        updated_at: oldDoc.updated_at ?? oldDoc.fecha ?? now_ts,
        is_deleted: oldDoc.is_deleted ?? false,
      };
    },
  },

  // ── Signature Schema v0→v1 ───────────────────────────────────────────────
  // Add `created_at`
  signatureSchema: {
    1: (oldDoc: any) => {
      return {
        ...oldDoc,
        created_at: oldDoc.created_at ?? oldDoc.updated_at ?? now(),
      };
    },
  },

  // ── Toaster Log Schema v0→v1 ─────────────────────────────────────────────
  toasterLogSchema: {
    1: (oldDoc: any) => {
      return {
        ...oldDoc,
        created_at: oldDoc.created_at ?? oldDoc.updated_at ?? now(),
      };
    },
  },

  // ── Mixing Batch Schema v0→v1 ────────────────────────────────────────────
  mixingBatchSchema: {
    1: (oldDoc: any) => {
      return {
        ...oldDoc,
        created_at: oldDoc.created_at ?? oldDoc.updated_at ?? now(),
      };
    },
  },

  // ── Extractor Check Schema v0→v1 ─────────────────────────────────────────
  extractorCheckSchema: {
    1: (oldDoc: any) => {
      return {
        ...oldDoc,
        created_at: oldDoc.created_at ?? oldDoc.updated_at ?? now(),
      };
    },
  },

  // ── Vitamin Kit Schema v0→v1 ─────────────────────────────────────────────
  vitaminKitSchema: {
    1: (oldDoc: any) => {
      return {
        ...oldDoc,
        created_at: oldDoc.created_at ?? oldDoc.updated_at ?? now(),
      };
    },
  },

  // ── Quality Inspection Schema v0→v1 ──────────────────────────────────────
  qualityInspectionSchema: {
    1: (oldDoc: any) => {
      return {
        ...oldDoc,
        created_at: oldDoc.created_at ?? oldDoc.updated_at ?? now(),
      };
    },
  },

  // ── Defect Log Schema v0→v1 ──────────────────────────────────────────────
  defectLogSchema: {
    1: (oldDoc: any) => {
      return {
        ...oldDoc,
        created_at: oldDoc.created_at ?? oldDoc.updated_at ?? now(),
      };
    },
  },

  // ── Weight Log Schema v0→v1 ──────────────────────────────────────────────
  weightLogSchema: {
    1: (oldDoc: any) => {
      return {
        ...oldDoc,
        created_at: oldDoc.created_at ?? oldDoc.updated_at ?? now(),
      };
    },
  },

  // ── Shift Session Schema v0→v1 ──────────────────────────────────────────
  shiftSessionSchema: {
    1: (oldDoc: any) => {
      return {
        ...oldDoc,
        created_at: oldDoc.created_at ?? now(),
      };
    },
  },

  // ── Operator Schema v0→v1 ───────────────────────────────────────────────
  operatorSchema: {
    1: (oldDoc: any) => {
      return {
        ...oldDoc,
        created_at: oldDoc.created_at ?? now(),
      };
    },
  },

  // ── Product Weight Standard Schema v0→v1 ────────────────────────────────
  productWeightStandardSchema: {
    1: (oldDoc: any) => {
      return {
        ...oldDoc,
        created_at: oldDoc.created_at ?? now(),
      };
    },
  },

  // ── Downtime Conciliation Schema ─────────────────────────────────────────
  // v0→v1: add created_at
  // v1→v2: add RCA + multi-department verdict fields
  downtimeConciliationSchema: {
    1: (oldDoc: any) => {
      return {
        ...oldDoc,
        created_at: oldDoc.created_at ?? now(),
      };
    },
    2: (oldDoc: any) => {
      return {
        ...oldDoc,
        involved_departments: undefined,
        verdicts: undefined,
        analysis_method: undefined,
        why_1: undefined,
        why_2: undefined,
        why_3: undefined,
        why_4: undefined,
        why_5: undefined,
        root_cause: undefined,
        corrective_action: undefined,
        escalation_deadline: undefined,
        escalated_at: undefined,
        escalated_to: undefined,
      };
    },
  },

  // ── Plant Config Schema v0→v1 ───────────────────────────────────────────
  plantConfigSchema: {
    1: (oldDoc: any) => {
      return {
        ...oldDoc,
        created_at: oldDoc.created_at ?? now(),
      };
    },
  },

  // ── Shift Summary Schema ────────────────────────────────────────────────
  // v0→v1: add created_at
  // v1→v2: add classified_stops
  shiftSummarySchema: {
    1: (oldDoc: any) => {
      return {
        ...oldDoc,
        created_at: oldDoc.created_at ?? now(),
      };
    },
    2: (oldDoc: any) => {
      return {
        ...oldDoc,
        classified_stops: undefined,
      };
    },
  },
};
