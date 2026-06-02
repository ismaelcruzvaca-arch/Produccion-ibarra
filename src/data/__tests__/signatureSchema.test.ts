/**
 * T1.2 — signatureSchema validation tests.
 *
 * Verifies the RxDB schema for the signatures collection matches the design:
 * - version 0, pk = id
 * - required: id, updated_at, is_deleted, document_type, document_id, signer_id, signer_name, signer_role, signed_at, sequence
 * - indexes: [document_id], [[document_type, document_id]]
 * - Uses updated_at, NOT client_updated_at
 */

import { signatureSchema } from '../schemas';

describe('signatureSchema', () => {
  it('has version 1 and primaryKey id', () => {
    expect(signatureSchema.version).toBe(1);
    expect(signatureSchema.primaryKey).toBe('id');
  });

  it('defines all required fields per design contract', () => {
    const required = signatureSchema.required as string[];
    expect(required).toContain('id');
    expect(required).toContain('updated_at');
    expect(required).toContain('is_deleted');
    expect(required).toContain('document_type');
    expect(required).toContain('document_id');
    expect(required).toContain('signer_id');
    expect(required).toContain('signer_name');
    expect(required).toContain('signer_role');
    expect(required).toContain('signed_at');
    expect(required).toContain('sequence');
  });

  it('has id property with maxLength 100', () => {
    const props = signatureSchema.properties as Record<string, any>;
    expect(props.id).toBeDefined();
    expect(props.id.type).toBe('string');
    expect(props.id.maxLength).toBe(100);
  });

  it('has updated_at as number (NOT client_updated_at)', () => {
    const props = signatureSchema.properties as Record<string, any>;
    expect(props.updated_at).toBeDefined();
    expect(props.updated_at.type).toBe('number');
    // client_updated_at should NOT exist in this schema
    expect(props.client_updated_at).toBeUndefined();
  });

  it('has string properties for document_type, document_id, signer_name, signer_role', () => {
    const props = signatureSchema.properties as Record<string, any>;
    expect(props.document_type.type).toBe('string');
    expect(props.document_id.type).toBe('string');
    expect(props.signer_name.type).toBe('string');
    expect(props.signer_role.type).toBe('string');
  });

  it('has number properties for signed_at and sequence', () => {
    const props = signatureSchema.properties as Record<string, any>;
    expect(props.signed_at.type).toBe('number');
    expect(props.sequence.type).toBe('number');
  });

  it('has is_deleted as boolean', () => {
    const props = signatureSchema.properties as Record<string, any>;
    expect(props.is_deleted.type).toBe('boolean');
  });

  it('defines index on document_id', () => {
    const indexes = signatureSchema.indexes as Array<string | string[]>;
    expect(indexes).toContain('document_id');
  });

  it('defines compound index on [document_type, document_id]', () => {
    const indexes = signatureSchema.indexes as Array<string | string[]>;
    const compoundIndex = indexes.find(
      (idx) => Array.isArray(idx) && idx[0] === 'document_type' && idx[1] === 'document_id'
    );
    expect(compoundIndex).toBeDefined();
  });

  it('is of type object', () => {
    expect(signatureSchema.type).toBe('object');
  });
});
