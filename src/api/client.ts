/**
 * HTTP client for the Bizar dashboard.
 *
 * The pairing (url + secret) is kept in a module-level snapshot updated by
 * RootNav when the PairingProvider value changes. Components call
 * `setPairing(url, secret)` once on mount so the API helpers can attach the
 * Bearer header.
 *
 * IMPORTANT: do NOT call `usePairing()` from inside these helpers — hooks
 * only work inside React components, and these helpers may be called from
 * useEffect, event handlers, and async tasks alike.
 */
import type { ApiError as ApiErrorType } from './types';

let _url: string | null = null;
let _secret: string | null = null;

// Unauthorized handlers — called when any request receives a 401 with error === 'unauthorized'
type UnauthorizedHandler = () => void;
const _unauthorizedHandlers = new Set<UnauthorizedHandler>();

export function setPairing(url: string | null, secret: string | null): void {
  _url = url;
  _secret = secret;
}

export function getPairing(): { url: string | null; secret: string | null } {
  return { url: _url, secret: _secret };
}

export function onUnauthorized(handler: UnauthorizedHandler): () => void {
  _unauthorizedHandlers.add(handler);
  return () => _unauthorizedHandlers.delete(handler);
}

function authHeaders(): Record<string, string> {
  if (!_secret) return {};
  return { Authorization: `Bearer ${_secret}` };
}

function buildUrl(path: string): string {
  if (!_url) throw new Error('Not paired: call setPairing() first');
  return `${_url.replace(/\/$/, '')}${path}`;
}

export class ApiError extends Error {
  status: number;
  code: string;
  error: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.error = code;
    this.name = 'ApiError';
  }
}

async function parseError(res: Response): Promise<ApiErrorType> {
  try {
    const data = (await res.json()) as ApiError;
    return data;
  } catch {
    return { error: 'http_error', message: `${res.status} ${res.statusText}` };
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...authHeaders(),
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);

  const res = await fetch(buildUrl(path), init);

  if (!res.ok) {
    const err = await parseError(res);
    if (res.status === 401 && err.error === 'unauthorized') {
      _unauthorizedHandlers.forEach((h) => h());
    }
    throw new ApiError(res.status, err.error || 'http_error', err.message || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

export const apiGet = <T>(path: string) => request<T>('GET', path);
export const apiPost = <T>(path: string, body?: unknown) => request<T>('POST', path, body);
export const apiPut = <T>(path: string, body?: unknown) => request<T>('PUT', path, body);
export const apiPatch = <T>(path: string, body?: unknown) => request<T>('PATCH', path, body);
export const apiDelete = <T>(path: string) => request<T>('DELETE', path);
