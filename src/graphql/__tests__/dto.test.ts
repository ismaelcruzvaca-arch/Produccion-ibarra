/**
 * DTO Mapper Tests — all toGraphQL / fromGraphQL functions.
 *
 * Pattern: pure functions, plain data, no mocks.
 * Follows the existing work-order-dto.test.ts and downtime-conciliation-dto.test.ts patterns.
 *
 * Patterns tested:
 * - Timestamp conversion (epoch ms ↔ ISO string for TIMESTAMPTZ, epoch ms ↔ BIGINT string for BIGINT)
 * - Boolean rename: is_deleted ↔ deleted
 * - Asymmetric field mapping: shift_session_id ↔ shift_id, product_id ↔ product_code
 * - Boolean→result: passed ↔ result: 'pass'/'fail'
 * - RxDB-only fields omitted in toGraphQL (device_id, is_deleted)
 * - Round-trip: toGraphQL → fromGraphQL preserves semantically equivalent fields
 * - Empty/zero defaults in fromGraphQL
 */

import {
  toGraphQLAsset,
  fromGraphQLAsset,
  toGraphQLAssetType,
  fromGraphQLAssetType,
  toGraphQLReport,
  fromGraphQLReport,
  toGraphQLOeeEvent,
  fromGraphQLOeeEvent,
  toGraphQLSignature,
  fromGraphQLSignature,
  toGraphQLToasterLog,
  fromGraphQLToasterLog,
  toGraphQLMixingBatch,
  fromGraphQLMixingBatch,
  toGraphQLExtractorCheck,
  fromGraphQLExtractorCheck,
  toGraphQLVitaminKit,
  fromGraphQLVitaminKit,
  toGraphQLQualityInspection,
  fromGraphQLQualityInspection,
  toGraphQLDefectLog,
  fromGraphQLDefectLog,
  toGraphQLWeightLog,
  fromGraphQLWeightLog,
  toGraphQLShiftSession,
  fromGraphQLShiftSession,
  toGraphQLOperator,
  fromGraphQLOperator,
  toGraphQLProductWeightStandard,
  fromGraphQLProductWeightStandard,
  type GraphQLAsset,
  type GraphQLAssetType,
  type GraphQLReport,
  type GraphQLOeeEvent,
  type GraphQLSignature,
  type GraphQLToasterLog,
  type GraphQLMixingBatch,
  type GraphQLExtractorCheck,
  type GraphQLVitaminKit,
  type GraphQLQualityInspection,
  type GraphQLDefectLog,
  type GraphQLWeightLog,
  type GraphQLShiftSession,
  type GraphQLOperator,
  type GraphQLProductWeightStandard,
} from '../dto';

import type {
  IAsset,
  IAssetType,
  IReport,
  IOeeEvent,
  ISignature,
  IToasterLog,
  IMixingBatch,
  IExtractorCheck,
  IVitaminKit,
  IQualityInspection,
  IDefectLog,
  IWeightLog,
  IShiftSession,
  IOperator,
  IProductWeightStandard,
} from '../../core/types';

// ═══════════════════════════════════════════════════════════════════════════════
// 1. ASSET — timestamp, boolean rename, round-trip
// ═══════════════════════════════════════════════════════════════════════════════

