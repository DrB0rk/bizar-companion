/**
 * Shared mock helpers for api tests.
 *
 * The mockResponse helper supports two calling conventions:
 *   mockResponse(body)          → returns 200 with body
 *   mockResponse(status, body)  → returns status with body (legacy)
 *
 * The api-namespace tests use the single-arg form; the api/client tests use
 * the two-arg form. Both must work.
 */

export const mockResponse = (statusOrBody: number | unknown, maybeBody?: unknown): Response => {
  // Single-arg: body
  if (typeof statusOrBody !== 'number') {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => statusOrBody,
      text: async () => JSON.stringify(statusOrBody),
    } as Response;
  }
  // Two-arg: status + body
  const status = statusOrBody;
  const body = maybeBody;
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `HTTP ${status}`,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body ?? {},
    text: async () => JSON.stringify(body ?? {}),
  } as Response;
};

export const mockStatus = (status: number): Response => {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `HTTP ${status}`,
    headers: new Headers(),
    json: async () => ({}),
    text: async () => '',
  } as Response;
};

// Alias for backward compat with existing tests
export const mockJson = (body: unknown): Response => mockResponse(body);
