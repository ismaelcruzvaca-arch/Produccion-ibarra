/**
 * Integration Test — DTO roundtrip for downtime-conciliation collections.
 *
 * Verifies that the 3 new collections (downtime_conciliation, plant_config, shift_summary)
 * correctly map between:
 *   - Local RxDB format (camelCase, updated_at as epoch ms)
 *   - GraphQL/Hasura format (snake_case, updated_at as ISO 8601 string)
 *
 * Follows the existing cordon-umbilical.test.ts pattern.
 *
 * Tests:
 * 1. Downtime Conciliation: toGraphQL (push) → fromGraphQL (pull) roundtrip
 * 2. Plant Config: toGraphQL (push) → fromGraphQL (pull) roundtrip
 * 3. Shift Summary: toGraphQL (push) → fromGraphQL (pull) roundtrip
 */

import {
  toGraphQLDowntimeConciliation,
  fromGraphQLDowntimeConciliation,
  toGraphQLPlantConfig,
  fromGraphQLPlantConfig,
  toGraphQLShiftSummary,
  fromGraphQLShiftSummary,
  type GraphQLDowntimeConciliation,
  type GraphQLPlantConfig,
  type GraphQLShiftSummary,
} from '../dto';

import type {
  IDowntimeConciliation,
  IPlantConfig,
  IShiftSummary,
} from '../../core/types';

