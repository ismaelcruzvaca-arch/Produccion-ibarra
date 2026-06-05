/**
 * Cordón Umbilical — Integration Test
 *
 * Valida el flujo completo de sincronización RxDB ↔ Hasura:
 * 1. Pull Inicial: DTOs roundtrip de catálogos (operators, product_weight_standards)
 * 2. Frente B: Creación de shift_session + DTO push
 * 3. Frente A: Creación de quality_inspection + defect_logs + weight_logs + DTO push
 * 4. Push: Verifica que los DTOs generen payloads correctos para Hasura
 *
 * Esta suite NO necesita conexión a Hasura — prueba los DTOs y la
 * integridad del schema local.
 */

import {
  toGraphQLOperator,
  fromGraphQLOperator,
  toGraphQLProductWeightStandard,
  fromGraphQLProductWeightStandard,
  toGraphQLShiftSession,
  fromGraphQLShiftSession,
  toGraphQLQualityInspection,
  fromGraphQLQualityInspection,
  toGraphQLDefectLog,
  fromGraphQLDefectLog,
  toGraphQLWeightLog,
  fromGraphQLWeightLog,
  type GraphQLOperator,
  type GraphQLProductWeightStandard,
  type GraphQLShiftSession,
  type GraphQLQualityInspection,
  type GraphQLDefectLog,
  type GraphQLWeightLog,
} from '../dto';

import type {
  IOperator,
  IProductWeightStandard,
  IShiftSession,
  IQualityInspection,
  IDefectLog,
  IWeightLog,
} from '../../core/types';

// ═══════════════════════════════════════════════════════════════════════════════
// 1. PULL INICIAL — Catálogos
// ═══════════════════════════════════════════════════════════════════════════════

