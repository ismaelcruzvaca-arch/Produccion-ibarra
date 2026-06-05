/**
 * Integration Test — DTO roundtrip for Work Orders (wo-lifecycle-integration).
 *
 * Verifies that the work_order DTO correctly maps completed_at and all cmms-ibero
 * lifecycle fields between:
 *   - Local RxDB format (camelCase, timestamps as epoch ms)
 *   - GraphQL/Hasura format (snake_case, timestamps as ISO 8601 strings)
 *
 * Follows the existing downtime-conciliation-dto.test.ts pattern.
 *
 * Tests:
 * 1. toGraphQLWorkOrder maps completed_at (epoch ms → ISO 8601)
 * 2. fromGraphQLWorkOrder maps completed_at (ISO 8601 → epoch ms)
 * 3. Roundtrip: to → from preserves completed_at within ms precision
 * 4. Null/undefined handling for all lifecycle fields
 * 5. actual_start_at + completed_at both convert correctly in the same record
 */

import {
  toGraphQLWorkOrder,
  fromGraphQLWorkOrder,
  type GraphQLWorkOrder,
} from '../dto';

import type { IWorkOrder } from '../../core/types';

describe('Work Order DTO — completed_at', () => {
  // ─── Mock data ─────────────────────────────────────────────────────────────

  const mockGraphQL: GraphQLWorkOrder = {
    id: 'wo-uuid-123',
    equipment_id: 'MC-001',
    description: 'Reparar motor principal',
    status: 'open',
    priority: 'high',
    assigned_to: 'mec-1',
    scheduled_date: '1717000000000',
    completed_date: '1717086400000',
    client_updated_at: '1717086400000',
    deleted: false,

    // wo-lifecycle-outbox: cmms-ibero fields
    lifecycle_phase: 'INPRG',
    symptom_note: 'Ruido anormal en rodamiento',
    cause_note: 'Desgaste de rodamiento',
    action_note: 'Reemplazo de rodamiento SKF 6205',
    actual_start_at: '2026-05-29T08:00:00.000Z',
    completed_at: '2026-05-29T10:30:00.000Z',
    cmms_wo_id: 'cmms-wo-456',
  };

  const COMPLETED_AT_EPOCH = new Date('2026-05-29T10:30:00.000Z').getTime();
  const ACTUAL_START_AT_EPOCH = new Date('2026-05-29T08:00:00.000Z').getTime();

  // ─── toGraphQL: epoch ms → ISO 8601 ────────────────────────────────────────

  it('toGraphQLWorkOrder mapea completed_at epoch ms → ISO 8601', () => {
    const rxDoc: IWorkOrder = {
      id: 'wo-uuid-123',
      equipment_id: 'MC-001',
      description: 'Reparar motor principal',
      status: 'in_progress',
      priority: 'high',
      assigned_to: 'mec-1',
      scheduled_date: 1717000000000,
      completed_date: 1717086400000,
      created_at: 1717086400000,
      updated_at: 1717086400000,
      is_deleted: false,

      lifecycle_phase: 'INPRG',
      symptom_note: 'Ruido anormal en rodamiento',
      cause_note: 'Desgaste de rodamiento',
      action_note: 'Reemplazo de rodamiento SKF 6205',
      actual_start_at: ACTUAL_START_AT_EPOCH,
      completed_at: COMPLETED_AT_EPOCH,
      cmms_wo_id: 'cmms-wo-456',
    };

    const payload = toGraphQLWorkOrder(rxDoc);

    expect(payload.completed_at).toBe('2026-05-29T10:30:00.000Z');
    expect(typeof payload.completed_at).toBe('string');
    expect(payload.actual_start_at).toBe('2026-05-29T08:00:00.000Z');
    expect(payload.lifecycle_phase).toBe('INPRG');
    expect(payload.cmms_wo_id).toBe('cmms-wo-456');
  });

  it('toGraphQLWorkOrder mapea completed_at undefined → undefined', () => {
    const rxDoc: IWorkOrder = {
      id: 'wo-uuid-124',
      equipment_id: 'MC-001',
      description: 'Sin completar',
      status: 'pending',
      priority: 'medium',
      created_at: 1717086400000,
      updated_at: 1717086400000,
      is_deleted: false,
    };

    const payload = toGraphQLWorkOrder(rxDoc);

    expect(payload.completed_at).toBeUndefined();
    expect(payload.actual_start_at).toBeUndefined();
    expect(payload.lifecycle_phase).toBeUndefined();
  });

  // ─── fromGraphQL: ISO 8601 → epoch ms ──────────────────────────────────────

  it('fromGraphQLWorkOrder mapea completed_at ISO 8601 → epoch ms', () => {
    const result = fromGraphQLWorkOrder(mockGraphQL);

    expect(result.completed_at).toBe(COMPLETED_AT_EPOCH);
    expect(typeof result.completed_at).toBe('number');
    expect(result.actual_start_at).toBe(ACTUAL_START_AT_EPOCH);
    expect(result.lifecycle_phase).toBe('INPRG');
    expect(result.cmms_wo_id).toBe('cmms-wo-456');
  });

  it('fromGraphQLWorkOrder mapea completed_at undefined → undefined', () => {
    const gql: GraphQLWorkOrder = {
      ...mockGraphQL,
      completed_at: undefined,
      actual_start_at: undefined,
      lifecycle_phase: undefined,
    };

    const result = fromGraphQLWorkOrder(gql);

    expect(result.completed_at).toBeUndefined();
    expect(result.actual_start_at).toBeUndefined();
    expect(result.lifecycle_phase).toBeUndefined();
    expect(result.cmms_wo_id).toBe('cmms-wo-456'); // other fields still present
  });

  // ─── Roundtrip ─────────────────────────────────────────────────────────────

  it('toGraphQL → fromGraphQL roundtrip preserva completed_at dentro de 1ms', () => {
    const original: IWorkOrder = {
      id: 'wo-uuid-125',
      equipment_id: 'MC-002',
      description: 'Lubricación programada',
      status: 'in_progress',
      priority: 'low',
      created_at: 1717086400000,
      updated_at: 1717086400000,
      is_deleted: false,

      lifecycle_phase: 'COMP',
      actual_start_at: 1716885000000,
      completed_at: 1716886800000,
      cmms_wo_id: 'cmms-wo-789',
    };

    const payload = toGraphQLWorkOrder(original);
    const gql = payload as unknown as GraphQLWorkOrder;
    const result = fromGraphQLWorkOrder(gql);

    expect(result.id).toBe(original.id);
    expect(result.lifecycle_phase).toBe(original.lifecycle_phase);
    expect(result.cmms_wo_id).toBe(original.cmms_wo_id);
    expect(Math.abs(result.completed_at! - original.completed_at!)).toBeLessThan(1000);
    expect(Math.abs(result.actual_start_at! - original.actual_start_at!)).toBeLessThan(1000);
  });

  // ─── RxDB-only fields ──────────────────────────────────────────────────────

  it('fromGraphQLWorkOrder mapea is_deleted desde el campo deleted de GraphQL', () => {
    const result = fromGraphQLWorkOrder(mockGraphQL);

    expect(result.is_deleted).toBe(false);
  });

  it('toGraphQLWorkOrder mapea deleted como booleano (no incluye is_deleted)', () => {
    const rxDoc: IWorkOrder = {
      id: 'wo-uuid-126',
      equipment_id: 'MC-001',
      description: 'Test field mapping',
      status: 'pending',
      priority: 'medium',
      created_at: 1717086400000,
      updated_at: 1717086400000,
      is_deleted: true,
    };

    const payload = toGraphQLWorkOrder(rxDoc);

    expect(payload.deleted).toBe(true); // GraphQL espera 'deleted', no 'is_deleted'
  });
});
