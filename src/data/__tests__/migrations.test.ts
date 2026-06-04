/**
 * Migration Strategy Tests — validates all RxDB migration functions.
 *
 * Pattern: pure function tests, plain data, no mocks.
 * Freezes Date.now for deterministic assertions.
 *
 * Tests all migration strategies from src/data/migrations.ts:
 * - assetSchema v0→v1, v1→v2
 * - workOrderSchema v1→v2
 * - downtimeConciliationSchema v1→v2
 * - shiftSummarySchema v1→v2
 * - All v0→v1 strategies that add created_at
 * - Edge cases: empty oldDoc, explicit `deleted: false`, frozen now() consistency
 */

import type { MigrationStrategies } from 'rxdb';
import { MIGRATIONS } from '../migrations';

const FROZEN_NOW = 1700000000000;

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
// ASSET SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

describe('assetSchema migrations', () => {
  describe('v0→v1 (deleted → is_deleted)', () => {
    const migrate = MIGRATIONS.assetSchema[1];

    it('renames deleted: true → is_deleted: true', () => {
      const oldDoc = { id: 'a1', name: 'Asset 1', deleted: true };
      const result = migrate(oldDoc);

      expect(result.is_deleted).toBe(true);
      expect(result.deleted).toBeUndefined();
      expect(result.name).toBe('Asset 1');
    });

    it('renames deleted: false → is_deleted: false', () => {
      const oldDoc = { id: 'a1', deleted: false };
      const result = migrate(oldDoc);

      expect(result.is_deleted).toBe(false);
      expect(result.deleted).toBeUndefined();
    });

    it('handles doc without deleted field → is_deleted defaults to false', () => {
      const oldDoc = { id: 'a1' };
      const result = migrate(oldDoc);

      expect(result.is_deleted).toBe(false);
    });

    it('prefers is_deleted when both deleted and is_deleted exist', () => {
      const oldDoc = { id: 'a1', deleted: true, is_deleted: false };
      const result = migrate(oldDoc);

      expect(result.is_deleted).toBe(false); // is_deleted wins over deleted
    });

    it('falls back to client_updated_at or now()', () => {
      const result = migrate({ id: 'a1', deleted: false });

      expect(result.client_updated_at).toBe(FROZEN_NOW);
    });

    it('preserves existing client_updated_at when present', () => {
      const oldDoc = { id: 'a1', deleted: false, client_updated_at: 12345 };
      const result = migrate(oldDoc);

      expect(result.client_updated_at).toBe(12345);
    });
  });

  describe('v1→v2 (client_updated_at → created_at + updated_at)', () => {
    const migrate = MIGRATIONS.assetSchema[2];

    it('creates created_at and updated_at from client_updated_at', () => {
      const oldDoc = { id: 'a1', name: 'Asset 1', is_deleted: false, client_updated_at: 12345 };
      const result = migrate(oldDoc);

      expect(result.created_at).toBe(12345);
      expect(result.updated_at).toBe(12345);
      expect(result.client_updated_at).toBeUndefined();
      expect(result.name).toBe('Asset 1');
    });

    it('falls back to now() when client_updated_at is missing', () => {
      const oldDoc = { id: 'a1', is_deleted: false };
      const result = migrate(oldDoc);

      expect(result.created_at).toBe(FROZEN_NOW);
      expect(result.updated_at).toBe(FROZEN_NOW);
    });

    it('uses client_updated_at when it is 0 (0 is a valid epoch ms)', () => {
      const oldDoc = { id: 'a1', client_updated_at: 0 };
      const result = migrate(oldDoc);

      // 0 is NOT null/undefined, so ?? operator keeps it
      expect(result.created_at).toBe(0);
      expect(result.updated_at).toBe(0);
    });

    it('preserves all other fields', () => {
      const oldDoc = { id: 'a1', name: 'Asset 1', type_id: 'T1', status: 'active', client_updated_at: 12345 };
      const result = migrate(oldDoc);

      expect(result.id).toBe('a1');
      expect(result.name).toBe('Asset 1');
      expect(result.type_id).toBe('T1');
      expect(result.status).toBe('active');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ASSET TYPE SCHEMA v0→v1
// ═══════════════════════════════════════════════════════════════════════════════

describe('assetTypeSchema v0→v1', () => {
  const migrate = MIGRATIONS.assetTypeSchema[1];

  it('creates created_at + updated_at from client_updated_at', () => {
    const oldDoc = { id: 'at1', code: 'HVAC', client_updated_at: 12345 };
    const result = migrate(oldDoc);

    expect(result.created_at).toBe(12345);
    expect(result.updated_at).toBe(12345);
    expect(result.client_updated_at).toBeUndefined();
  });

  it('falls back to now()', () => {
    const result = migrate({ id: 'at1', code: 'ELEC' });

    expect(result.created_at).toBe(FROZEN_NOW);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// WORK ORDER SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

describe('workOrderSchema v1→v2 (lifecycle fields)', () => {
  const migrate = MIGRATIONS.workOrderSchema[2];

  it('adds all 7 lifecycle fields as undefined', () => {
    const oldDoc = { id: 'wo1', equipment_id: 'MC-001', description: 'Repair' };
    const result = migrate(oldDoc);

    expect(result.lifecycle_phase).toBeUndefined();
    expect(result.symptom_note).toBeUndefined();
    expect(result.cause_note).toBeUndefined();
    expect(result.action_note).toBeUndefined();
    expect(result.actual_start_at).toBeUndefined();
    expect(result.completed_at).toBeUndefined();
    expect(result.cmms_wo_id).toBeUndefined();
    expect(result.equipment_id).toBe('MC-001');
  });

  it('preserves existing fields', () => {
    const oldDoc = { id: 'wo1', equipment_id: 'MC-001', description: 'Repair', status: 'pending' };
    const result = migrate(oldDoc);

    expect(result.id).toBe('wo1');
    expect(result.equipment_id).toBe('MC-001');
    expect(result.description).toBe('Repair');
    expect(result.status).toBe('pending');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DOWNTIME CONCILIATION SCHEMA v1→v2 (RCA + multi-department verdicts)
// ═══════════════════════════════════════════════════════════════════════════════

describe('downtimeConciliationSchema v1→v2', () => {
  const migrate = MIGRATIONS.downtimeConciliationSchema[2];

  it('adds all RCA/verdict/CA fields as undefined', () => {
    const oldDoc = { id: 'dc1', oee_event_id: 'oee1', reason_code: 'FC' };
    const result = migrate(oldDoc);

    expect(result.involved_departments).toBeUndefined();
    expect(result.verdicts).toBeUndefined();
    expect(result.analysis_method).toBeUndefined();
    expect(result.why_1).toBeUndefined();
    expect(result.why_2).toBeUndefined();
    expect(result.why_3).toBeUndefined();
    expect(result.why_4).toBeUndefined();
    expect(result.why_5).toBeUndefined();
    expect(result.root_cause).toBeUndefined();
    expect(result.corrective_action).toBeUndefined();
    expect(result.escalation_deadline).toBeUndefined();
    expect(result.escalated_at).toBeUndefined();
    expect(result.escalated_to).toBeUndefined();
  });

  it('preserves existing fields', () => {
    const oldDoc = { id: 'dc1', oee_event_id: 'oee1', reason_code: 'FC', duration_min: 15, status: 'pending' };
    const result = migrate(oldDoc);

    expect(result.id).toBe('dc1');
    expect(result.oee_event_id).toBe('oee1');
    expect(result.reason_code).toBe('FC');
    expect(result.duration_min).toBe(15);
    expect(result.status).toBe('pending');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SHIFT SUMMARY SCHEMA v1→v2 (classified_stops)
// ═══════════════════════════════════════════════════════════════════════════════

describe('shiftSummarySchema v1→v2', () => {
  const migrate = MIGRATIONS.shiftSummarySchema[2];

  it('adds classified_stops as undefined', () => {
    const oldDoc = { id: 'ss1', shift_session_id: 'shift1', total_boxes: 500 };
    const result = migrate(oldDoc);

    expect(result.classified_stops).toBeUndefined();
    expect(result.id).toBe('ss1');
    expect(result.total_boxes).toBe(500);
  });

  it('preserves all existing fields', () => {
    const oldDoc = {
      id: 'ss1',
      shift_session_id: 'shift1',
      total_planned_min: 480,
      total_downtime_min: 45,
      total_boxes: 500,
      has_pending_conciliation: true,
    };
    const result = migrate(oldDoc);

    expect(result.total_planned_min).toBe(480);
    expect(result.total_downtime_min).toBe(45);
    expect(result.has_pending_conciliation).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// v0→v1 strategies — created_at from updated_at fallback
// ═══════════════════════════════════════════════════════════════════════════════

describe('v0→v1 created_at from updated_at fallback', () => {
  const schemasWithUpdatedAt = [
    ['reportSchema', MIGRATIONS.reportSchema[1]],
    ['oeeEventSchema', MIGRATIONS.oeeEventSchema[1]],
    ['signatureSchema', MIGRATIONS.signatureSchema[1]],
    ['toasterLogSchema', MIGRATIONS.toasterLogSchema[1]],
    ['mixingBatchSchema', MIGRATIONS.mixingBatchSchema[1]],
    ['extractorCheckSchema', MIGRATIONS.extractorCheckSchema[1]],
    ['vitaminKitSchema', MIGRATIONS.vitaminKitSchema[1]],
    ['qualityInspectionSchema', MIGRATIONS.qualityInspectionSchema[1]],
    ['defectLogSchema', MIGRATIONS.defectLogSchema[1]],
    ['weightLogSchema', MIGRATIONS.weightLogSchema[1]],
  ] as const;

  it.each(schemasWithUpdatedAt)(
    '%s v0→v1: uses updated_at when available',
    (_name, migrate) => {
      const oldDoc = { id: 'doc1', updated_at: 12345 };
      const result = migrate(oldDoc);

      expect(result.created_at).toBe(12345);
    },
  );

  it.each(schemasWithUpdatedAt)(
    '%s v0→v1: falls back to now() when no updated_at',
    (_name, migrate) => {
      const oldDoc = { id: 'doc1' };
      const result = migrate(oldDoc);

      expect(result.created_at).toBe(FROZEN_NOW);
    },
  );

  it.each(schemasWithUpdatedAt)(
    '%s v0→v1: prefers existing created_at over fallback',
    (_name, migrate) => {
      const oldDoc = { id: 'doc1', created_at: 99999, updated_at: 12345 };
      const result = migrate(oldDoc);

      expect(result.created_at).toBe(99999); // existing created_at is preserved
    },
  );

  it.each(schemasWithUpdatedAt)(
    '%s v0→v1: preserves all other fields',
    (_name, migrate) => {
      const oldDoc = { id: 'doc1', name: 'Test', value: 42, updated_at: 12345 };
      const result = migrate(oldDoc);

      expect(result.id).toBe('doc1');
      expect(result.name).toBe('Test');
      expect(result.value).toBe(42);
    },
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// v0→v1 strategies — created_at without updated_at fallback
// ═══════════════════════════════════════════════════════════════════════════════

describe('v0→v1 created_at without updated_at fallback', () => {
  const schemasWithoutUpdatedAt = [
    ['oeeEventSchema (note: oeeEventSchema DOES have updated_at)', MIGRATIONS.oeeEventSchema[1]],
    ['shiftSessionSchema', MIGRATIONS.shiftSessionSchema[1]],
    ['operatorSchema', MIGRATIONS.operatorSchema[1]],
    ['productWeightStandardSchema', MIGRATIONS.productWeightStandardSchema[1]],
    ['plantConfigSchema', MIGRATIONS.plantConfigSchema[1]],
    ['shiftSummarySchema', MIGRATIONS.shiftSummarySchema[1]],
    ['downtimeConciliationSchema', MIGRATIONS.downtimeConciliationSchema[1]],
  ] as const;

  it.each(schemasWithoutUpdatedAt)(
    '%s v0→v1: falls back to now() when no created_at',
    (_name, migrate) => {
      const oldDoc = { id: 'doc1' };
      const result = migrate(oldDoc);

      expect(result.created_at).toBe(FROZEN_NOW);
    },
  );

  it.each(schemasWithoutUpdatedAt)(
    '%s v0→v1: preserves existing created_at',
    (_name, migrate) => {
      const oldDoc = { id: 'doc1', created_at: 99999 };
      const result = migrate(oldDoc);

      expect(result.created_at).toBe(99999);
    },
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// SYNC ERROR SCHEMA v0→v1
// ═══════════════════════════════════════════════════════════════════════════════

describe('syncErrorSchema v0→v1', () => {
  const migrate = MIGRATIONS.syncErrorSchema[1];

  it('creates created_at from fecha fallback', () => {
    const oldDoc = { id: 'se1', id_evento: 'evt1', payload_original: {}, mensaje_error: 'error', fecha: 12345 };
    const result = migrate(oldDoc);

    expect(result.created_at).toBe(12345);
    expect(result.updated_at).toBe(12345);
  });

  it('creates is_deleted defaults to false', () => {
    const oldDoc = { id: 'se1', id_evento: 'evt1', payload_original: {}, mensaje_error: 'error', fecha: 12345 };
    const result = migrate(oldDoc);

    expect(result.is_deleted).toBe(false);
  });

  it('falls back to now() when fecha is missing', () => {
    const oldDoc = { id: 'se1', id_evento: 'evt1', payload_original: {}, mensaje_error: 'error' };
    const result = migrate(oldDoc);

    expect(result.created_at).toBe(FROZEN_NOW);
    expect(result.updated_at).toBe(FROZEN_NOW);
  });

  it('preserves existing is_deleted when present', () => {
    const oldDoc = { id: 'se1', id_evento: 'evt1', payload_original: {}, mensaje_error: 'error', fecha: 12345, is_deleted: true };
    const result = migrate(oldDoc);

    expect(result.is_deleted).toBe(true);
  });

  it('preserves all other fields', () => {
    const oldDoc = { id: 'se1', id_evento: 'evt1', payload_original: { line_id: 'L1' }, mensaje_error: 'Timeout', fecha: 12345 };
    const result = migrate(oldDoc);

    expect(result.id).toBe('se1');
    expect(result.id_evento).toBe('evt1');
    expect(result.payload_original.line_id).toBe('L1');
    expect(result.mensaje_error).toBe('Timeout');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('edge cases', () => {
  // MIG-EDGE-01: empty oldDoc
  it('handles empty oldDoc — deleted → is_deleted with defaults', () => {
    const result = MIGRATIONS.assetSchema[1]({});

    expect(result.is_deleted).toBe(false);
    expect(result.deleted).toBeUndefined();
    expect(result.client_updated_at).toBe(FROZEN_NOW);
  });

  // MIG-EDGE-02: explicit is_deleted: false
  it('handles explicit is_deleted: false in v0→v1', () => {
    const result = MIGRATIONS.assetSchema[1]({ is_deleted: false });

    expect(result.is_deleted).toBe(false);
  });

  // MIG-EDGE-03: frozen now() consistency
  it('produces consistent timestamps within same migration batch', () => {
    const doc1 = MIGRATIONS.assetSchema[1]({});
    const doc2 = MIGRATIONS.assetSchema[1]({});
    const doc3 = MIGRATIONS.workOrderSchema[1]({});

    // All migrations that fall back to now() should get the same timestamp
    expect(doc1.client_updated_at).toBe(FROZEN_NOW);
    expect(doc2.client_updated_at).toBe(FROZEN_NOW);
    expect(doc3.created_at).toBe(FROZEN_NOW);
  });
});