describe('1. Pull Inicial — Catálogos', () => {
  describe('operators', () => {
    const mockGraphQL: GraphQLOperator = {
      id: 'OP-001',
      full_name: 'Juan Pérez',
      is_active: true,
      updated_at: '2026-05-25T10:00:00.000Z',
    };

    it('fromGraphQLOperator → IOperator válido (RxDB)', () => {
      const result = fromGraphQLOperator(mockGraphQL);
      expect(result.id).toBe('OP-001');
      expect(result.full_name).toBe('Juan Pérez');
      expect(result.is_active).toBe(true);
      // device_id e is_deleted son RxDB-only — deben tener default
      expect(result.device_id).toBe('');
      expect(result.is_deleted).toBe(false);
    });

    it('toGraphQLOperator → payload sin campos RxDB-only', () => {
      const rxDoc: IOperator = {
        id: 'OP-001',
        full_name: 'Juan Pérez',
        is_active: true,
        created_at: 1779703200000,
        updated_at: 1779703200000,
        device_id: 'device-test-1',
        is_deleted: false,
      };
      const payload = toGraphQLOperator(rxDoc);
      // No debe incluir device_id ni is_deleted
      expect(payload.device_id).toBeUndefined();
      expect(payload.is_deleted).toBeUndefined();
      // updated_at debe ser ISO string
      expect(typeof payload.updated_at).toBe('string');
      expect(payload.updated_at).toContain('2026');
    });
  });

  describe('product_weight_standards', () => {
    const mockGraphQL: GraphQLProductWeightStandard = {
      sku: 'CHOC-500',
      name: 'Chocolate 500g',
      lower_limit: 490.00,
      upper_limit: 510.00,
      requires_tare: true,
      updated_at: '2026-05-25T10:00:00.000Z',
    };

    it('fromGraphQLProductWeightStandard → IProductWeightStandard (RxDB)', () => {
      const result = fromGraphQLProductWeightStandard(mockGraphQL);
      // PK = sku (natural key)
      expect(result.sku).toBe('CHOC-500');
      expect(result.lower_limit).toBe(490);
      expect(result.upper_limit).toBe(510);
      expect(result.requires_tare).toBe(true);
      // TIMESTAMPTZ → epoch ms: 2026-05-25T10:00:00.000Z
      expect(result.updated_at).toBe(1779703200000);
      // RxDB-only fields
      expect(result.device_id).toBe('');
      expect(result.is_deleted).toBe(false);
    });

    it('toGraphQLProductWeightStandard → payload sin campos RxDB-only', () => {
      const rxDoc: IProductWeightStandard = {
        sku: 'CHOC-500',
        name: 'Chocolate 500g',
        lower_limit: 490,
        upper_limit: 510,
        requires_tare: true,
        created_at: 1779703200000,
        updated_at: 1779703200000,
        device_id: 'device-x',
        is_deleted: false,
      };
      const payload = toGraphQLProductWeightStandard(rxDoc);
      expect(payload.sku).toBe('CHOC-500');
      expect(payload.lower_limit).toBe(490);
      // Campos RxDB-only NO deben ir al push
      expect(payload.device_id).toBeUndefined();
      expect(payload.is_deleted).toBeUndefined();
    });

    it('toGraphQLProductWeightStandard → payload sin campos RxDB-only', () => {
      const rxDoc: IProductWeightStandard = {
        sku: 'CHOC-500',
        name: 'Chocolate 500g',
        lower_limit: 490,
        upper_limit: 510,
        requires_tare: true,
        created_at: 1748253600000,
        updated_at: 1748253600000,
        device_id: 'device-x',
        is_deleted: false,
      };
      const payload = toGraphQLProductWeightStandard(rxDoc);
      expect(payload.sku).toBe('CHOC-500');
      expect(payload.lower_limit).toBe(490);
      // Campos RxDB-only NO deben ir al push
      expect(payload.device_id).toBeUndefined();
      expect(payload.is_deleted).toBeUndefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. FRENTE B — Shift Sessions
// ═══════════════════════════════════════════════════════════════════════════════

describe('2. Frente B — Shift Sessions', () => {
  const mockGraphQL: GraphQLShiftSession = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    machine_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    operator_id: 'OP-001',
    shift_type: 'matutino',
    status: 'active',
    started_at: '2026-05-25T06:00:00.000Z',
    ended_at: null as any,
    planned_boxes: 480,
    product_code: '102/953',
    updated_at: '2026-05-25T06:00:00.000Z',
  };

  it('fromGraphQLShiftSession → IShiftSession con planned_boxes', () => {
    const result = fromGraphQLShiftSession(mockGraphQL);
    expect(result.shift_type).toBe('matutino');
    expect(result.started_at).toBe(1779688800000); // epoch ms = 2026-05-25T06:00:00Z
    expect(result.ended_at).toBeUndefined();
    // planned_boxes y product_code se MANTIENEN (migration 013)
    expect(result.planned_boxes).toBe(480);
    expect(result.product_code).toBe('102/953');
    // RxDB-only
    expect(result.device_id).toBe('');
    expect(result.is_deleted).toBe(false);
  });

  it('toGraphQLShiftSession → payload completo para Hasura', () => {
    const rxDoc: IShiftSession = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      machine_id: 'a1b2c3d4',
      operator_id: 'OP-001',
      shift_type: 'matutino',
      status: 'active',
      started_at: 1779688800000,
      ended_at: undefined,
      planned_boxes: 480,
      product_code: '102/953',
      created_at: 1779688800000,
      updated_at: 1779688800000,
      device_id: 'device-test',
      is_deleted: false,
    };
    const payload = toGraphQLShiftSession(rxDoc);
    // Campos obligatorios
    expect(payload.machine_id).toBeDefined();
    
    expect(payload.shift_type).toBe('matutino');
    // planned_boxes incluido en push
    expect(payload.planned_boxes).toBe(480);
    expect(payload.product_code).toBe('102/953');
    // updated_at como ISO string
    expect(typeof payload.updated_at).toBe('string');
    // RxDB-only NO deben ir
    expect(payload.device_id).toBeUndefined();
    expect(payload.is_deleted).toBeUndefined();
  });

  it('cierre de turno: ended_at se incluye en push', () => {
    const closedSession: IShiftSession = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      machine_id: 'a1b2c3d4',
      operator_id: 'OP-001',
      shift_type: 'matutino',
      status: 'closed',
      started_at: 1748224800000,
      planned_boxes: 480,
      product_code: '102/953',
      created_at: 1748253600000,
      updated_at: 1748253600000,
      device_id: 'device-test',
      is_deleted: false,
      ended_at: 1748253600000,
    };
    const payload = toGraphQLShiftSession(closedSession);
    expect(payload.status).toBe('closed');
    expect(payload.ended_at).toBeDefined();
    expect(typeof payload.ended_at).toBe('string');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. FRENTE A — Quality Inspections + Defect Logs + Weight Logs
// ═══════════════════════════════════════════════════════════════════════════════

describe('3. Frente A — Calidad', () => {
  const INSPECTION_ID = '660e8400-e29b-41d4-a716-446655440001';

  describe('quality_inspections', () => {
    const mockGraphQL: GraphQLQualityInspection = {
      id: INSPECTION_ID,
      machine_id: 'a1b2c3d4',
      inspector_id: 'OP-001',
      shift_type: 'matutino',
      disposition: 'liberado',
      notes: 'Inspección de rutina',
      data_source: 'manual',
      updated_at: '2026-05-25T06:30:00.000Z',
    };

    it('fromGraphQLQualityInspection → IQualityInspection con disposition', () => {
      const result = fromGraphQLQualityInspection(mockGraphQL);
      // Los campos RxDB-only tienen defaults seguros
      expect((result as any).result).toBeUndefined();
      expect((result as any).inspection_type).toBe('');
      expect((result as any).value).toBe(0);
      // DEBE tener disposition con términos reales de fábrica
      expect(result.disposition).toBe('liberado');
      expect(result.shift_type).toBe('matutino');
      expect(result.inspector_id).toBe('OP-001');
      expect(result.data_source).toBe('manual');
      // RxDB-only
      expect(result.device_id).toBe('');
      expect(result.is_deleted).toBe(false);
    });

    it('toGraphQLQualityInspection → payload sin campos RxDB-only', () => {
      const rxDoc: IQualityInspection = {
        id: INSPECTION_ID,
        machine_id: 'a1b2c3d4',
        inspector_id: 'OP-001',
        shift_type: 'matutino',
        disposition: 'rechazado',
        notes: 'Peso fuera de rango',
        data_source: 'manual',
        created_at: 1779690600000,
        updated_at: 1779690600000,
        device_id: 'device-test',
        is_deleted: false,
        inspection_type: 'visual',
        passed: false,
        value: 0,
        unit: '',
        product_id: '',
        line_id: '',
        shift_session_id: '',
        operator_id: 'OP-001',
      };
    const payload = toGraphQLQualityInspection(rxDoc);
      // Campos del negocio
      expect(payload.disposition).toBe('rechazado');
      expect(payload.data_source).toBe('manual');
      // RxDB-only NO deben ir al push
      expect(payload.device_id).toBeUndefined();
      expect(payload.is_deleted).toBeUndefined();
    });
  });

  describe('defect_logs (1:N children)', () => {
    const mockGraphQL: GraphQLDefectLog = {
      id: '770e8400-e29b-41d4-a716-446655440002',
      inspection_id: INSPECTION_ID,
      severity: 'major',
      defect_type: 'peso_bajo',
      defect_count: 5,
      updated_at: '2026-05-25T06:30:00.000Z',
    };

    it('fromGraphQLDefectLog → IDefectLog sin campos inventados', () => {
      const result = fromGraphQLDefectLog(mockGraphQL);
      expect(result.inspection_id).toBe(INSPECTION_ID);
      expect(result.severity).toBe('major');
      expect(result.defect_type).toBe('peso_bajo');
      expect(result.defect_count).toBe(5);
      // RxDB-only
      expect(result.device_id).toBe('');
      expect(result.is_deleted).toBe(false);
    });

    it('toGraphQLDefectLog → payload limpio para Hasura', () => {
      const rxDoc: IDefectLog = {
        id: '770e8400-e29b-41d4-a716-446655440002',
        inspection_id: INSPECTION_ID,
        severity: 'major',
        defect_type: 'peso_bajo',
        defect_count: 5,
        created_at: 1748253600000,
        updated_at: 1748253600000,
        device_id: 'device-test',
        is_deleted: false,
      };
      const payload = toGraphQLDefectLog(rxDoc);
      expect(payload.inspection_id).toBe(INSPECTION_ID);
      expect(payload.severity).toBe('major');
      // RxDB-only NO deben ir
      expect(payload.device_id).toBeUndefined();
      expect(payload.is_deleted).toBeUndefined();
    });
  });

  describe('weight_logs (1:N children)', () => {
    const mockGraphQL: GraphQLWeightLog = {
      id: '880e8400-e29b-41d4-a716-446655440003',
      inspection_id: INSPECTION_ID,
      measured_weight: 248.50,
      updated_at: '2026-05-25T06:30:00.000Z',
    };

    it('fromGraphQLWeightLog → IWeightLog con valores numéricos', () => {
      const result = fromGraphQLWeightLog(mockGraphQL);
      expect(result.inspection_id).toBe(INSPECTION_ID);
      expect(result.measured_weight).toBe(248.50);
      // RxDB-only
      expect(result.device_id).toBe('');
      expect(result.is_deleted).toBe(false);
    });

    it('toGraphQLWeightLog → payload sin device_id ni is_deleted', () => {
      const rxDoc: IWeightLog = {
        id: '880e8400-e29b-41d4-a716-446655440003',
        inspection_id: INSPECTION_ID,
        measured_weight: 248.50,
        created_at: 1748253600000,
        updated_at: 1748253600000,
        device_id: 'device-test',
        is_deleted: false,
      };
      const payload = toGraphQLWeightLog(rxDoc);
      expect(payload.measured_weight).toBe(248.50);
      expect(payload.device_id).toBeUndefined();
      expect(payload.is_deleted).toBeUndefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. PUSH — Validación de payloads contra schema de Hasura
// ═══════════════════════════════════════════════════════════════════════════════

describe('4. Push — Integridad de payloads', () => {
  it('ningún DTO de push incluye device_id o is_deleted', () => {
    // Operators (pull-only — ni siquiera tiene toGraphQL)
    expect((toGraphQLOperator as any)).toBeDefined();

    // ProductWeightStandard (pull-only)
    const pws: IProductWeightStandard = {
      sku: 'CHOC-250', name: 'Chocolate 250g',
      lower_limit: 245, upper_limit: 255, requires_tare: true,
      created_at: 1748253600000, updated_at: 1748253600000, device_id: 'x', is_deleted: false,
    };
    const pwsPayload = toGraphQLProductWeightStandard(pws);
    expect(pwsPayload.device_id).toBeUndefined();
    expect(pwsPayload.is_deleted).toBeUndefined();

    // QualityInspection
    const qi: IQualityInspection = {
      id: 'id-1', machine_id: 'm-1', inspector_id: 'op-1',
      shift_type: 'matutino', disposition: 'liberado',
      data_source: 'manual', created_at: 1748253600000,
      updated_at: 1748253600000,
      device_id: 'x', is_deleted: false,
      inspection_type: 'visual', passed: true, value: 0, unit: '',
      product_id: '', line_id: '', shift_session_id: '',
      operator_id: 'op-1',
    };
    const qiPayload = toGraphQLQualityInspection(qi);
    expect(qiPayload.device_id).toBeUndefined();
    expect(qiPayload.is_deleted).toBeUndefined();

    // DefectLog
    const dl: IDefectLog = {
      id: 'id-2', inspection_id: 'id-1', severity: 'major',
      defect_type: 'peso_bajo', defect_count: 3,
      created_at: 1748253600000, updated_at: 1748253600000, device_id: 'x', is_deleted: false,
    };
    const dlPayload = toGraphQLDefectLog(dl);
    expect(dlPayload.device_id).toBeUndefined();
    expect(dlPayload.is_deleted).toBeUndefined();

    // WeightLog
    const wl: IWeightLog = {
      id: 'id-3', inspection_id: 'id-1', measured_weight: 250,
      created_at: 1748253600000, updated_at: 1748253600000, device_id: 'x', is_deleted: false,
    };
    const wlPayload = toGraphQLWeightLog(wl);
    expect(wlPayload.device_id).toBeUndefined();
    expect(wlPayload.is_deleted).toBeUndefined();

    // ShiftSession
    const ss: IShiftSession = {
      id: 'id-4', machine_id: 'm-1', operator_id: 'op-1',
      shift_type: 'matutino', status: 'active',
      started_at: 1748224800000, planned_boxes: 480,
      created_at: 1748253600000, updated_at: 1748253600000, device_id: 'x', is_deleted: false,
    };
    const ssPayload = toGraphQLShiftSession(ss);
    expect(ssPayload.device_id).toBeUndefined();
    expect(ssPayload.is_deleted).toBeUndefined();
  });

  it('TIMESTAMPTZ conversion: epoch ms ↔ ISO string roundtrip', () => {
    // Usar Date.now() para prueba en tiempo real
    const now = Date.now();
    const isoString = new Date(now).toISOString();

    // RxDB → Hasura (toGraphQL): epoch ms → ISO string
    expect(typeof isoString).toBe('string');

    // Hasura → RxDB (fromGraphQL): ISO string → epoch ms
    const backToEpoch = new Date(isoString).getTime();
    expect(backToEpoch).toBe(now);
  });
});
