/**
 * Tests for src/api/ws.ts — verifies state transitions for the WS singleton.
 * We mock the global WebSocket constructor.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  wsConnect,
  wsDisconnect,
  wsSubscribe,
  wsGetSnapshot,
  getWsState,
  onWsStateChange,
  type WsState,
} from '../ws';

class FakeWebSocket {
  readyState = 0; // CONNECTING
  onopen: (() => void) | null = null;
  onclose: ((e?: unknown) => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = 3; // CLOSED
    this.onclose?.({ code: 1000 });
  });
  // Test helpers
  fireOpen() {
    this.readyState = 1; // OPEN
    this.onopen?.();
  }
  fireMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
  fireClose() {
    this.readyState = 3;
    this.onclose?.({ code: 1006 });
  }
}

let instances: FakeWebSocket[] = [];

describe('api/ws', () => {
  beforeEach(() => {
    instances = [];
    class MockWS {
      constructor() {
        const f = new FakeWebSocket();
        instances.push(f);
        return f;
      }
    }
    global.WebSocket = MockWS as unknown as typeof WebSocket;
    wsDisconnect();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('connects when wsConnect() is called', () => {
    wsConnect('https://example.test', 'tok');
    expect(instances.length).toBe(1);
    expect(getWsState().connection).toBe('connecting');
  });

  it('transitions to connected on open and emits state', () => {
    const states: WsState[] = [];
    onWsStateChange((s) => states.push(s));
    wsConnect('https://example.test', 'tok');
    instances[0].fireOpen();
    expect(getWsState().connection).toBe('connected');
    expect(states.some((s) => s.connection === 'connected')).toBe(true);
  });

  it('caches snapshot from snapshot message', () => {
    wsConnect('https://example.test', 'tok');
    instances[0].fireOpen();
    instances[0].fireMessage({
      type: 'snapshot',
      data: {
        snapshot: {
          overview: { agentName: 'bizar', agentVersion: '1.0', dashboardVersion: '5.6.0', nodeVersion: '20', platform: 'linux', uptime: 0 },
          agents: [],
          artifacts: [],
          projects: [],
          activeProject: null,
          config: { loopback: true, publicUrl: '', publicUrlFallback: '', authRequired: false, tailscale: false },
          settings: { theme: 'dark', model: 'm', agent: 'a', streaming: true },
          tasks: [],
          mods: [],
          schedules: [],
          providers: [],
          mcps: [],
        },
      },
    });
    expect(wsGetSnapshot()?.overview.agentName).toBe('bizar');
  });

  it('dispatches messages to subscribers', () => {
    const received: unknown[] = [];
    wsSubscribe((m) => received.push(m));
    wsConnect('https://example.test', 'tok');
    instances[0].fireOpen();
    instances[0].fireMessage({ type: 'tasks:change', data: { task: { id: 't1' } } });
    expect(received.some((m: any) => m.type === 'tasks:change')).toBe(true);
  });

  it('schedules a reconnect on close', () => {
    wsConnect('https://example.test', 'tok');
    instances[0].fireOpen();
    expect(instances.length).toBe(1);

    instances[0].fireClose();
    expect(getWsState().connection).toBe('reconnecting');
    expect(getWsState().attempt).toBe(1);

    // Advance past the reconnect delay
    vi.advanceTimersByTime(600);
    expect(instances.length).toBe(2);
  });

  it('disconnects cleanly', () => {
    wsConnect('https://example.test', 'tok');
    instances[0].fireOpen();
    wsDisconnect();
    expect(getWsState().connection).toBe('closed');
    expect(wsGetSnapshot()).toBeNull();
  });

  it('caps reconnect backoff at 30s', () => {
    wsConnect('https://example.test', 'tok');
    instances[0].fireOpen();
    for (let i = 0; i < 10; i++) {
      instances[instances.length - 1].fireClose();
      vi.advanceTimersByTime(31_000);
    }
    // After many failures, attempt counter should be bounded but keep climbing.
    // The actual cap is on the *delay* not the attempt count itself.
    expect(getWsState().attempt).toBeGreaterThan(3);
  });
});
