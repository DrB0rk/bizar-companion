/**
 * HTTP client for the Bizar dashboard.
 *
 * v1.2.0-beta.1 — improved over v1.1.0:
 *  - Typed API namespace (api.tasks, api.chat, etc.) for safer call sites
 *  - Retry policy (configurable) for transient network errors
 *  - Network state listener (so screens can show "offline")
 *  - In-flight request tracking (for cancel-on-unmount)
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

// Network state handlers — called whenever a request starts/ends
type NetworkListener = (state: NetworkState) => void;
export type NetworkState = {
  online: boolean;
  inFlight: number;
  lastErrorAt?: number;
  lastErrorKind?: 'network' | 'auth' | 'http' | 'client';
};
const _networkListeners = new Set<NetworkListener>();

let _networkState: NetworkState = { online: true, inFlight: 0 };
function setNetworkState(patch: Partial<NetworkState>): void {
  _networkState = { ..._networkState, ...patch };
  _networkListeners.forEach((h) => h(_networkState));
}

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

export function onNetworkChange(handler: NetworkListener): () => void {
  _networkListeners.add(handler);
  handler(_networkState); // emit current state immediately
  return () => _networkListeners.delete(handler);
}

export function getNetworkState(): NetworkState {
  return _networkState;
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
  kind: 'network' | 'auth' | 'http' | 'client';
  retryable: boolean;
  constructor(
    status: number,
    code: string,
    message: string,
    kind: 'network' | 'auth' | 'http' | 'client' = 'http',
    retryable = false,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.error = code;
    this.kind = kind;
    this.retryable = retryable;
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

type RequestOptions = {
  /** Number of retry attempts on transient failures (default: 1) */
  retries?: number;
  /** Base delay between retries in ms (default: 250) */
  retryDelayMs?: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Don't throw on 4xx — return null instead */
  allowNotFound?: boolean;
};

async function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

async function request<T>(method: string, path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
  const { retries = 1, retryDelayMs = 250, signal, allowNotFound = false } = opts;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...authHeaders(),
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  if (signal) init.signal = signal;

  setNetworkState({ inFlight: _networkState.inFlight + 1, online: true });

  try {
    let lastErr: unknown = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(buildUrl(path), init);
        if (res.status === 404 && allowNotFound) {
          return null as unknown as T;
        }
        if (!res.ok) {
          const err = await parseError(res);
          if (res.status === 401 && err.error === 'unauthorized') {
            _unauthorizedHandlers.forEach((h) => h());
            setNetworkState({ lastErrorAt: Date.now(), lastErrorKind: 'auth' });
            throw new ApiError(401, err.error || 'unauthorized', err.message || 'Unauthorized', 'auth', false);
          }
          if (res.status >= 500) {
            // Server error — retryable
            lastErr = new ApiError(res.status, err.error || 'http_error', err.message || `HTTP ${res.status}`, 'http', true);
          } else {
            // Client error — not retryable
            throw new ApiError(res.status, err.error || 'http_error', err.message || `HTTP ${res.status}`, 'http', false);
          }
        } else {
          if (res.status === 204) return undefined as unknown as T;
          return (await res.json()) as T;
        }
      } catch (err) {
        if (err instanceof ApiError && !err.retryable) throw err;
        if (err instanceof DOMException && err.name === 'AbortError') throw err;
        lastErr = err;
        if (attempt < retries) {
          await delay(retryDelayMs * Math.pow(2, attempt), signal);
          continue;
        }
      }
    }
    // All retries exhausted
    setNetworkState({ lastErrorAt: Date.now(), lastErrorKind: 'network' });
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  } finally {
    setNetworkState({ inFlight: Math.max(0, _networkState.inFlight - 1) });
  }
}

export const apiGet = <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, undefined, opts);
export const apiPost = <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('POST', path, body, opts);
export const apiPut = <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('PUT', path, body, opts);
export const apiPatch = <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('PATCH', path, body, opts);
export const apiDelete = <T>(path: string, opts?: RequestOptions) => request<T>('DELETE', path, undefined, opts);

// ---------------------------------------------------------------------------
// Typed API namespace (v1.2.0 NEW)
// ---------------------------------------------------------------------------
//
// Prefer these over `apiGet('/api/foo')` for new code — they:
//   - Encode the response type at the call site
//   - Centralize endpoint paths so a dashboard rename touches one file
//   - Set sane retry defaults (e.g. background list allows 2 retries)
//   - Allow callers to pass an AbortSignal for cancellation
//
// Existing screens continue to use the untyped helpers during migration.
// ---------------------------------------------------------------------------

import type {
  ActivityListResponse,
  AgentListResponse,
  ArtifactListResponse,
  BackgroundDetailResponse,
  BackgroundListResponse,
  ChatListResponse,
  MemoryListResponse,
  MemorySearchResponse,
  MemoryStatus,
  NotificationListResponse,
  Overview,
  PairVerifyResponse,
  Plan,
  ProjectListResponse,
  Task,
  VoiceListResponse,
} from './types';

