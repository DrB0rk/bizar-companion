/**
 * Singleton WebSocket manager for the Bizar dashboard.
 *
 * v1.2.0-beta.1 — improved over v1.1.0:
 *  - ConnectionState listeners so screens can show "reconnecting…" UI
 *  - Per-event emission of state changes (open, reconnect, close)
 *  - Reconnect stats exposed (attempt count, last error)
 *
 * Uses ?token= query param (not Sec-WebSocket-Protocol) because the RN
 * WebSocket polyfill on Android does not reliably forward custom subprotocols
 * as auth headers. TODO: switch to Sec-WebSocket-Protocol once the dashboard
 * supports it — see DASHBOARD_CHANGES.md §6.
 *
 * Connects when both url+secret are set, disconnects when either clears.
 * Reconnects with exponential backoff capped at 30s.
 */
import type { WsEvent, WsSnapshot } from './types';

let _url: string | null = null;
let _secret: string | null = null;

let _ws: WebSocket | null = null;
let _retries = 0;
let _shouldRun = false;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _pingTimer: ReturnType<typeof setInterval> | null = null;

// Snapshot cached from the last 'snapshot' WS event
let _snapshot: WsSnapshot | null = null;

// ---------------------------------------------------------------------------
// Connection state (v1.2.0 NEW)
// ---------------------------------------------------------------------------

export type WsConnectionState =
  | 'idle' // never connected
  | 'connecting' // first attempt in flight
  | 'connected' // open
  | 'reconnecting' // disconnected, waiting to retry
  | 'failed' // gave up (auth, etc.)
  | 'closed'; // deliberately closed

export type WsState = {
  connection: WsConnectionState;
  attempt: number;
  connectedAt?: number;
  lastError?: string;
  lastEventAt?: number;
};

let _state: WsState = { connection: 'idle', attempt: 0 };
type StateListener = (s: WsState) => void;
const _stateListeners = new Set<StateListener>();

function setState(patch: Partial<WsState>): void {
  _state = { ..._state, ...patch };
  _stateListeners.forEach((h) => h(_state));
}

export function getWsState(): WsState {
  return _state;
}

export function onWsStateChange(handler: StateListener): () => void {
  _stateListeners.add(handler);
  handler(_state); // emit current state immediately
  return () => _stateListeners.delete(handler);
}

// ---------------------------------------------------------------------------
// Subscribers
// ---------------------------------------------------------------------------

type Handler = (msg: WsEvent) => void;
const _subscribers = new Set<Handler>();

function getWsUrl(): string {
  if (!_url || !_secret) throw new Error('WS: url or secret not set');
  return `${_url.replace(/^http/, 'ws').replace(/\/$/, '')}/ws?token=${encodeURIComponent(_secret)}`;
}

function clearTimers(): void {
  if (_reconnectTimer) {
    clearTimeout(_reconnectTimer);
    _reconnectTimer = null;
  }
  if (_pingTimer) {
    clearInterval(_pingTimer);
    _pingTimer = null;
  }
}

function startPing(): void {
  clearTimers();
  // 25s JSON ping as a passive liveness probe.
  // RN WebSocket auto-replies to ws-protocol pings; this is a dashboard-side ping.
  _pingTimer = setInterval(() => {
    if (_ws && _ws.readyState === WebSocket.OPEN) {
      _ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 25_000);
}

function open(): void {
  if (!_shouldRun) return;
  clearTimers();
  const wsUrl = getWsUrl();
  setState({ connection: _retries === 0 ? 'connecting' : 'reconnecting' });
  try {
    _ws = new WebSocket(wsUrl);
  } catch (err) {
    setState({ lastError: err instanceof Error ? err.message : String(err) });
    scheduleReconnect();
    return;
  }
  _ws.onopen = () => {
    _retries = 0;
    setState({ connection: 'connected', attempt: 0, connectedAt: Date.now(), lastError: undefined });
    startPing();
    _subscribers.forEach((h) => h({ type: 'pong' })); // signal open
  };
  _ws.onmessage = (e) => {
    try {
      const raw = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      const msg = raw as WsEvent;
      if (msg.type === 'snapshot') {
        _snapshot = (msg as { type: 'snapshot'; data: { snapshot: WsSnapshot } }).data.snapshot;
      }
      if (msg.type === 'pong') {
        _retries = 0;
      }
      setState({ lastEventAt: Date.now() });
      _subscribers.forEach((h) => h(msg));
    } catch {
      /* ignore parse errors */
    }
  };
  _ws.onclose = (event) => {
    clearTimers();
    setState({
      connection: _shouldRun ? 'reconnecting' : 'closed',
      lastError: event?.code ? `code=${event.code}` : undefined,
    });
    scheduleReconnect();
  };
  _ws.onerror = (event) => {
    setState({ lastError: 'socket error' });
    /* errors are followed by close */
  };
}

function scheduleReconnect(): void {
  if (!_shouldRun) return;
  const delay = Math.min(30_000, 500 * Math.pow(2, _retries));
  _retries += 1;
  setState({ attempt: _retries });
  _reconnectTimer = setTimeout(() => open(), delay);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function wsConnect(url: string, secret: string): void {
  _url = url;
  _secret = secret;
  _shouldRun = true;
  _retries = 0;
  setState({ connection: 'connecting', attempt: 0, lastError: undefined });
  open();
}

export function wsDisconnect(): void {
  _shouldRun = false;
  clearTimers();
  try {
    _ws?.close();
  } catch {
    /* ignore */
  }
  _ws = null;
  _snapshot = null;
  setState({ connection: 'closed' });
}

export function wsSubscribe(handler: Handler): () => void {
  _subscribers.add(handler);
  return () => _subscribers.delete(handler);
}

export function wsGetSnapshot(): WsSnapshot | null {
  return _snapshot;
}
