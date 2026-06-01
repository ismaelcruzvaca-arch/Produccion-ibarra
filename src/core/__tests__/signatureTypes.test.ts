/**
 * T1.1 — ISignature interface type tests.
 *
 * Verifies the ISignature type can be imported and objects conforming to it
 * have the expected shape per the design contract.
 */

import type { ISignature } from '../types';

describe('ISignature', () => {
  const validSignature: ISignature = {
    id: 'sig-001',
    updated_at: 1715000000000,
    is_deleted: false,
    document_type: 'oee_report',
    document_id: 'doc-uuid-123',
    signer_id: 'operator-uuid-456',
    signer_name: 'Juan Pérez',
    signer_role: 'supervisor',
    signed_at: 1715000001000,
    sequence: 1,
  };

  it('has all required fields from design contract', () => {
    expect(validSignature.id).toBe('sig-001');
    expect(validSignature.updated_at).toBe(1715000000000);
    expect(validSignature.is_deleted).toBe(false);
    expect(validSignature.document_type).toBe('oee_report');
    expect(validSignature.document_id).toBe('doc-uuid-123');
    expect(validSignature.signer_id).toBe('operator-uuid-456');
    expect(validSignature.signer_name).toBe('Juan Pérez');
    expect(validSignature.signer_role).toBe('supervisor');
    expect(validSignature.signed_at).toBe(1715000001000);
    expect(validSignature.sequence).toBe(1);
  });

  it('supports quality_inspection document_type per DS-1 spec', () => {
    const qualitySig: ISignature = {
      ...validSignature,
      document_type: 'quality_inspection',
    };
    expect(qualitySig.document_type).toBe('quality_inspection');
  });

  it('supports all signer roles: operator, supervisor, admin', () => {
    const operatorSig: ISignature = { ...validSignature, signer_role: 'operator' };
    const adminSig: ISignature = { ...validSignature, signer_role: 'admin' };
    expect(operatorSig.signer_role).toBe('operator');
    expect(adminSig.signer_role).toBe('admin');
  });

  it('supports multi-signature documents via sequence field', () => {
    const firstSig: ISignature = { ...validSignature, sequence: 1 };
    const secondSig: ISignature = { ...validSignature, sequence: 2, id: 'sig-002' };
    const thirdSig: ISignature = { ...validSignature, sequence: 3, id: 'sig-003' };
    expect(firstSig.sequence).toBe(1);
    expect(secondSig.sequence).toBe(2);
    expect(thirdSig.sequence).toBe(3);
    // Same document, different signatures
    expect(firstSig.document_id).toBe(secondSig.document_id);
  });

  it('uses updated_at (not client_updated_at) per new data contract', () => {
    // TypeScript would fail compilation if ISignature required client_updated_at
    // This test confirms updated_at is the field name
    expect(validSignature.updated_at).toBeDefined();
    // @ts-expect-error — client_updated_at should NOT exist on ISignature
    expect((validSignature as any).client_updated_at).toBeUndefined();
  });
});
