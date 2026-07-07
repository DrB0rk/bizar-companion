/**
 * Tests for the typed api namespace (src/api/client.ts:api.*).
 *
 * Verifies that the right HTTP verb + path is used and that the response is
 * propagated. We mock global.fetch.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setPairing, api } from '../client';

const mockJson = (body: unknown): Response => {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
};

describe('api namespace', () => {
  beforeEach(() => {
    setPairing('https://api.test', 'tok');
    global.fetch = vi.fn().mockResolvedValue(mockJson({}));
  });

  it('api.tasks.list → GET /api/tasks', async () => {
    await api.tasks.list();
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.test/api/tasks');
    expect(init.method).toBe('GET');
  });

  it('api.tasks.start → POST /api/tasks/:id/start', async () => {
    await api.tasks.start('t1');
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.test/api/tasks/t1/start');
    expect(init.method).toBe('POST');
  });

  it('api.tasks.setStatus → PATCH /api/tasks/:id/status with body', async () => {
    await api.tasks.setStatus('t1', 'doing');
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.test/api/tasks/t1/status');
    expect(init.method).toBe('PATCH');
    expect(init.body).toBe(JSON.stringify({ status: 'doing' }));
  });

  it('api.tasks.progress → POST with progress + step', async () => {
    await api.tasks.progress('t1', 75, 'halfway');
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.test/api/tasks/t1/progress');
    expect(JSON.parse(init.body)).toEqual({ progress: 75, step: 'halfway' });
  });

  it('api.projects.activate → POST /api/projects/:id/activate', async () => {
    await api.projects.activate('p1');
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.test/api/projects/p1/activate');
    expect(init.method).toBe('POST');
  });

  it('api.chat.send → POST /api/chat with message', async () => {
    await api.chat.send('hello');
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.test/api/chat');
    expect(JSON.parse(init.body)).toEqual({ message: 'hello' });
  });

  it('api.notifications.unread → GET with ?unread=true', async () => {
    await api.notifications.unread();
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.test/api/notifications?unread=true');
  });

  it('api.notifications.dismiss → DELETE', async () => {
    await api.notifications.dismiss('n1');
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.test/api/notifications/n1');
    expect(init.method).toBe('DELETE');
  });

  it('api.background.steer → POST with message', async () => {
    await api.background.steer('bg1', 'redirect now');
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.test/api/background/bg1/steer');
    expect(JSON.parse(init.body)).toEqual({ message: 'redirect now' });
  });

  it('api.memory.search → GET with q param', async () => {
    await api.memory.search('graph query');
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.test/api/memory/search?q=graph%20query');
  });

  it('api.voice.upload → POST with audio base64', async () => {
    await api.voice.upload('base64data', { source: 'mobile' });
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.test/api/voice/upload');
    expect(JSON.parse(init.body)).toEqual({
      audio: 'base64data',
      meta: { source: 'mobile' },
    });
  });
});
