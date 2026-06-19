/**
 * Shared API response types for the Bizar Companion app.
 * These mirror the dashboard's REST surface — kept loose on purpose so a
 * mismatch in one field doesn't crash the UI.
 */

export type Project = {
  id: string;
  name: string;
  path: string;
  active?: boolean;
  createdAt?: string;
};

export type Task = {
  id: string;
  title: string;
  status?: string;
  priority?: string;
  projectId?: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
};

export type Agent = {
  name: string;
  model?: string;
  description?: string;
  status?: string;
};

export type ChatMessage = {
  id?: string;
  role: 'user' | 'assistant' | 'system' | string;
  content: string;
  ts?: string;
  sessionId?: string;
};

export type Activity = {
  id?: string;
  kind?: string;
  message?: string;
  ts?: string;
  level?: string;
};

export type Plan = {
  slug: string;
  title?: string;
  status?: string;
  updatedAt?: string;
};

export type PairVerifyResponse = { valid: boolean };
export type PairStartResponse = {
  token: string;
  qrPayload: string;
  publicUrl: string;
  expiresAt: number;
};

export type ApiError = { error: string; message?: string };