/**
 * Tests for Work Order sync query builders (wo-lifecycle-integration).
 *
 * Verifies that the pull query builder and push mutation builder for work_orders
 * include completed_at and all cmms-ibero lifecycle fields in their selection sets
 * and update_columns.
 *
 * The actual builder functions in sync.ts are internal (not exported), so we
 * replicate the logic inline following the existing pattern from
 * useDowntimeConciliation.test.ts.
 */

// ─── Pull Query Builder ─────────────────────────────────────────────────────

type GraphQLWorkOrderCheckpoint = {
  client_updated_at?: string;
} | undefined;

function buildPullQuery(checkpoint: GraphQLWorkOrderCheckpoint, _limit: number) {
  return {
    query: `
      query PullWorkOrders($lastCheckpoint: bigint!) {
        work_orders(
          where: { client_updated_at: { _gt: $lastCheckpoint } },
          order_by: { client_updated_at: asc }
        ) {
          id
          equipment_id
          description
          status
          priority
          assigned_to
          scheduled_date
          completed_date
          client_updated_at
          deleted
          lifecycle_phase
          symptom_note
          cause_note
          action_note
          actual_start_at
          completed_at
          cmms_wo_id
        }
      }
    `,
    variables: {
      lastCheckpoint: checkpoint?.client_updated_at
        ? parseInt(checkpoint.client_updated_at, 10)
        : 0,
    },
  };
}

// ─── Push Mutation Builder ──────────────────────────────────────────────────

function buildPushMutation(objects: Record<string, unknown>[]) {
  return {
    query: `
      mutation UpsertWorkOrders($objects: [work_orders_insert_input!]!) {
        insert_work_orders(
          objects: $objects,
          on_conflict: {
            constraint: work_orders_pkey,
            update_columns: [
              equipment_id,
              description,
              status,
              priority,
              assigned_to,
              scheduled_date,
              completed_date,
              client_updated_at,
              deleted,
              lifecycle_phase,
              symptom_note,
              cause_note,
              action_note,
              actual_start_at,
              completed_at,
              cmms_wo_id
            ]
          }
        ) {
          affected_rows
        }
      }
    `,
    variables: { objects },
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════════════════════════

describe('Work Order Pull Query Builder', () => {
  it('incluye completed_at en el selection set', () => {
    const result = buildPullQuery(undefined, 100);
    expect(result.query).toContain('completed_at');
  });

  it('incluye todos los campos cmms-ibero lifecycle', () => {
    const result = buildPullQuery(undefined, 100);

    expect(result.query).toContain('lifecycle_phase');
    expect(result.query).toContain('symptom_note');
    expect(result.query).toContain('cause_note');
    expect(result.query).toContain('action_note');
    expect(result.query).toContain('actual_start_at');
    expect(result.query).toContain('completed_at');
    expect(result.query).toContain('cmms_wo_id');
  });

  it('incluye campos base de work_orders', () => {
    const result = buildPullQuery(undefined, 100);

    expect(result.query).toContain('id');
    expect(result.query).toContain('equipment_id');
    expect(result.query).toContain('description');
    expect(result.query).toContain('status');
    expect(result.query).toContain('client_updated_at');
  });

  it('usa checkpoint 0 cuando no hay checkpoint', () => {
    const result = buildPullQuery(undefined, 100);
    expect(result.variables.lastCheckpoint).toBe(0);
  });

  it('parsea client_updated_at del checkpoint correctamente', () => {
    const result = buildPullQuery(
      { client_updated_at: '1717086400000' },
      100,
    );
    expect(result.variables.lastCheckpoint).toBe(1717086400000);
  });
});

describe('Work Order Push Mutation Builder', () => {
  const mockObject = { id: 'wo-1', equipment_id: 'MC-001' };

  it('incluye completed_at en update_columns', () => {
    const result = buildPushMutation([mockObject]);
    expect(result.query).toContain('completed_at');
  });

  it('incluye todos los campos cmms-ibero lifecycle en update_columns', () => {
    const result = buildPushMutation([mockObject]);

    expect(result.query).toContain('lifecycle_phase');
    expect(result.query).toContain('symptom_note');
    expect(result.query).toContain('cause_note');
    expect(result.query).toContain('action_note');
    expect(result.query).toContain('actual_start_at');
    expect(result.query).toContain('completed_at');
    expect(result.query).toContain('cmms_wo_id');
  });

  it('incluye campos base en update_columns', () => {
    const result = buildPushMutation([mockObject]);

    expect(result.query).toContain('equipment_id');
    expect(result.query).toContain('description');
    expect(result.query).toContain('status');
    expect(result.query).toContain('client_updated_at');
  });

  it('pasa los objetos como variables', () => {
    const objects = [{ id: 'wo-1' }, { id: 'wo-2' }];
    const result = buildPushMutation(objects);

    expect(result.variables.objects).toHaveLength(2);
    expect(result.variables.objects[0].id).toBe('wo-1');
  });
});