// ═══════════════════════════════════════════════════════════════════════════════
// 1. DOWNTIME CONCILIATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Downtime Conciliation DTO', () => {
  const mockGraphQL: GraphQLDowntimeConciliation = {
    id: 'dc-uuid-123',
    oee_event_id: 'oee-uuid-456',
    shift_session_id: 'shift-uuid-789',
    machine_id: 'MC-001',
    reason_code: 'FC',
    duration_min: 15.5,
    diagnosed_code: 'MC',
    diagnosed_by: 'supervisor-1',
    diagnosed_at: '2026-05-28T10:30:00.000Z',
    conciliated: true,
    conciliated_code: 'FC',
    conciliated_macro: 'MTTO',
    conciliated_by_prod: 'supervisor-1',
    conciliated_by_mtto: 'mechanic-2',
    conciliated_at: '2026-05-28T11:00:00.000Z',
    conciliation_notes: 'Se confirma falla de cavemil',
    status: 'reconciled',
    ot_sent: true,
    ot_response: 'wo-uuid-999',
    ot_sent_at: '2026-05-28T11:05:00.000Z',
    is_mtto: true,
    updated_at: '2026-05-28T11:05:00.000Z',
  };

  it('fromGraphQLDowntimeConciliation → IDowntimeConciliation válido (RxDB)', () => {
    const result = fromGraphQLDowntimeConciliation(mockGraphQL);

    // Core fields
    expect(result.id).toBe('dc-uuid-123');
    expect(result.oee_event_id).toBe('oee-uuid-456');
    expect(result.shift_session_id).toBe('shift-uuid-789');
    expect(result.machine_id).toBe('MC-001');
    expect(result.reason_code).toBe('FC');
    expect(result.duration_min).toBe(15.5);

    // Diagnosis fields
    expect(result.diagnosed_code).toBe('MC');
    expect(result.diagnosed_by).toBe('supervisor-1');
    expect(result.diagnosed_at).toBe(new Date('2026-05-28T10:30:00.000Z').getTime());

    // Maintenance fields
    expect(result.conciliated).toBe(true);
    expect(result.conciliated_code).toBe('FC');
    expect(result.conciliated_macro).toBe('MTTO');
    expect(result.conciliated_by_mtto).toBe('mechanic-2');
    expect(result.conciliated_at).toBe(new Date('2026-05-28T11:00:00.000Z').getTime());

    // Status & OT
    expect(result.status).toBe('reconciled');
    expect(result.ot_sent).toBe(true);
    expect(result.ot_response).toBe('wo-uuid-999');

    // Timestamp conversion (ISO → epoch ms)
    expect(result.updated_at).toBe(new Date('2026-05-28T11:05:00.000Z').getTime());

    // RxDB-only defaults
    expect(result.device_id).toBe('');
    expect(result.is_deleted).toBe(false);
  });

  it('toGraphQLDowntimeConciliation → payload sin campos RxDB-only', () => {
    const rxDoc: IDowntimeConciliation = {
      id: 'dc-uuid-123',
      oee_event_id: 'oee-uuid-456',
      shift_session_id: 'shift-uuid-789',
      machine_id: 'MC-001',
      reason_code: 'FC',
      duration_min: 15.5,
      diagnosed_code: 'MC',
      diagnosed_by: 'supervisor-1',
      diagnosed_at: new Date('2026-05-28T10:30:00.000Z').getTime(),
      conciliated: true,
      conciliated_code: 'FC',
      conciliated_macro: 'MTTO',
      conciliated_by_prod: 'supervisor-1',
      conciliated_by_mtto: 'mechanic-2',
      conciliated_at: new Date('2026-05-28T11:00:00.000Z').getTime(),
      conciliation_notes: 'Se confirma falla de cavemil',
      status: 'reconciled',
      ot_sent: true,
      ot_response: 'wo-uuid-999',
      ot_sent_at: new Date('2026-05-28T11:05:00.000Z').getTime(),
      is_mtto: true,
      updated_at: new Date('2026-05-28T11:05:00.000Z').getTime(),
      device_id: 'device-test-1',
      is_deleted: false,
    };

    const payload = toGraphQLDowntimeConciliation(rxDoc);

    // No debe incluir device_id ni is_deleted
    expect(payload.device_id).toBeUndefined();
    expect(payload.is_deleted).toBeUndefined();

    // Core fields
    expect(payload.id).toBe('dc-uuid-123');
    expect(payload.oee_event_id).toBe('oee-uuid-456');
    expect(payload.machine_id).toBe('MC-001');

    // updated_at debe ser ISO string, no epoch ms
    expect(payload.updated_at).toBe('2026-05-28T11:05:00.000Z');
    expect(typeof payload.updated_at).toBe('string');

    // diagnosed_at debe ser ISO string
    expect(payload.diagnosed_at).toBe('2026-05-28T10:30:00.000Z');
    expect(typeof payload.diagnosed_at).toBe('string');

    // conciliated_at debe ser ISO string
    expect(payload.conciliated_at).toBe('2026-05-28T11:00:00.000Z');

    // ot_sent_at debe ser ISO string
    expect(payload.ot_sent_at).toBe('2026-05-28T11:05:00.000Z');
  });

  it('toGraphQL → fromGraphQL roundtrip preserva datos', () => {
    const original: IDowntimeConciliation = {
      id: 'dc-uuid-123',
      oee_event_id: 'oee-uuid-456',
      shift_session_id: 'shift-uuid-789',
      machine_id: 'MC-001',
      reason_code: 'FC',
      duration_min: 15.5,
      diagnosed_code: 'MC',
      diagnosed_by: 'supervisor-1',
      diagnosed_at: 1716885000000,
      conciliated: true,
      conciliated_code: 'FC',
      conciliated_macro: 'MTTO',
      conciliated_by_prod: 'supervisor-1',
      conciliated_by_mtto: 'mechanic-2',
      conciliated_at: 1716886800000,
      conciliation_notes: 'Se confirma falla de cavemil',
      status: 'reconciled',
      ot_sent: true,
      ot_response: 'wo-uuid-999',
      ot_sent_at: 1716887100000,
      is_mtto: true,
      updated_at: 1716887100000,
      device_id: 'device-test-1',
      is_deleted: false,
    };

    const payload = toGraphQLDowntimeConciliation(original);
    const gql = payload as unknown as GraphQLDowntimeConciliation;
    const result = fromGraphQLDowntimeConciliation(gql);

    // Verificar que los valores numéricos hagan roundtrip (con tolerancia por ISO string precision)
    expect(result.id).toBe(original.id);
    expect(result.oee_event_id).toBe(original.oee_event_id);
    expect(result.shift_session_id).toBe(original.shift_session_id);
    expect(result.machine_id).toBe(original.machine_id);
    expect(result.reason_code).toBe(original.reason_code);
    expect(result.duration_min).toBe(original.duration_min);
    expect(result.diagnosed_code).toBe(original.diagnosed_code);
    expect(result.status).toBe(original.status);
    expect(result.ot_sent).toBe(original.ot_sent);
    expect(result.is_mtto).toBe(original.is_mtto);

    // Timestamps may have ms-level precision loss through ISO string parsing
    // but should be within < 1000ms of the original
    expect(Math.abs(result.updated_at - original.updated_at)).toBeLessThan(1000);
  });

  it('handles partial (pending) record with minimal fields', () => {
    const minimalGraphQL: GraphQLDowntimeConciliation = {
      id: 'dc-uuid-min',
      oee_event_id: 'oee-uuid-min',
      shift_session_id: undefined,
      machine_id: 'MC-002',
      reason_code: 'FS',
      duration_min: undefined,
      diagnosed_code: undefined,
      diagnosed_by: undefined,
      diagnosed_at: undefined,
      conciliated: false,
      conciliated_code: undefined,
      conciliated_macro: undefined,
      conciliated_by_prod: undefined,
      conciliated_by_mtto: undefined,
      conciliated_at: undefined,
      conciliation_notes: undefined,
      status: 'pending',
      ot_sent: false,
      ot_response: undefined,
      ot_sent_at: undefined,
      is_mtto: true,
      updated_at: '2026-05-28T12:00:00.000Z',
    };

    const result = fromGraphQLDowntimeConciliation(minimalGraphQL);

    expect(result.id).toBe('dc-uuid-min');
    expect(result.status).toBe('pending');
    expect(result.duration_min).toBeUndefined();
    expect(result.diagnosed_code).toBeUndefined();
    expect(result.conciliated).toBe(false);
    expect(result.ot_sent).toBe(false);
    expect(result.shift_session_id).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. PLANT CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

describe('Plant Config DTO', () => {
  const mockGraphQL: GraphQLPlantConfig = {
    key: 'micro_stop_threshold_min',
    value: '5',
    description: 'Umbral de micro-paro en minutos',
    updated_at: '2026-05-28T12:00:00.000Z',
  };

  it('fromGraphQLPlantConfig → IPlantConfig válido (RxDB)', () => {
    const result = fromGraphQLPlantConfig(mockGraphQL);

    expect(result.key).toBe('micro_stop_threshold_min');
    expect(result.value).toBe('5');
    expect(result.description).toBe('Umbral de micro-paro en minutos');
    expect(result.updated_at).toBe(new Date('2026-05-28T12:00:00.000Z').getTime());
    expect(result.device_id).toBe('');
    expect(result.is_deleted).toBe(false);
  });

  it('toGraphQLPlantConfig → payload sin campos RxDB-only', () => {
    const rxDoc: IPlantConfig = {
      key: 'micro_stop_threshold_min',
      value: '5',
      description: 'Umbral de micro-paro en minutos',
      updated_at: new Date('2026-05-28T12:00:00.000Z').getTime(),
      device_id: 'device-test-1',
      is_deleted: false,
    };

    const payload = toGraphQLPlantConfig(rxDoc);

    expect(payload.device_id).toBeUndefined();
    expect(payload.is_deleted).toBeUndefined();
    expect(payload.key).toBe('micro_stop_threshold_min');
    expect(payload.value).toBe('5');
    expect(payload.updated_at).toBe('2026-05-28T12:00:00.000Z');
    expect(typeof payload.updated_at).toBe('string');
  });

  it('toGraphQL → fromGraphQL roundtrip preserva datos', () => {
    const original: IPlantConfig = {
      key: 'micro_stop_threshold_min',
      value: '10',
      description: 'Umbral actualizado',
      updated_at: 1716890400000,
      device_id: 'device-test-1',
      is_deleted: false,
    };

    const payload = toGraphQLPlantConfig(original);
    const gql = payload as unknown as GraphQLPlantConfig;
    const result = fromGraphQLPlantConfig(gql);

    expect(result.key).toBe(original.key);
    expect(result.value).toBe(original.value);
    expect(result.description).toBe(original.description);
    expect(Math.abs(result.updated_at - original.updated_at)).toBeLessThan(1000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SHIFT SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

describe('Shift Summary DTO', () => {
  const mockGraphQL: GraphQLShiftSummary = {
    id: 'ss-uuid-123',
    shift_session_id: 'shift-uuid-789',
    total_planned_min: 480,
    total_downtime_min: 45,
    total_micro_stop_min: 12,
    total_mtto_min: 30,
    total_prod_min: 15,
    total_boxes: 850,
    total_rejects: 3,
    performance_pct: 87.50,
    has_pending_conciliation: true,
    updated_at: '2026-05-28T12:00:00.000Z',
  };

  it('fromGraphQLShiftSummary → IShiftSummary válido (RxDB)', () => {
    const result = fromGraphQLShiftSummary(mockGraphQL);

    expect(result.id).toBe('ss-uuid-123');
    expect(result.shift_session_id).toBe('shift-uuid-789');
    expect(result.total_planned_min).toBe(480);
    expect(result.total_downtime_min).toBe(45);
    expect(result.total_micro_stop_min).toBe(12);
    expect(result.total_mtto_min).toBe(30);
    expect(result.total_prod_min).toBe(15);
    expect(result.total_boxes).toBe(850);
    expect(result.total_rejects).toBe(3);
    expect(result.performance_pct).toBe(87.50);
    expect(result.has_pending_conciliation).toBe(true);
    expect(result.updated_at).toBe(new Date('2026-05-28T12:00:00.000Z').getTime());
    expect(result.device_id).toBe('');
    expect(result.is_deleted).toBe(false);
  });

  it('toGraphQLShiftSummary → payload sin campos RxDB-only', () => {
    const rxDoc: IShiftSummary = {
      id: 'ss-uuid-123',
      shift_session_id: 'shift-uuid-789',
      total_planned_min: 480,
      total_downtime_min: 45,
      total_micro_stop_min: 12,
      total_mtto_min: 30,
      total_prod_min: 15,
      total_boxes: 850,
      total_rejects: 3,
      performance_pct: 87.50,
      has_pending_conciliation: true,
      updated_at: new Date('2026-05-28T12:00:00.000Z').getTime(),
      device_id: 'device-test-1',
      is_deleted: false,
    };

    const payload = toGraphQLShiftSummary(rxDoc);

    expect(payload.device_id).toBeUndefined();
    expect(payload.is_deleted).toBeUndefined();
    expect(payload.id).toBe('ss-uuid-123');
    expect(payload.total_boxes).toBe(850);
    expect(payload.performance_pct).toBe(87.50);
    expect(payload.has_pending_conciliation).toBe(true);
    expect(payload.updated_at).toBe('2026-05-28T12:00:00.000Z');
  });

  it('toGraphQL → fromGraphQL roundtrip preserva datos', () => {
    const original: IShiftSummary = {
      id: 'ss-uuid-123',
      shift_session_id: 'shift-uuid-789',
      total_planned_min: 480,
      total_downtime_min: 45,
      total_micro_stop_min: 12,
      total_mtto_min: 30,
      total_prod_min: 15,
      total_boxes: 850,
      total_rejects: 3,
      performance_pct: 87.50,
      has_pending_conciliation: false,
      updated_at: 1716890400000,
      device_id: 'device-test-1',
      is_deleted: false,
    };

    const payload = toGraphQLShiftSummary(original);
    const gql = payload as unknown as GraphQLShiftSummary;
    const result = fromGraphQLShiftSummary(gql);

    expect(result.id).toBe(original.id);
    expect(result.shift_session_id).toBe(original.shift_session_id);
    expect(result.total_planned_min).toBe(original.total_planned_min);
    expect(result.total_downtime_min).toBe(original.total_downtime_min);
    expect(result.total_boxes).toBe(original.total_boxes);
    expect(result.performance_pct).toBe(original.performance_pct);
    expect(result.has_pending_conciliation).toBe(original.has_pending_conciliation);
    expect(Math.abs(result.updated_at - original.updated_at)).toBeLessThan(1000);
  });

  it('handles optional performance_pct as null/undefined', () => {
    const gql: GraphQLShiftSummary = {
      ...mockGraphQL,
      performance_pct: undefined,
    };

    const result = fromGraphQLShiftSummary(gql);
    expect(result.performance_pct).toBeUndefined();
  });

  it('handles has_pending_conciliation = false correctly', () => {
    const gql: GraphQLShiftSummary = {
      ...mockGraphQL,
      has_pending_conciliation: false,
    };

    const result = fromGraphQLShiftSummary(gql);
    expect(result.has_pending_conciliation).toBe(false);
  });
});