export const api = {
  /** GET /api/overview — high-level dashboard health snapshot */
  overview: (opts?: RequestOptions) => apiGet<Overview>('/api/overview', opts),

  /** GET /api/auth/status — unauthenticated reachability check */
  authStatus: (opts?: RequestOptions) =>
    apiGet<{ required: boolean; loopback: boolean; peer: string }>('/api/auth/status', opts),

  /** POST /api/pair/verify — confirm a pair token is valid */
  pairVerify: (url: string, token: string, opts?: RequestOptions) =>
    fetch(`${url.replace(/\/$/, '')}/api/pair/verify`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal: opts?.signal,
    }).then(async (res) => {
      if (!res.ok) throw new ApiError(res.status, 'http_error', `HTTP ${res.status}`, 'http', false);
      return (await res.json()) as PairVerifyResponse;
    }),

  tasks: {
    list: (opts?: RequestOptions) => apiGet<Task[] | { tasks?: Task[] }>('/api/tasks', opts),
    get: (id: string, opts?: RequestOptions) => apiGet<Task>(`/api/tasks/${id}`, opts),
    start: (id: string, opts?: RequestOptions) => apiPost<void>(`/api/tasks/${id}/start`, undefined, opts),
    setStatus: (id: string, status: string, opts?: RequestOptions) =>
      apiPatch<void>(`/api/tasks/${id}/status`, { status }, opts),
    archive: (id: string, opts?: RequestOptions) => apiPost<void>(`/api/tasks/${id}/archive`, undefined, opts),
    progress: (id: string, progress: number, step?: string, opts?: RequestOptions) =>
      apiPost<void>(`/api/tasks/${id}/progress`, { progress, step }, opts),
  },

  projects: {
    list: (opts?: RequestOptions) => apiGet<ProjectListResponse>('/api/projects', opts),
    activate: (id: string, opts?: RequestOptions) =>
      apiPost<void>(`/api/projects/${id}/activate`, undefined, opts),
  },

  chat: {
    list: (opts?: RequestOptions) => apiGet<ChatListResponse>('/api/chat', opts),
    sessions: (opts?: RequestOptions) => apiGet<ChatListResponse>('/api/chat/sessions', opts),
    send: (message: string, opts?: RequestOptions) =>
      apiPost<{ id: string; file: string; mtime: number; size: number }>(
        '/api/chat',
        { message },
        opts,
      ),
    regenerate: (opts?: RequestOptions) => apiPost<void>('/api/chat/regenerate', undefined, opts),
  },

  agents: {
    list: (opts?: RequestOptions) => apiGet<AgentListResponse>('/api/agents', opts),
    stuck: (opts?: RequestOptions) => apiGet<AgentListResponse>('/api/agents/stuck', opts),
    hierarchy: (opts?: RequestOptions) => apiGet<AgentListResponse>('/api/agents/hierarchy', opts),
    get: (name: string, opts?: RequestOptions) => apiGet<AgentListResponse['agents'][number]>(`/api/agents/${name}`, opts),
  },

  background: {
    list: (opts?: RequestOptions) => apiGet<BackgroundListResponse>('/api/background', { retries: 2, ...opts }),
    get: (id: string, opts?: RequestOptions) =>
      apiGet<BackgroundDetailResponse>(`/api/background/${id}`, opts),
    output: (id: string, opts?: RequestOptions) =>
      apiGet<string>(`/api/background/${id}/output`, opts),
    pause: (id: string, opts?: RequestOptions) =>
      apiPost<void>(`/api/background/${id}/pause`, undefined, opts),
    resume: (id: string, opts?: RequestOptions) =>
      apiPost<void>(`/api/background/${id}/resume`, undefined, opts),
    steer: (id: string, message: string, opts?: RequestOptions) =>
      apiPost<void>(`/api/background/${id}/steer`, { message }, opts),
    kill: (id: string, opts?: RequestOptions) =>
      apiPost<void>(`/api/background/${id}/kill`, undefined, opts),
  },

  notifications: {
    list: (opts?: RequestOptions) => apiGet<NotificationListResponse>('/api/notifications', opts),
    unread: (opts?: RequestOptions) => apiGet<NotificationListResponse>('/api/notifications?unread=true', opts),
    markRead: (id: string, opts?: RequestOptions) =>
      apiPost<void>(`/api/notifications/${id}/read`, undefined, opts),
    markAllRead: (opts?: RequestOptions) =>
      apiPost<{ ok: true; marked: number }>('/api/notifications/read-all', undefined, opts),
    dismiss: (id: string, opts?: RequestOptions) =>
      apiDelete<void>(`/api/notifications/${id}`, opts),
  },

  artifacts: {
    list: (opts?: RequestOptions) => apiGet<ArtifactListResponse>('/api/artifacts', opts),
    get: (slug: string, opts?: RequestOptions) => apiGet<{ artifact: unknown }>(`/api/artifacts/${slug}`, opts),
    render: (slug: string, opts?: RequestOptions) =>
      apiGet<string>(`/api/artifacts/${slug}/render`, opts),
  },

  voice: {
    list: (opts?: RequestOptions) => apiGet<VoiceListResponse>('/api/voice/list', opts),
    get: (id: string, opts?: RequestOptions) =>
      apiGet<VoiceListResponse['notes'][number]>(`/api/voice/${id}`, opts),
    upload: (audioBase64: string, meta?: Record<string, unknown>, opts?: RequestOptions) =>
      apiPost<{ ok: true; id: string }>('/api/voice/upload', { audio: audioBase64, meta }, opts),
  },

  memory: {
    status: (opts?: RequestOptions) => apiGet<MemoryStatus>('/api/memory/status', opts),
    notes: (opts?: RequestOptions) => apiGet<MemoryListResponse>('/api/memory/notes', opts),
    search: (q: string, opts?: RequestOptions) =>
      apiGet<MemorySearchResponse>(`/api/memory/search?q=${encodeURIComponent(q)}`, opts),
  },

  plans: {
    list: (opts?: RequestOptions) => apiGet<Plan[]>('/api/plans', opts),
  },

  activity: {
    list: (opts?: RequestOptions) => apiGet<ActivityListResponse>('/api/activity', opts),
  },
};
