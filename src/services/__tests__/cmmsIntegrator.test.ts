/**
 * cmmsIntegrator Unit Tests
 *
 * Tests for the oee-trigger HTTP client:
 * - Success: POST returns 200 with workOrderId
 * - 401 Unauthorized
 * - 500 Server Error
 * - Network failure (fetch throws)
 */

import { triggerCorrectiveOT } from '../cmmsIntegrator';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  jest.resetAllMocks();
});

describe('triggerCorrectiveOT', () => {
  const validPayload = {
    equipment_id: 'MC-001',
    sintoma: 'FC - Falla de Cavemil - Línea 3',
  };

  it('returns success with workOrderId on 200', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({ id: 'wo-uuid-123' }),
    });

    const result = await triggerCorrectiveOT(validPayload);

    expect(result.success).toBe(true);
    expect(result.workOrderId).toBe('wo-uuid-123');
    expect(result.error).toBeUndefined();
  });

  it('returns success with workOrderId on 201 (created)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      statusText: 'Created',
      json: () => Promise.resolve({ id: 'wo-uuid-456' }),
    });

    const result = await triggerCorrectiveOT(validPayload);

    expect(result.success).toBe(true);
    expect(result.workOrderId).toBe('wo-uuid-456');
  });

  it('returns success without workOrderId if response body has no id', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({}),
    });

    const result = await triggerCorrectiveOT(validPayload);

    expect(result.success).toBe(true);
    expect(result.workOrderId).toBeUndefined();
  });

  it('sends POST request to oee-trigger URL with correct headers and body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({ id: 'wo-uuid' }),
    });

    await triggerCorrectiveOT(validPayload);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];

    // Verify it hits the oee-trigger endpoint
    expect(url).toContain('/functions/v1/oee-trigger');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers['Authorization']).toMatch(/^Bearer\s/);
    expect(options.body).toBe(JSON.stringify(validPayload));
  });

  it('returns error on 401 Unauthorized', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({ error: 'Invalid secret key' }),
    });

    const result = await triggerCorrectiveOT(validPayload);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid secret key');
    expect(result.workOrderId).toBeUndefined();
  });

  it('returns error on 500 Server Error with message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({ error: 'Database connection failed' }),
    });

    const result = await triggerCorrectiveOT(validPayload);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Database connection failed');
  });

  it('returns fallback error for 500 without message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.reject(new Error('Invalid JSON')),
    });

    const result = await triggerCorrectiveOT(validPayload);

    expect(result.success).toBe(false);
    expect(result.error).toBe('HTTP 500: Internal Server Error');
  });

  it('returns error on network failure (fetch throws)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network request failed'));

    const result = await triggerCorrectiveOT(validPayload);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network request failed');
  });

  it('returns fallback error on non-Error rejection', async () => {
    mockFetch.mockRejectedValueOnce('String rejection');

    const result = await triggerCorrectiveOT(validPayload);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Error de conexión con el servicio de mantenimiento');
  });
});
