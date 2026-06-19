/**
 * HTTP + WebSocket client for the Bizar dashboard.
 *
 * The pairing (URL + token) is read from a module-level snapshot updated by
 * RootNav when the PairingProvider loads. Components call `setPairing(...)`
 * once on mount so the API helpers can attach the Bearer header.
 *
 * IMPORTANT: do NOT call `usePairing()` from inside these helpers — hooks
 * only work inside React components, and these helpers may be called from
 * useEffect, event handlers, and async tasks alike.
 */
import type { ApiError as ApiErrorType } from './types';

let _url: string | null = null;
let _token: string | null = null;

export function setPairing(url: string | null, token: string | null): void {
  _url = url;
  _token = token;
}

export function getPairing(): { url: string | null; token: string | null } {
  return { url: _url, token: _token };
}

function authHeaders(): Record<string, string> {
  if (!_token) return {};
  return { Authorization: `Bearer ${_token}` };
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

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
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
    throw new ApiError(res.status, err.error || 'http_error', err.message || `HTTP ${res.status}`);
  }
  // Some endpoints return 204 No Content
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

export const apiGet = <T>(path: string) => request<T>('GET', path);
export const apiPost = <T>(path: string, body?: unknown) => request<T>('POST', path, body);
export const apiPut = <T>(path: string, body?: unknown) => request<T>('PUT', path, body);
export const apiPatch = <T>(path: string, body?: unknown) => request<T>('PATCH', path, body);
export const apiDelete = <T>(path: string) => request<T>('DELETE', path);

/**
 * Lightweight WebSocket wrapper around /ws?token=...
 *
 * The dashboard broadcasts JSON messages of the shape `{ type, ... }`.
 * Reconnects with exponential backoff up to 30s.
 */
export type BizarWsHandlers = {
  onMessage?: (msg: any) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (err: Event) => void;
};

export class BizarWs {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private handlers: BizarWsHandlers;
  private retries = 0;
  private shouldRun = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(url: string, token: string, handlers: BizarWsHandlers = {}) {
    this.url = url.replace(/^http/, 'ws').replace(/\/$/, '');
    this.token = token;
    this.handlers = handlers;
  }

  connect(): void {
    this.shouldRun = true;
    this.open();
  }

  private open(): void {
    if (!this.shouldRun) return;
    const wsUrl = `${this.url}/ws?token=${encodeURIComponent(this.token)}`;
    try {
      this.ws = new WebSocket(wsUrl);
    } catch (err) {
      this.scheduleReconnect();
      return;
    }
    this.ws.onopen = () => {
      this.retries = 0;
      this.handlers.onOpen?.();
    };
    this.ws.onmessage = (e) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        this.handlers.onMessage?.(data);
      } catch {
        /* ignore */
      }
    };
    this.ws.onclose = () => {
      this.handlers.onClose?.();
      this.scheduleReconnect();
    };
    this.ws.onerror = (e) => {
      this.handlers.onError?.(e);
    };
  }

  private scheduleReconnect(): void {
    if (!this.shouldRun) return;
    const delay = Math.min(30000, 500 * Math.pow(2, this.retries));
    this.retries += 1;
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  send(msg: unknown): void {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  disconnect(): void {
    this.shouldRun = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
  }
}