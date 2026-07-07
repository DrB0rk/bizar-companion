/**
 * Tests for src/api/client.ts — exercises the request() error-handling,
 * retry policy, and network state plumbing without making real HTTP calls.
 *
 * Strategy: mock global.fetch with vi.fn() per test.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  setPairing,
  apiGet,
  apiPost,
  apiDelete,
  onUnauthorized,
  onNetworkChange,
  ApiError,
  getNetworkState,
} from '../client';
import { mockResponse, mockStatus } from './__helpers__/mockResponse.js';



describe('api/client', () => {
  beforeEach(() => {
    setPairing('https://example.test', 'secret-token');
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('attaches Bearer header from setPairing()', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse(200, { ok: true }),
    );

    await apiGet('/api/test');
    const [, init] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer secret-token');
    expect(init.headers.Accept).toBe('application/json');
  });

  it('returns JSON body on success', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse(200, { items: [1, 2, 3] }),
    );

    const r = await apiGet<{ items: number[] }>('/api/items');
    expect(r.items).toEqual([1, 2, 3]);
  });

  it('returns null for 404 with allowNotFound: true', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse(404, { error: 'not_found' }),
    );

    const r = await apiGet<unknown>('/api/maybe', { allowNotFound: true });
    expect(r).toBeNull();
  });

  it('throws ApiError on 4xx', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse(404, { error: 'not_found', message: 'gone' }),
    );

    await expect(apiGet('/api/missing')).rejects.toBeInstanceOf(ApiError);
  });

  it('invokes onUnauthorized handler on 401 unauthorized', async () => {
    const handler = vi.fn();
    const unsub = onUnauthorized(handler);
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse(401, { error: 'unauthorized' }),
    );

    await expect(apiGet('/api/secret')).rejects.toThrow();
    expect(handler).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('does NOT retry on 4xx', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse(400, { error: 'bad_request' }),
    );

    await expect(apiGet('/api/x', { retries: 2 })).rejects.toThrow();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('DOES retry on 5xx', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockResponse(500, { error: 'oops' }))
      .mockResolvedValueOnce(mockResponse(500, { error: 'oops' }))
      .mockResolvedValueOnce(mockResponse(200, { ok: true }));

    const r = await apiGet<{ ok: boolean }>('/api/x', { retries: 3 });
    expect(r.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('throws after exhausting retries on 5xx', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockResponse(500, { error: 'oops' }),
    );

    await expect(apiGet('/api/x', { retries: 2 })).rejects.toThrow();
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('retries on network errors and emits network state', async () => {
    const states: unknown[] = [];
    const unsub = onNetworkChange((s) => states.push({ ...s }));

    (global.fetch as unknown as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(mockResponse(200, { ok: true }));

    const r = await apiGet<{ ok: boolean }>('/api/x', { retries: 2 });
    expect(r.ok).toBe(true);

    // First call → inFlight:1, second call → inFlight:1 again (since we reset
    // back to 0 before the retry), then 0.
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(getNetworkState().inFlight).toBe(0);
    unsub();
  });

  it('sends JSON body for POST', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse(200, { ok: true }),
    );

    await apiPost('/api/chat', { message: 'hello' });
    const [url, init] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://example.test/api/chat');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ message: 'hello' }));
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('returns undefined on 204 No Content', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse(204),
    );

    const r = await apiPost('/api/x', undefined);
    expect(r).toBeUndefined();
  });

  it('throws when setPairing() was not called', async () => {
    setPairing(null, null);
    await expect(apiGet('/api/test')).rejects.toThrow(/Not paired/);
    // Restore for other tests
    setPairing('https://example.test', 'secret-token');
  });


  it('returns undefined for 204 endpoints with void type', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse(204),
    );
    // Use apiDelete with void return type
    const r = await apiDelete<void>('/api/test');
    expect(r).toBeUndefined();
  });

  it('ApiError has correct fields', () => {
    const err = new ApiError(503, 'http_error', 'Service Unavailable', 'http', true);
    expect(err.status).toBe(503);
    expect(err.code).toBe('http_error');
    expect(err.error).toBe('http_error');
    expect(err.kind).toBe('http');
    expect(err.retryable).toBe(true);
    expect(err.message).toBe('Service Unavailable');
  });
});
