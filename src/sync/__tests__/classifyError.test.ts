/**
 * Unit tests for classifyError() — error classification logic.
 *
 * Tests cover:
 * - FK violation → constraint
 * - Network timeout → transient
 * - Malformed/unexpected response → unknown
 * - Edge cases: undefined, null, string errors, custom error objects
 */

import { classifyError } from '../resilientReplication';

describe('classifyError', () => {
  // ── Constraint errors ────────────────────────────────────────────────────

  describe('constraint classification', () => {
    it('classifies FK violation as constraint', () => {
      const error = new Error(
        'Foreign key violation. insert or update on table "oee_events" violates foreign key constraint "oee_events_line_id_fkey"'
      );
      const result = classifyError(error);
      expect(result.type).toBe('constraint');
      expect(result.message).toContain('Foreign key violation');
    });

    it('classifies not-null violation as constraint', () => {
      const error = new Error(
        'not-null constraint violation. null value in column "shift_id" violates not-null constraint'
      );
      const result = classifyError(error);
      expect(result.type).toBe('constraint');
    });

    it('classifies duplicate key violation as constraint', () => {
      const error = new Error(
        'duplicate key value violates unique constraint "oee_events_pkey"'
      );
      const result = classifyError(error);
      expect(result.type).toBe('constraint');
    });

    it('classifies check constraint violation as constraint', () => {
      const error = new Error(
        'new row for relation "oee_events" violates check constraint "oee_events_event_type_check"'
      );
      const result = classifyError(error);
      expect(result.type).toBe('constraint');
    });

    it('extracts docId from UUID in FK error message', () => {
      const error = new Error(
        'Foreign key violation. Key (line_id)=(a1b2c3d4-e5f6-7890-abcd-ef1234567890) is not present in table "lines".'
      );
      const result = classifyError(error);
      expect(result.type).toBe('constraint');
      if (result.type === 'constraint') {
        expect(result.docId).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
      }
    });

    it('classifies constraint keyword in any position as constraint', () => {
      const error = new Error(
        'GraphQL error: constraint violation detected on server'
      );
      const result = classifyError(error);
      expect(result.type).toBe('constraint');
    });
  });

  // ── Transient errors ─────────────────────────────────────────────────────

  describe('transient classification', () => {
    it('classifies network error as transient', () => {
      const error = new Error('Network request failed');
      const result = classifyError(error);
      expect(result.type).toBe('transient');
    });

    it('classifies timeout error as transient', () => {
      const error = new Error('Request timed out after 30000ms');
      const result = classifyError(error);
      expect(result.type).toBe('transient');
    });

    it('classifies ECONNREFUSED as transient', () => {
      const error = new Error('connect ECONNREFUSED 127.0.0.1:5432');
      const result = classifyError(error);
      expect(result.type).toBe('transient');
    });

    it('classifies ECONNRESET as transient', () => {
      const error = new Error('read ECONNRESET');
      const result = classifyError(error);
      expect(result.type).toBe('transient');
    });

    it('classifies ETIMEDOUT as transient', () => {
      const error = new Error('connect ETIMEDOUT');
      const result = classifyError(error);
      expect(result.type).toBe('transient');
    });

    it('classifies fetch failed as transient', () => {
      const error = new Error('fetch failed');
      const result = classifyError(error);
      expect(result.type).toBe('transient');
    });

    it('classifies abort error as transient', () => {
      const error = new Error('The operation was aborted');
      const result = classifyError(error);
      expect(result.type).toBe('transient');
    });

    it('classifies 503 Service Unavailable as transient', () => {
      const error = new Error('HTTP 503 Service Unavailable');
      const result = classifyError(error);
      expect(result.type).toBe('transient');
    });

    it('classifies 502 Bad Gateway as transient', () => {
      const error = new Error('502 Bad Gateway');
      const result = classifyError(error);
      expect(result.type).toBe('transient');
    });

    it('classifies 504 Gateway Timeout as transient', () => {
      const error = new Error('504 Gateway Timeout');
      const result = classifyError(error);
      expect(result.type).toBe('transient');
    });

    it('classifies gateway unavailable as transient', () => {
      const error = new Error('Service unavailable. Please try again later.');
      const result = classifyError(error);
      expect(result.type).toBe('transient');
    });

    it('classifies DNS resolution failure as transient', () => {
      const error = new Error('getaddrinfo ENOTFOUND api.example.com');
      const result = classifyError(error);
      expect(result.type).toBe('transient');
    });

    it('classifies socket hang up as transient', () => {
      const error = new Error('socket hang up');
      const result = classifyError(error);
      expect(result.type).toBe('transient');
    });
  });

  // ── Unknown errors ───────────────────────────────────────────────────────

  describe('unknown classification', () => {
    it('classifies malformed response as unknown', () => {
      const error = new Error('Unexpected token < in JSON at position 0');
      const result = classifyError(error);
      expect(result.type).toBe('unknown');
    });

    it('classifies generic unexpected error as unknown', () => {
      const error = new Error('Something went terribly wrong');
      const result = classifyError(error);
      expect(result.type).toBe('unknown');
    });

    it('classifies GraphQL mutation syntax error as unknown', () => {
      const error = new Error(
        'GraphQL error: field "nonexistent" not found in type "oee_events_insert_input"'
      );
      const result = classifyError(error);
      // Does not contain FK/constraint/network keywords → unknown
      expect(result.type).toBe('unknown');
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles undefined input safely', () => {
      const result = classifyError(undefined);
      expect(result.type).toBe('unknown');
      expect(result.message).toContain('Unknown');
    });

    it('handles null input safely', () => {
      const result = classifyError(null);
      expect(result.type).toBe('unknown');
    });

    it('handles string errors', () => {
      const result = classifyError('Network timeout occurred');
      expect(result.type).toBe('transient');
    });

    it('handles plain object with message property', () => {
      const result = classifyError({ message: 'Foreign key violation' });
      expect(result.type).toBe('constraint');
    });

    it('handles circular reference safely', () => {
      const circular: any = {};
      circular.self = circular;
      // Should not throw — classifyError handles JSON.stringify failures
      expect(() => classifyError(circular)).not.toThrow();
    });

    it('handles empty Error object', () => {
      const error = new Error('');
      const result = classifyError(error);
      expect(result.type).toBe('unknown');
    });

    it('case-insensitive matching for constraint keywords', () => {
      const error = new Error('FOREIGN KEY violation on table oee_events');
      const result = classifyError(error);
      expect(result.type).toBe('constraint');
    });

    it('case-insensitive matching for transient keywords', () => {
      const error = new Error('NETWORK ERROR: Connection lost');
      const result = classifyError(error);
      expect(result.type).toBe('transient');
    });
  });

  // ── Priority: constraint beats transient when both keywords present ───────

  describe('priority', () => {
    it('constraint check happens BEFORE transient check', () => {
      // If message has both "constraint" and "network" keywords,
      // constraint should win because we check it first
      const error = new Error(
        'Constraint violation due to network instability'
      );
      const result = classifyError(error);
      expect(result.type).toBe('constraint');
    });
  });
});