describe('Asset DTO', () => {
  const EPOCH_MS = 1717086400000;

  const mockGraphQL: GraphQLAsset = {
    id: 'asset-uuid-123',
    name: 'Tostadora Principal',
    type_id: 'type-1',
    status: 'active',
    location: 'Planta Baja',
    serial_number: 'SN-001',
    manufacturer: 'Buhler',
    model_number: 'MT-2024',
    in_service_date: '1700000000000',
    warranty_expiration: '1730000000000',
    client_updated_at: EPOCH_MS.toString(),
    deleted: false,
  };

  const mockRxDoc: IAsset = {
    id: 'asset-uuid-123',
    name: 'Tostadora Principal',
    type_id: 'type-1',
    status: 'active',
    location: 'Planta Baja',
    serial_number: 'SN-001',
    manufacturer: 'Buhler',
    model_number: 'MT-2024',
    in_service_date: 1700000000000,
    warranty_expiration: 1730000000000,
    created_at: EPOCH_MS,
    updated_at: EPOCH_MS,
    is_deleted: false,
  };

  // ─── Timestamp: epoch ms → BIGINT string ──────────────────────────────────────

  it('toGraphQLAsset converts epoch ms timestamps to BIGINT strings', () => {
    const payload = toGraphQLAsset(mockRxDoc);

    expect(payload.client_updated_at).toBe(EPOCH_MS.toString());
    expect(typeof payload.client_updated_at).toBe('string');
    expect(payload.in_service_date).toBe('1700000000000');
    expect(typeof payload.in_service_date).toBe('string');
    expect(payload.warranty_expiration).toBe('1730000000000');
  });

  it('toGraphQLAsset handles undefined optional timestamps', () => {
    const doc: IAsset = {
      ...mockRxDoc,
      in_service_date: undefined,
      warranty_expiration: undefined,
    };

    const payload = toGraphQLAsset(doc);

    expect(payload.in_service_date).toBeUndefined();
    expect(payload.warranty_expiration).toBeUndefined();
  });

  // ─── Boolean rename: is_deleted ↔ deleted ─────────────────────────────────────

  it('toGraphQLAsset maps is_deleted → deleted', () => {
    const docTrue: IAsset = { ...mockRxDoc, is_deleted: true };
    const docFalse: IAsset = { ...mockRxDoc, is_deleted: false };

    expect(toGraphQLAsset(docTrue).deleted).toBe(true);
    expect(toGraphQLAsset(docFalse).deleted).toBe(false);
    expect(toGraphQLAsset(docTrue).is_deleted).toBeUndefined();
  });

  it('fromGraphQLAsset maps deleted → is_deleted', () => {
    const gqlTrue: GraphQLAsset = { ...mockGraphQL, deleted: true };
    const gqlFalse: GraphQLAsset = { ...mockGraphQL, deleted: false };

    expect(fromGraphQLAsset(gqlTrue).is_deleted).toBe(true);
    expect(fromGraphQLAsset(gqlFalse).is_deleted).toBe(false);
  });

  // ─── fromGraphQL: BIGINT string → epoch ms ────────────────────────────────────

  it('fromGraphQLAsset converts BIGINT string timestamps to epoch ms numbers', () => {
    const result = fromGraphQLAsset(mockGraphQL);

    expect(result.id).toBe('asset-uuid-123');
    expect(result.name).toBe('Tostadora Principal');
    expect(result.status).toBe('active');
    expect(result.in_service_date).toBe(1700000000000);
    expect(typeof result.in_service_date).toBe('number');
    expect(result.warranty_expiration).toBe(1730000000000);
    expect(typeof result.warranty_expiration).toBe('number');

    // client_updated_at → updated_at AND created_at
    expect(result.updated_at).toBe(EPOCH_MS);
    expect(result.created_at).toBe(EPOCH_MS);
  });

  it('fromGraphQLAsset handles undefined optional timestamps', () => {
    const gql: GraphQLAsset = {
      ...mockGraphQL,
      in_service_date: undefined,
      warranty_expiration: undefined,
    };

    const result = fromGraphQLAsset(gql);

    expect(result.in_service_date).toBeUndefined();
    expect(result.warranty_expiration).toBeUndefined();
  });

  // ─── Round-trip ───────────────────────────────────────────────────────────────

  it('toGraphQL → fromGraphQL roundtrip preserves semantically equivalent fields', () => {
    const original: IAsset = { ...mockRxDoc };

    const payload = toGraphQLAsset(original);
    const gql = payload as unknown as GraphQLAsset;
    const result = fromGraphQLAsset(gql);

    expect(result.id).toBe(original.id);
    expect(result.name).toBe(original.name);
    expect(result.type_id).toBe(original.type_id);
    expect(result.status).toBe(original.status);
    expect(result.location).toBe(original.location);
    expect(result.serial_number).toBe(original.serial_number);
    expect(result.manufacturer).toBe(original.manufacturer);
    expect(result.model_number).toBe(original.model_number);
    expect(result.in_service_date).toBe(original.in_service_date);
    expect(result.warranty_expiration).toBe(original.warranty_expiration);
    expect(result.is_deleted).toBe(original.is_deleted);

    // updated_at rounds through BIGINT string and back - should be exact (no decimals)
    expect(result.updated_at).toBe(original.updated_at);
    expect(result.created_at).toBe(original.updated_at);
  });

  // ─── RxDB-only fields ─────────────────────────────────────────────────────────

  it('toGraphQLAsset does not include is_deleted in payload', () => {
    const payload = toGraphQLAsset(mockRxDoc);
    expect(payload.is_deleted).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ASSET TYPE — timestamp, boolean rename
// ═══════════════════════════════════════════════════════════════════════════════

describe('AssetType DTO', () => {
  const EPOCH_MS = 1717086400000;

  const mockGraphQL: GraphQLAssetType = {
    id: 'at-uuid-1',
    code: 'HVAC',
    description: 'Heating, Ventilation & Air Conditioning',
    is_active: true,
    client_updated_at: EPOCH_MS.toString(),
    deleted: false,
  };

  it('toGraphQLAssetType maps correctly', () => {
    const doc: IAssetType = {
      id: 'at-uuid-1',
      code: 'HVAC',
      description: 'Heating, Ventilation & Air Conditioning',
      is_active: true,
      created_at: EPOCH_MS,
      updated_at: EPOCH_MS,
      is_deleted: false,
    };

    const payload = toGraphQLAssetType(doc);

    expect(payload.id).toBe('at-uuid-1');
    expect(payload.code).toBe('HVAC');
    expect(payload.is_active).toBe(true);
    expect(payload.deleted).toBe(false);
    expect(payload.client_updated_at).toBe(EPOCH_MS.toString());
    expect(payload.is_deleted).toBeUndefined();
  });

  it('fromGraphQLAssetType maps correctly', () => {
    const result = fromGraphQLAssetType(mockGraphQL);

    expect(result.id).toBe('at-uuid-1');
    expect(result.code).toBe('HVAC');
    expect(result.is_active).toBe(true);
    expect(result.is_deleted).toBe(false);
    expect(result.created_at).toBe(EPOCH_MS);
    expect(result.updated_at).toBe(EPOCH_MS);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. REPORT — timestamp, simple
// ═══════════════════════════════════════════════════════════════════════════════

describe('Report DTO', () => {
  const EPOCH_MS = 1717086400000;

  const mockGraphQL: GraphQLReport = {
    id: 'rpt-uuid-1',
    updated_at: EPOCH_MS.toString(),
    deleted: false,
    template_id: 'oee-basic',
    data: {
      line_id: 'L1',
      total_pieces: 1000,
      rejected_pieces: 15,
      downtime_minutes: 45,
    },
  };

  it('toGraphQLReport maps correctly', () => {
    const doc: IReport = {
      id: 'rpt-uuid-1',
      created_at: EPOCH_MS,
      updated_at: EPOCH_MS,
      is_deleted: false,
      template_id: 'oee-basic',
      data: { line_id: 'L1', total_pieces: 1000, rejected_pieces: 15, downtime_minutes: 45 },
    };

    const payload = toGraphQLReport(doc);

    expect(payload.id).toBe('rpt-uuid-1');
    expect(payload.updated_at).toBe(EPOCH_MS.toString());
    expect(payload.deleted).toBe(false);
    expect(payload.template_id).toBe('oee-basic');
    expect((payload.data as any).total_pieces).toBe(1000);
    expect(payload.is_deleted).toBeUndefined();
  });

  it('fromGraphQLReport maps correctly', () => {
    const result = fromGraphQLReport(mockGraphQL);

    expect(result.id).toBe('rpt-uuid-1');
    expect(result.created_at).toBe(EPOCH_MS);
    expect(result.updated_at).toBe(EPOCH_MS);
    expect(result.is_deleted).toBe(false);
    expect(result.template_id).toBe('oee-basic');
    expect(result.data.rejected_pieces).toBe(15);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. OEE EVENT — timestamp, boolean rename, round-trip
// ═══════════════════════════════════════════════════════════════════════════════

describe('OeeEvent DTO', () => {
  const EPOCH_MS = 1717086400000;

  const mockGraphQL: GraphQLOeeEvent = {
    id: 'oee-uuid-1',
    updated_at: EPOCH_MS.toString(),
    deleted: false,
    line_id: 'L1',
    machine_id: 'MC-001',
    operator_id: 'op-1',
    shift_id: 'shift-1',
    event_type: 'box_count',
    timestamp: EPOCH_MS.toString(),
    reason_code: undefined,
    quantity: 100,
    planned_boxes: 500,
    notes: undefined,
    is_retroactive: false,
    related_event_id: undefined,
    device_id: 'device-1',
  };

  it('toGraphQLOeeEvent maps epoch ms → BIGINT string', () => {
    const doc: IOeeEvent = {
      id: 'oee-uuid-1',
      created_at: EPOCH_MS,
      updated_at: EPOCH_MS,
      is_deleted: false,
      line_id: 'L1',
      machine_id: 'MC-001',
      operator_id: 'op-1',
      shift_id: 'shift-1',
      event_type: 'box_count',
      timestamp: EPOCH_MS,
      quantity: 100,
      planned_boxes: 500,
      is_retroactive: false,
      device_id: 'device-1',
    };

    const payload = toGraphQLOeeEvent(doc);

    expect(payload.updated_at).toBe(EPOCH_MS.toString());
    expect(payload.timestamp).toBe(EPOCH_MS.toString());
    expect(payload.deleted).toBe(false);
    expect(payload.shift_id).toBe('shift-1');
    expect(payload.device_id).toBe('device-1'); // device_id is IN oee_events
  });

  it('fromGraphQLOeeEvent maps BIGINT string → epoch ms', () => {
    const result = fromGraphQLOeeEvent(mockGraphQL);

    expect(result.updated_at).toBe(EPOCH_MS);
    expect(result.timestamp).toBe(EPOCH_MS);
    expect(result.is_deleted).toBe(false);
    expect(result.event_type).toBe('box_count');
    expect(result.quantity).toBe(100);
    expect(result.shift_id).toBe('shift-1');
  });

  it('fromGraphQLOeeEvent handles minimal fields', () => {
    const minimal: GraphQLOeeEvent = {
      id: 'oee-uuid-2',
      updated_at: EPOCH_MS.toString(),
      deleted: false,
      line_id: 'L1',
      machine_id: 'MC-001',
      shift_id: 'shift-1',
      event_type: 'shift_start',
      timestamp: EPOCH_MS.toString(),
    };

    const result = fromGraphQLOeeEvent(minimal);

    expect(result.id).toBe('oee-uuid-2');
    expect(result.event_type).toBe('shift_start');
    expect(result.operator_id).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. SIGNATURE — timestamp pass-through (BIGINT ↔ number)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Signature DTO', () => {
  const EPOCH_MS = 1717086400000;

  const mockGraphQL: GraphQLSignature = {
    id: 'sig-uuid-1',
    document_type: 'oee_report',
    document_id: 'doc-1',
    signer_id: 'op-1',
    signer_name: 'Juan Pérez',
    signer_role: 'operator',
    signed_at: EPOCH_MS.toString(),
    sequence: 1,
    is_deleted: false,
    created_at: EPOCH_MS.toString(),
    updated_at: EPOCH_MS.toString(),
  };

  it('toGraphQLSignature maps numeric timestamps → string', () => {
    const doc: ISignature = {
      id: 'sig-uuid-1',
      document_type: 'oee_report',
      document_id: 'doc-1',
      signer_id: 'op-1',
      signer_name: 'Juan Pérez',
      signer_role: 'operator',
      signed_at: EPOCH_MS,
      sequence: 1,
      created_at: EPOCH_MS,
      updated_at: EPOCH_MS,
      is_deleted: false,
    };

    const payload = toGraphQLSignature(doc);

    expect(payload.signed_at).toBe(EPOCH_MS.toString());
    expect(payload.created_at).toBe(EPOCH_MS.toString());
    expect(payload.updated_at).toBe(EPOCH_MS.toString());
    expect(payload.sequence).toBe(1);
    expect(payload.is_deleted).toBe(false);
  });

  it('fromGraphQLSignature maps string → number, with ?? defaults', () => {
    const result = fromGraphQLSignature(mockGraphQL);

    expect(result.signed_at).toBe(EPOCH_MS);
    expect(result.created_at).toBe(EPOCH_MS);
    expect(result.updated_at).toBe(EPOCH_MS);
    expect(result.sequence).toBe(1);
    expect(result.is_deleted).toBe(false);
  });

  it('fromGraphQLSignature applies ?? "" defaults for optional fields', () => {
    const gql: GraphQLSignature = {
      ...mockGraphQL,
      signer_id: undefined,
      signer_name: undefined,
      signer_role: undefined,
    };

    const result = fromGraphQLSignature(gql);

    expect(result.signer_id).toBe('');
    expect(result.signer_name).toBe('');
    expect(result.signer_role).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. QUALITY INSPECTION — disposition, data_source, shift_type (IT-AC-09)
// ═══════════════════════════════════════════════════════════════════════════════

describe('QualityInspection DTO', () => {
  const mockGraphQL: GraphQLQualityInspection = {
    id: 'qi-uuid-1',
    machine_id: 'M1',
    inspector_id: 'op-1',
    shift_type: 'matutino',
    disposition: 'liberado',
    notes: 'Todo en orden',
    data_source: 'manual',
    updated_at: '2023-11-14T22:53:20.000Z',
  };

  it('toGraphQLQualityInspection maps fields', () => {
    const payload = toGraphQLQualityInspection(mockRxDoc);

    expect(payload.machine_id).toBe('M1');
    expect(payload.inspector_id).toBe('op-1');
    expect(payload.shift_type).toBe('matutino');
    expect(payload.disposition).toBe('liberado');
    expect(payload.data_source).toBe('manual');
    // RxDB-only fields MUST NOT be in GraphQL payload
    expect(payload.device_id).toBeUndefined();
    expect(payload.is_deleted).toBeUndefined();
  });

  it('fromGraphQLQualityInspection maps fields correctly', () => {
    const result = fromGraphQLQualityInspection(mockGraphQL);

    expect(result.id).toBe('qi-uuid-1');
    expect(result.machine_id).toBe('M1');
    expect(result.inspector_id).toBe('op-1');
    expect(result.shift_type).toBe('matutino');
    expect(result.disposition).toBe('liberado');
    expect(result.data_source).toBe('manual');
  });

  it('fromGraphQLQualityInspection applies defaults for RxDB-only fields', () => {
    const result = fromGraphQLQualityInspection(mockGraphQL);

    expect(result.device_id).toBe('');  // default
    expect(result.is_deleted).toBe(false);  // default
  });

  it('fromGraphQLQualityInspection maps disposition types', () => {
    const gqlRechazado: GraphQLQualityInspection = { ...mockGraphQL, disposition: 'rechazado' };
    const result = fromGraphQLQualityInspection(gqlRechazado);

    expect(result.disposition).toBe('rechazado');
  });

  it('fromGraphQLQualityInspection handles undefined optional fields', () => {
    const gql: GraphQLQualityInspection = {
      ...mockGraphQL,
      notes: undefined,
    };

    const result = fromGraphQLQualityInspection(gql);

    expect(result.notes).toBeUndefined();
  });

  // ─── Round-trip ──────────────────────────────────────────────────────────────

  it('toGraphQL → fromGraphQL roundtrip preserves semantic fields', () => {
    const original = { ...mockRxDoc };
    const payload = toGraphQLQualityInspection(original);
    const gql = payload as unknown as GraphQLQualityInspection;
    const result = fromGraphQLQualityInspection(gql);

    expect(result.id).toBe(original.id);
    expect(result.machine_id).toBe(original.machine_id);
    expect(result.inspector_id).toBe(original.inspector_id);
    expect(result.disposition).toBe(original.disposition);
    expect(result.notes).toBe(original.notes);
    expect(result.is_deleted).toBe(original.is_deleted);
  });
});

// ─── Mock data matching DTO expectations ──────────────────────────────────────

const DTO_EPOCH_MS = 1717086400000;

const mockRxDoc = {
  id: 'qi-uuid-1',
  machine_id: 'M1',
  inspector_id: 'op-1',
  shift_type: 'matutino',
  disposition: 'liberado',
  notes: 'Todo en orden',
  data_source: 'manual',
  updated_at: DTO_EPOCH_MS,
  device_id: '',
  is_deleted: false,
} as unknown as IQualityInspection;

// ═══════════════════════════════════════════════════════════════════════════════
// 7. DEFECT LOG — asymmetric fields
// ═══════════════════════════════════════════════════════════════════════════════

describe('DefectLog DTO', () => {
  const ISO_TS = '2023-11-14T22:53:20.000Z';
  const EPOCH_MS = 1700000000000;

  const mockGraphQL: GraphQLDefectLog = {
    id: 'dl-uuid-1',
    inspection_id: 'qi-uuid-1',
    severity: 'critical',
    defect_type: 'Materia extraña',
    defect_count: 3,
    updated_at: ISO_TS,
  };

  const mockRxDoc = {
    id: 'dl-uuid-1',
    inspection_id: 'qi-uuid-1',
    severity: 'critical' as const,
    defect_type: 'Materia extraña',
    defect_count: 3,
    updated_at: EPOCH_MS,
    device_id: '',
    is_deleted: false,
  } as unknown as IDefectLog;

  it('toGraphQLDefectLog maps fields correctly', () => {
    const payload = toGraphQLDefectLog(mockRxDoc);

    expect(payload.severity).toBe('critical');
    expect(payload.defect_type).toBe('Materia extraña');
    expect(payload.defect_count).toBe(3);
    // RxDB-only fields should NOT be in GraphQL payload
    expect(payload.device_id).toBeUndefined();
    expect(payload.is_deleted).toBeUndefined();
  });

  it('fromGraphQLDefectLog maps fields correctly', () => {
    const result = fromGraphQLDefectLog(mockGraphQL);

    expect(result.severity).toBe('critical');
    expect(result.defect_type).toBe('Materia extraña');
    expect(result.defect_count).toBe(3);
    expect(result.id).toBe('dl-uuid-1');
    // RxDB-only fields get defaults
    expect(result.device_id).toBe('');
    expect(result.is_deleted).toBe(false);
  });

  // ─── Round-trip ──────────────────────────────────────────────────────────────

  it('toGraphQL → fromGraphQL roundtrip preserves semantic fields', () => {
    const original = { ...mockRxDoc };
    const payload = toGraphQLDefectLog(original);
    const gql = payload as unknown as GraphQLDefectLog;
    const result = fromGraphQLDefectLog(gql);

    expect(result.severity).toBe(original.severity);
    expect(result.defect_type).toBe(original.defect_type);
    expect(result.defect_count).toBe(original.defect_count);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. WEIGHT LOG
// ═══════════════════════════════════════════════════════════════════════════════

describe('WeightLog DTO', () => {
  const ISO_TS = '2023-11-14T22:53:20.000Z';
  const EPOCH_MS = 1700000000000;

  const mockGraphQL: GraphQLWeightLog = {
    id: 'wl-uuid-1',
    inspection_id: 'qi-uuid-1',
    measured_weight: 99.5,
    updated_at: ISO_TS,
  };

  const mockRxDoc = {
    id: 'wl-uuid-1',
    inspection_id: 'qi-uuid-1',
    measured_weight: 99.5,
    updated_at: EPOCH_MS,
    device_id: '',
    is_deleted: false,
  } as unknown as IWeightLog;

  it('toGraphQLWeightLog maps fields correctly', () => {
    const payload = toGraphQLWeightLog(mockRxDoc);

    expect(payload.measured_weight).toBe(99.5);
    expect(payload.device_id).toBeUndefined();
    expect(payload.is_deleted).toBeUndefined();
  });

  it('fromGraphQLWeightLog maps fields correctly', () => {
    const result = fromGraphQLWeightLog(mockGraphQL);

    expect(result.measured_weight).toBe(99.5);
    expect(result.device_id).toBe('');  // default
    expect(result.is_deleted).toBe(false);  // default
  });

  // ─── Round-trip ──────────────────────────────────────────────────────────────

  it('toGraphQL → fromGraphQL roundtrip preserves measured_weight', () => {
    const original = { ...mockRxDoc };
    const payload = toGraphQLWeightLog(original);
    const gql = payload as unknown as GraphQLWeightLog;
    const result = fromGraphQLWeightLog(gql);

    expect(result.measured_weight).toBe(original.measured_weight);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. TOASTER LOG — timestamp (BIGINT), `?? 0` / `?? ''` defaults
// ═══════════════════════════════════════════════════════════════════════════════

describe('ToasterLog DTO', () => {
  const EPOCH_MS = 1717086400000;

  const mockGraphQL: GraphQLToasterLog = {
    id: 'tl-uuid-1',
    line_id: 'L1',
    machine_id: 'MC-001',
    shift_id: 'shift-1',
    operator_id: 'op-1',
    created_at: EPOCH_MS.toString(),
    updated_at: EPOCH_MS.toString(),
    is_deleted: false,
    batch_number: 'B-001',
    temp_superior: 185,
    temp_media: 180,
    temp_inferior: 175,
    rpm: 1200,
    vapor_pressure: 5.5,
    cacao_crudo_humidity: 7.2,
    cacao_tostado_humidity: 3.1,
    pesadas: 10,
    silo: 'S-1',
    lotes: 'LOTE-A',
    tiempo_muerto_min: 15,
    tiempo_muerto_cause: 'Cambio de producto',
    inv_ini_cascarilla: 100,
    inv_ini_polvillo: 200,
    inv_ini_granilla: 300,
    inv_ini_cacao_crudo: 400,
    inv_ini_azucar: 500,
    inv_fin_cascarilla: 90,
    inv_fin_polvillo: 190,
    inv_fin_granilla: 290,
    inv_fin_cacao_crudo: 390,
    inv_fin_azucar: 490,
  };

  it('toGraphQLToasterLog passes numeric values through as-is', () => {
    const doc: IToasterLog = {
      id: 'tl-uuid-1',
      line_id: 'L1',
      machine_id: 'MC-001',
      shift_id: 'shift-1',
      operator_id: 'op-1',
      created_at: EPOCH_MS,
      updated_at: EPOCH_MS,
      is_deleted: false,
      batch_number: 'B-001',
      temp_superior: 185,
      temp_media: 180,
      temp_inferior: 175,
      rpm: 1200,
      vapor_pressure: 5.5,
      cacao_crudo_humidity: 7.2,
      cacao_tostado_humidity: 3.1,
      pesadas: 10,
      silo: 'S-1',
      lotes: 'LOTE-A',
      tiempo_muerto_min: 15,
      tiempo_muerto_cause: 'Cambio de producto',
      inv_ini_cascarilla: 100,
      inv_ini_polvillo: 200,
      inv_ini_granilla: 300,
      inv_ini_cacao_crudo: 400,
      inv_ini_azucar: 500,
      inv_fin_cascarilla: 90,
      inv_fin_polvillo: 190,
      inv_fin_granilla: 290,
      inv_fin_cacao_crudo: 390,
      inv_fin_azucar: 490,
    };

    const payload = toGraphQLToasterLog(doc);

    expect(payload.temp_superior).toBe(185);
    expect(payload.rpm).toBe(1200);
    expect(payload.batch_number).toBe('B-001');
    expect(payload.created_at).toBe(EPOCH_MS.toString());
    expect(payload.is_deleted).toBe(false);
  });

  it('fromGraphQLToasterLog applies ?? 0 / ?? "" defaults', () => {
    const result = fromGraphQLToasterLog(mockGraphQL);

    expect(result.temp_superior).toBe(185);
    expect(result.temp_media).toBe(180);
    expect(result.silo).toBe('S-1');
    expect(result.lotes).toBe('LOTE-A');
    expect(result.created_at).toBe(EPOCH_MS);
    expect(result.is_deleted).toBe(false);
  });

  it('fromGraphQLToasterLog fills undefined numeric fields with 0', () => {
    const gql: GraphQLToasterLog = {
      ...mockGraphQL,
      temp_superior: undefined,
      rpm: undefined,
    };

    const result = fromGraphQLToasterLog(gql);

    expect(result.temp_superior).toBe(0);
    expect(result.rpm).toBe(0);
  });

  it('fromGraphQLToasterLog fills undefined string fields with ""', () => {
    const gql: GraphQLToasterLog = {
      ...mockGraphQL,
      silo: undefined,
      lotes: undefined,
    };

    const result = fromGraphQLToasterLog(gql);

    expect(result.silo).toBe('');
    expect(result.lotes).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. MIXING BATCH — timestamp (BIGINT), `?? 0` / `?? ''` defaults
// ═══════════════════════════════════════════════════════════════════════════════

describe('MixingBatch DTO', () => {
  const EPOCH_MS = 1717086400000;

  const mockGraphQL: GraphQLMixingBatch = {
    id: 'mb-uuid-1',
    line_id: 'L1',
    machine_id: 'MC-001',
    shift_id: 'shift-1',
    operator_id: 'op-1',
    created_at: EPOCH_MS.toString(),
    updated_at: EPOCH_MS.toString(),
    is_deleted: false,
    batch_sequence: 1,
    mezcladora: 'MZ-1',
    agitador: 'AG-1',
    azucar_kg: 50,
    licor_kg: 30,
    cocoa_kg: 20,
    grasa_vegetal_kg: 10,
    lecitina_kg: 2,
    reproceso_kg: 5,
    viscosity_cps: 3500,
    discharge_temp: 42,
    mezcladas: 3,
    molidas: 2,
    reproceso_total: 5,
    desperdicio: 0.5,
    inv_ini_azucar: 1000,
    inv_ini_licor: 500,
    inv_ini_cocoa: 300,
    inv_ini_grasa_vegetal: 200,
    inv_ini_lecitina: 50,
    inv_ini_reproceso: 100,
    inv_fin_azucar: 950,
    inv_fin_licor: 470,
    inv_fin_cocoa: 280,
    inv_fin_grasa_vegetal: 190,
    inv_fin_lecitina: 48,
    inv_fin_reproceso: 95,
    consumo_azucar: 50,
    consumo_licor: 30,
    consumo_cocoa: 20,
    consumo_grasa_vegetal: 10,
    consumo_lecitina: 2,
    consumo_reproceso: 5,
  };

  it('toGraphQLMixingBatch passes numeric values through as-is', () => {
    const doc: IMixingBatch = {
      id: 'mb-uuid-1',
      line_id: 'L1',
      machine_id: 'MC-001',
      shift_id: 'shift-1',
      operator_id: 'op-1',
      created_at: EPOCH_MS,
      updated_at: EPOCH_MS,
      is_deleted: false,
      batch_sequence: 1,
      mezcladora: 'MZ-1',
      agitador: 'AG-1',
      azucar_kg: 50,
      licor_kg: 30,
      cocoa_kg: 20,
      grasa_vegetal_kg: 10,
      lecitina_kg: 2,
      reproceso_kg: 5,
      viscosity_cps: 3500,
      discharge_temp: 42,
      mezcladas: 3,
      molidas: 2,
      reproceso_total: 5,
      desperdicio: 0.5,
      inv_ini_azucar: 1000,
      inv_ini_licor: 500,
      inv_ini_cocoa: 300,
      inv_ini_grasa_vegetal: 200,
      inv_ini_lecitina: 50,
      inv_ini_reproceso: 100,
      inv_fin_azucar: 950,
      inv_fin_licor: 470,
      inv_fin_cocoa: 280,
      inv_fin_grasa_vegetal: 190,
      inv_fin_lecitina: 48,
      inv_fin_reproceso: 95,
      consumo_azucar: 50,
      consumo_licor: 30,
      consumo_cocoa: 20,
      consumo_grasa_vegetal: 10,
      consumo_lecitina: 2,
      consumo_reproceso: 5,
    };

    const payload = toGraphQLMixingBatch(doc);

    expect(payload.batch_sequence).toBe(1);
    expect(payload.azucar_kg).toBe(50);
    expect(payload.licor_kg).toBe(30);
    expect(payload.viscosity_cps).toBe(3500);
    expect(payload.created_at).toBe(EPOCH_MS.toString());
  });

  it('fromGraphQLMixingBatch applies ?? defaults', () => {
    const result = fromGraphQLMixingBatch(mockGraphQL);

    expect(result.mezcladora).toBe('MZ-1');
    expect(result.azucar_kg).toBe(50);
    expect(result.created_at).toBe(EPOCH_MS);
  });

  it('fromGraphQLMixingBatch fills undefined fields with defaults', () => {
    const gql: GraphQLMixingBatch = {
      ...mockGraphQL,
      mezcladora: undefined,
      azucar_kg: undefined,
    };

    const result = fromGraphQLMixingBatch(gql);

    expect(result.mezcladora).toBe('');
    expect(result.azucar_kg).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. EXTRACTOR CHECK — booleans, timestamps
// ═══════════════════════════════════════════════════════════════════════════════

describe('ExtractorCheck DTO', () => {
  const EPOCH_MS = 1717086400000;

  const mockGraphQL: GraphQLExtractorCheck = {
    id: 'ec-uuid-1',
    line_id: 'L1',
    machine_id: 'MC-001',
    shift_id: 'shift-1',
    operator_id: 'op-1',
    created_at: EPOCH_MS.toString(),
    updated_at: EPOCH_MS.toString(),
    is_deleted: false,
    extractor_1_on: true,
    extractor_2_on: false,
    extractor_3_on: true,
    extractor_4_on: false,
    extractor_5_on: true,
    extractor_6_on: false,
    extractor_7_on: true,
    extractor_8_on: false,
    cedazo_tt_last_cleaning: '1700000000000',
  };

  it('toGraphQLExtractorCheck maps all extractors and timestamp', () => {
    const doc: IExtractorCheck = {
      id: 'ec-uuid-1',
      line_id: 'L1',
      machine_id: 'MC-001',
      shift_id: 'shift-1',
      operator_id: 'op-1',
      created_at: EPOCH_MS,
      updated_at: EPOCH_MS,
      is_deleted: false,
      extractor_1_on: true,
      extractor_2_on: false,
      extractor_3_on: true,
      extractor_4_on: false,
      extractor_5_on: true,
      extractor_6_on: false,
      extractor_7_on: true,
      extractor_8_on: false,
      cedazo_tt_last_cleaning: 1700000000000,
    };

    const payload = toGraphQLExtractorCheck(doc);

    expect(payload.extractor_1_on).toBe(true);
    expect(payload.extractor_2_on).toBe(false);
    expect(payload.extractor_8_on).toBe(false);
    expect(payload.cedazo_tt_last_cleaning).toBe('1700000000000');
  });

  it('fromGraphQLExtractorCheck maps all extractors', () => {
    const result = fromGraphQLExtractorCheck(mockGraphQL);

    expect(result.extractor_1_on).toBe(true);
    expect(result.extractor_2_on).toBe(false);
    expect(result.extractor_7_on).toBe(true);
    expect(result.extractor_8_on).toBe(false);
  });

  it('fromGraphQLExtractorCheck handles cedazo undefined → default 0', () => {
    const gql: GraphQLExtractorCheck = {
      ...mockGraphQL,
      cedazo_tt_last_cleaning: undefined,
    };

    const result = fromGraphQLExtractorCheck(gql);

    expect(result.cedazo_tt_last_cleaning).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. VITAMIN KIT — JSONB pass-through, `?? 0` defaults
// ═══════════════════════════════════════════════════════════════════════════════

describe('VitaminKit DTO', () => {
  const EPOCH_MS = 1717086400000;
  const INGREDIENTS = [
    { name: 'Vitamina A', lote: 'L-001', quantity_kg: 0.5 },
    { name: 'Vitamina B12', lote: 'L-002', quantity_kg: 0.3 },
  ];

  const mockGraphQL: GraphQLVitaminKit = {
    id: 'vk-uuid-1',
    line_id: 'L1',
    machine_id: 'MC-001',
    shift_id: 'shift-1',
    operator_id: 'op-1',
    created_at: EPOCH_MS.toString(),
    updated_at: EPOCH_MS.toString(),
    is_deleted: false,
    orden: 'ORD-001',
    kit: 'KIT-A',
    semi_terminado: 'SEMI-001',
    ingredients: INGREDIENTS,
    verif_produccion: true,
    verif_calidad: false,
    peso_bascula_kg: 25.5,
    peso_fisico_kg: 25.3,
  };

  it('toGraphQLVitaminKit passes through ingredients (JSONB) as-is', () => {
    const doc: IVitaminKit = {
      id: 'vk-uuid-1',
      line_id: 'L1',
      machine_id: 'MC-001',
      shift_id: 'shift-1',
      operator_id: 'op-1',
      created_at: EPOCH_MS,
      updated_at: EPOCH_MS,
      is_deleted: false,
      orden: 'ORD-001',
      kit: 'KIT-A',
      semi_terminado: 'SEMI-001',
      ingredients: INGREDIENTS,
      verif_produccion: true,
      verif_calidad: false,
      peso_bascula_kg: 25.5,
      peso_fisico_kg: 25.3,
    };

    const payload = toGraphQLVitaminKit(doc);

    expect(payload.ingredients).toBe(INGREDIENTS);
    expect(payload.verif_produccion).toBe(true);
    expect(payload.verif_calidad).toBe(false);
    expect(payload.orden).toBe('ORD-001');
  });

  it('fromGraphQLVitaminKit maps all fields correctly', () => {
    const result = fromGraphQLVitaminKit(mockGraphQL);

    expect(result.ingredients).toBe(INGREDIENTS);
    expect(result.verif_produccion).toBe(true);
    expect(result.verif_calidad).toBe(false);
    expect(result.orden).toBe('ORD-001');
    expect(result.kit).toBe('KIT-A');
    expect(result.created_at).toBe(EPOCH_MS);
  });

  it('fromGraphQLVitaminKit applies ?? defaults', () => {
    const gql: GraphQLVitaminKit = {
      ...mockGraphQL,
      peso_bascula_kg: undefined,
      peso_fisico_kg: undefined,
    };

    const result = fromGraphQLVitaminKit(gql);

    expect(result.peso_bascula_kg).toBe(0);
    expect(result.peso_fisico_kg).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 13. SHIFT SESSION — timestamp (TIMESTAMPTZ → ISO 8601), RxDB-only omissions
// ═══════════════════════════════════════════════════════════════════════════════

describe('ShiftSession DTO', () => {
  const STARTED_AT_EPOCH = 1717086400000;
  const ENDED_AT_EPOCH = 1717090000000;
  const STARTED_AT_ISO = new Date(STARTED_AT_EPOCH).toISOString();
  const ENDED_AT_ISO = new Date(ENDED_AT_EPOCH).toISOString();

  const mockGraphQL: GraphQLShiftSession = {
    id: 'ss-uuid-1',
    machine_id: 'MC-001',
    operator_id: 'op-1',
    shift_type: 'matutino',
    status: 'active',
    started_at: STARTED_AT_ISO,
    ended_at: ENDED_AT_ISO,
    planned_boxes: 500,
    product_code: 'PROD-001',
    updated_at: STARTED_AT_ISO,
  };

  it('toGraphQLShiftSession converts epoch ms → ISO 8601', () => {
    const doc: IShiftSession = {
      id: 'ss-uuid-1',
      created_at: STARTED_AT_EPOCH,
      machine_id: 'MC-001',
      operator_id: 'op-1',
      shift_type: 'matutino',
      status: 'active',
      started_at: STARTED_AT_EPOCH,
      ended_at: ENDED_AT_EPOCH,
      planned_boxes: 500,
      product_code: 'PROD-001',
      updated_at: STARTED_AT_EPOCH,
      device_id: 'device-1',
      is_deleted: false,
    };

    const payload = toGraphQLShiftSession(doc);

    expect(payload.started_at).toBe(STARTED_AT_ISO);
    expect(payload.ended_at).toBe(ENDED_AT_ISO);
    expect(payload.updated_at).toBe(STARTED_AT_ISO);
    expect(typeof payload.started_at).toBe('string');
    expect(typeof payload.updated_at).toBe('string');

    // RxDB-only fields NOT included
    expect(payload.device_id).toBeUndefined();
    expect(payload.is_deleted).toBeUndefined();
  });

  it('toGraphQLShiftSession maps ended_at undefined → undefined', () => {
    const doc: IShiftSession = {
      id: 'ss-uuid-1',
      created_at: STARTED_AT_EPOCH,
      machine_id: 'MC-001',
      operator_id: 'op-1',
      shift_type: 'matutino',
      status: 'active',
      started_at: STARTED_AT_EPOCH,
      updated_at: STARTED_AT_EPOCH,
      device_id: 'device-1',
      is_deleted: false,
    };

    const payload = toGraphQLShiftSession(doc);

    expect(payload.ended_at).toBeUndefined();
  });

  it('fromGraphQLShiftSession converts ISO 8601 → epoch ms', () => {
    const result = fromGraphQLShiftSession(mockGraphQL);

    expect(result.started_at).toBe(STARTED_AT_EPOCH);
    expect(result.ended_at).toBe(ENDED_AT_EPOCH);
    expect(result.updated_at).toBe(new Date(STARTED_AT_ISO).getTime());
    expect(typeof result.started_at).toBe('number');
  });

  it('fromGraphQLShiftSession supplies RxDB-only defaults', () => {
    const result = fromGraphQLShiftSession(mockGraphQL);

    expect(result.device_id).toBe('');
    expect(result.is_deleted).toBe(false);
  });

  it('fromGraphQLShiftSession handles ended_at undefined', () => {
    const gql: GraphQLShiftSession = {
      ...mockGraphQL,
      ended_at: undefined,
    };

    const result = fromGraphQLShiftSession(gql);

    expect(result.ended_at).toBeUndefined();
  });

  it('toGraphQL → fromGraphQL roundtrip preserves semantic fields within 1ms', () => {
    const original: IShiftSession = {
      id: 'ss-uuid-2',
      created_at: 1716885000000,
      machine_id: 'MC-002',
      operator_id: 'op-2',
      shift_type: 'vespertino',
      status: 'closed',
      started_at: 1716885000000,
      ended_at: 1716890000000,
      planned_boxes: 600,
      product_code: 'PROD-002',
      updated_at: 1716890000000,
      device_id: 'device-2',
      is_deleted: false,
    };

    const payload = toGraphQLShiftSession(original);
    const gql = payload as unknown as GraphQLShiftSession;
    const result = fromGraphQLShiftSession(gql);

    expect(result.id).toBe(original.id);
    expect(result.machine_id).toBe(original.machine_id);
    expect(result.operator_id).toBe(original.operator_id);
    expect(result.shift_type).toBe(original.shift_type);
    expect(result.status).toBe(original.status);
    expect(result.planned_boxes).toBe(original.planned_boxes);
    expect(result.product_code).toBe(original.product_code);
    expect(Math.abs(result.started_at - original.started_at)).toBeLessThan(1000);
    expect(Math.abs(result.ended_at! - original.ended_at!)).toBeLessThan(1000);
    expect(Math.abs(result.updated_at - original.updated_at)).toBeLessThan(1000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 14. OPERATOR — RxDB-only fields omitted, TIMESTAMPTZ
// ═══════════════════════════════════════════════════════════════════════════════

describe('Operator DTO', () => {
  const EPOCH_MS = 1717086400000;
  const ISO_STR = new Date(EPOCH_MS).toISOString();

  const mockGraphQL: GraphQLOperator = {
    id: 'op-1',
    full_name: 'Juan Pérez',
    is_active: true,
    updated_at: ISO_STR,
  };

  it('toGraphQLOperator does NOT include RxDB-only fields', () => {
    const doc: IOperator = {
      id: 'op-1',
      full_name: 'Juan Pérez',
      is_active: true,
      created_at: EPOCH_MS,
      updated_at: EPOCH_MS,
      is_deleted: false,
      device_id: 'device-1',
    };

    const payload = toGraphQLOperator(doc);

    expect(payload.id).toBe('op-1');
    expect(payload.full_name).toBe('Juan Pérez');
    expect(payload.is_active).toBe(true);
    expect(payload.updated_at).toBe(ISO_STR);
    expect(payload.device_id).toBeUndefined();
    expect(payload.is_deleted).toBeUndefined();
    expect(payload.created_at).toBeUndefined();
  });

  it('fromGraphQLOperator maps and supplies RxDB-only defaults', () => {
    const result = fromGraphQLOperator(mockGraphQL);

    expect(result.id).toBe('op-1');
    expect(result.full_name).toBe('Juan Pérez');
    expect(result.is_active).toBe(true);
    expect(result.updated_at).toBe(EPOCH_MS);
    expect(result.device_id).toBe('');
    expect(result.is_deleted).toBe(false);
  });

  it('toGraphQL → fromGraphQL roundtrip', () => {
    const original: IOperator = {
      id: 'op-2',
      full_name: 'María García',
      is_active: true,
      created_at: EPOCH_MS,
      updated_at: EPOCH_MS,
      is_deleted: false,
      device_id: 'device-2',
    };

    const payload = toGraphQLOperator(original);
    const gql = payload as unknown as GraphQLOperator;
    const result = fromGraphQLOperator(gql);

    expect(result.id).toBe(original.id);
    expect(result.full_name).toBe(original.full_name);
    expect(result.is_active).toBe(original.is_active);
    expect(Math.abs(result.updated_at - original.updated_at)).toBeLessThan(1000);
    expect(result.device_id).toBe(''); // default, not preserved
    expect(result.is_deleted).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 15. PRODUCT WEIGHT STANDARD — TIMESTAMPTZ, RxDB-only omissions
// ═══════════════════════════════════════════════════════════════════════════════

describe('ProductWeightStandard DTO', () => {
  const EPOCH_MS = 1717086400000;
  const ISO_STR = new Date(EPOCH_MS).toISOString();

  const mockGraphQL: GraphQLProductWeightStandard = {
    sku: 'PROD-001',
    name: 'Chocolate 70%',
    lower_limit: 95,
    upper_limit: 105,
    requires_tare: true,
    updated_at: ISO_STR,
  };

  it('toGraphQLProductWeightStandard maps correctly', () => {
    const doc: IProductWeightStandard = {
      sku: 'PROD-001',
      name: 'Chocolate 70%',
      lower_limit: 95,
      upper_limit: 105,
      requires_tare: true,
      created_at: EPOCH_MS,
      updated_at: EPOCH_MS,
      is_deleted: false,
      device_id: 'device-1',
    };

    const payload = toGraphQLProductWeightStandard(doc);

    expect(payload.sku).toBe('PROD-001');
    expect(payload.lower_limit).toBe(95);
    expect(payload.upper_limit).toBe(105);
    expect(payload.requires_tare).toBe(true);
    expect(payload.updated_at).toBe(ISO_STR);
    expect(payload.device_id).toBeUndefined();
    expect(payload.is_deleted).toBeUndefined();
  });

  it('fromGraphQLProductWeightStandard maps and supplies RxDB-only defaults', () => {
    const result = fromGraphQLProductWeightStandard(mockGraphQL);

    expect(result.sku).toBe('PROD-001');
    expect(result.name).toBe('Chocolate 70%');
    expect(result.lower_limit).toBe(95);
    expect(result.upper_limit).toBe(105);
    expect(result.requires_tare).toBe(true);
    expect(result.updated_at).toBe(EPOCH_MS);
    expect(result.device_id).toBe('');
    expect(result.is_deleted).toBe(false);
  });
});
