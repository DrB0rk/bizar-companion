/**
 * Shared API response types for the Bizar Companion app.
 *
 * v1.2.0-beta.1 — mirrors the dashboard v5.6.0 REST + WebSocket surface.
 * Types are kept in sync with:
 *   - BizarHarness/bizar-dash/src/server/routes/*.mjs
 *   - BizarHarness/bizar-dash/src/server/api.mjs (WebSocket broadcaster)
 *
 * New in v1.2.0:
 *   - Notification types (per-user notification stream)
 *   - BackgroundAgent types (bg-spawn / bg-status / bg-collect)
 *   - Artifact types (artifact browser)
 *   - VoiceNote types (voice upload / transcribe / list)
 *   - MemoryNote types (memory vault read/search)
 *   - Plan types (plan canvas summary)
 *
 * The dashboard minimum is 5.6.0 — enforced at startup via
 * expo.extra.bizar.minSupportedDashboardVersion.
 */

// ---------------------------------------------------------------------------
// Task
// ---------------------------------------------------------------------------

export type TaskStatus = 'backlog' | 'queued' | 'doing' | 'done' | 'blocked' | 'archived';

export type TaskMetadata = {
  progress?: number;
  currentStep?: string;
  bgInstanceId?: string;
  sessionId?: string;
  agent?: string;
  artifactIds?: string[];
  [k: string]: unknown;
};

export type Task = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority?: string;
  projectId?: string;
  assignee?: string | null;
  parent?: string | null;
  dependencies?: string[];
  timeSpent?: number; // milliseconds
  comments?: unknown[];
  activity?: Activity[];
  archived?: boolean;
  workedBy?: string[];
  dueDate?: string | null;
  subtasks?: Task[];
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  metadata?: TaskMetadata;
};

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export type ActivityKind =
  | 'agent.invoke'
  | 'pair.start'
  | 'settings.update'
  | 'project.add'
  | 'project.activate'
  | 'project.auto-detect'
  | 'project.scan'
  | 'chat.message'
  | 'chat.session.create'
  | 'chat.regenerate'
  | 'chat.response'
  | 'task.delegated'
  | 'task.completed'
  | 'task.failed'
  | 'task.started'
  | 'agent.status'
  | 'notification.new'
  | string;

export type Activity = {
  kind: ActivityKind;
  ts: string;
  message?: string;
  agent?: string;
  [k: string]: unknown;
};

export type ActivityListResponse = {
  items: Activity[];
  total: number;
};

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export type ChatMessage = {
  id?: string;
  role: 'user' | 'assistant' | 'system' | string;
  content: string;
  ts?: string;
  agent?: string | null;
  model?: string | null;
  opencodeSessionId?: string;
  inReplyTo?: string;
};

export type ChatSession = {
  id: string;
  file: string;
  mtime: number;
  size: number;
};

export type ChatListResponse = {
  messages: ChatMessage[];
  sessions: ChatSession[];
};

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export type AgentStatus = 'idle' | 'working' | 'error' | 'stuck';

export type Agent = {
  name: string;
  description?: string;
  model?: string;
  mode?: string;
  color?: string;
  tools?: string[];
  tags?: string[];
  category?: string;
  permissions?: unknown;
  prompt?: string;
  status: AgentStatus;
  currentTaskId?: string | null;
  lastSeen?: string;
  heartbeat?: string;
  isStuck?: boolean;
  level?: number;
  parent?: string | null;
  role?: string;
};

export type AgentListResponse = {
  agents: Agent[];
};

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export type ProjectStatus = 'active' | 'inactive' | 'error';

export type Project = {
  id: string;
  name: string;
  path: string;
  lastAccessed?: string;
  status: ProjectStatus;
  summary?: string;
};

export type ProjectListResponse = {
  projects: Project[];
  active: string | null;
};

// ---------------------------------------------------------------------------
// Pairing
// ---------------------------------------------------------------------------

export type PairVerifyResponse = {
  valid: true;
  publicUrl: string;
  expiresAt: number;
};

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export type AuthStatus = {
  required: boolean;
  loopback: boolean;
  peer: string;
};

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export type PlanSource = 'worktree' | 'global';

export type Plan = {
  slug: string;
  title?: string;
  status?: string;
  source: PlanSource;
  elementCount?: number;
  commentCount?: number;
  mtime: number;
  planUrl?: string;
};

// ---------------------------------------------------------------------------
// Notifications — v1.2.0 NEW
// ---------------------------------------------------------------------------

export type NotificationKind =
  | 'task.completed'
  | 'task.failed'
  | 'agent.stuck'
  | 'agent.error'
  | 'chat.response'
  | 'chat.delta'
  | 'plan.feedback'
  | string;

export type Notification = {
  id: string;
  ts: number; // unix ms
  kind: NotificationKind;
  message: string;
  source?: string;
  read?: boolean;
  taskId?: string;
  sessionId?: string;
  agent?: string;
  meta?: Record<string, unknown>;
};

export type NotificationListResponse = {
  notifications: Notification[];
  stats: {
    total: number;
    unread: number;
  };
};

// ---------------------------------------------------------------------------
// Background agents — v1.2.0 NEW
// ---------------------------------------------------------------------------

export type BgStatus = 'pending' | 'running' | 'done' | 'failed' | 'killed' | 'timed_out';

export type BackgroundAgent = {
  id: string;
  agent: string;
  status: BgStatus;
  startedAt: number;
  completedAt?: number;
  toolCallCount: number;
  promptPreview: string;
  resultPreview?: string;
  error?: string;
  parentAgent?: string;
  parentInstanceId?: string;
  taskId?: string;
  durationMs?: number;
};

export type BackgroundListResponse = {
  instances: BackgroundAgent[];
};

export type BackgroundDetailResponse = BackgroundAgent & {
  output?: string;
  toolCalls?: Array<{
    ts: number;
    name: string;
    args?: unknown;
    result?: unknown;
    durationMs?: number;
  }>;
};

// ---------------------------------------------------------------------------
// Artifacts — v1.2.0 NEW
// ---------------------------------------------------------------------------

export type ArtifactKind = 'plan' | 'doc' | 'code' | 'canvas' | 'report' | string;

export type Artifact = {
  id: string;
  slug: string;
  title?: string;
  kind: ArtifactKind;
  status?: string;
  size?: number;
  mtime: number;
  url?: string;
  renderUrl?: string;
  canvasUrl?: string;
  elementCount?: number;
  commentCount?: number;
};

export type ArtifactListResponse = {
  artifacts: Artifact[];
};

// ---------------------------------------------------------------------------
// Voice — v1.2.0 NEW
// ---------------------------------------------------------------------------

export type VoiceNote = {
  id: string;
  ts: number;
  durationMs: number;
  size: number;
  transcript?: string;
  transcriptStatus: 'pending' | 'processing' | 'done' | 'failed';
  agent?: string;
  meta?: Record<string, unknown>;
};

export type VoiceListResponse = {
  notes: VoiceNote[];
};

export type VoiceUploadResponse = {
  id: string;
  ok: true;
};

// ---------------------------------------------------------------------------
// Memory — v1.2.0 NEW
// ---------------------------------------------------------------------------

export type MemoryStatus = {
  mode: 'local' | 'git' | 'remote' | 'lightrag' | string;
  vault?: string;
  configured: boolean;
  notes?: number;
  vaultPath?: string;
};

export type MemoryNote = {
  id: string;
  path: string;
  title?: string;
  tags?: string[];
  preview?: string;
  mtime: number;
  size?: number;
};

export type MemoryListResponse = {
  notes: MemoryNote[];
};

export type MemorySearchResult = {
  path: string;
  snippet: string;
  score: number;
  title?: string;
};

export type MemorySearchResponse = {
  results: MemorySearchResult[];
  query: string;
  total: number;
};

// ---------------------------------------------------------------------------
// Overview / Dashboard health — v1.2.0 NEW
// ---------------------------------------------------------------------------

export type Overview = {
  agentName: string;
  agentVersion: string;
  dashboardVersion: string;
  nodeVersion: string;
  platform: string;
  uptime: number;
  activeProject?: string | null;
  pendingTasks?: number;
  runningAgents?: number;
  stuckAgents?: number;
  notifications?: { total: number; unread: number };
  background?: { total: number; running: number };
};

// ---------------------------------------------------------------------------
// WebSocket
// ---------------------------------------------------------------------------

export type WsOverview = {
  agentName: string;
  agentVersion: string;
  dashboardVersion: string;
  nodeVersion: string;
  platform: string;
  uptime: number;
};

export type WsSnapshotConfig = {
  loopback: boolean;
  publicUrl: string;
  publicUrlFallback: string;
  authRequired: boolean;
  tailscale: boolean;
  tailscalePeerIp?: string;
};

export type WsSnapshotSettings = {
  theme: string;
  model: string;
  agent: string;
  streaming: boolean;
};

export type WsSnapshot = {
  overview: WsOverview;
  agents: Agent[];
  artifacts: unknown[];
  projects: Project[];
  activeProject: string | null;
  config: WsSnapshotConfig;
  settings: WsSnapshotSettings;
  tasks: Task[];
  mods: unknown[];
  schedules: unknown[];
  providers: unknown[];
  mcps: unknown[];
};

// ---------------------------------------------------------------------------
// WebSocket Events — discriminated union
// ---------------------------------------------------------------------------

export type WsEvent =
  | { type: 'snapshot'; data: { snapshot: WsSnapshot } }
  | { type: 'pong' }
  | { type: 'tasks:change'; data: { task: Task } }
  | { type: 'tasks:delete'; data: { id: string } }
  | { type: 'task:progress'; data: { id: string; progress: number; step?: string } }
  | { type: 'task:started'; data: { id: string; agent?: string } }
  | { type: 'task:completed'; data: { id: string; resultPreview?: string } }
  | { type: 'task:failed'; data: { id: string; error: string } }
  | { type: 'agents:change'; data: { agents: Agent[] } }
  | { type: 'agent:status'; data: { name: string; status: AgentStatus } }
  | { type: 'agent:restarted'; data: { name: string } }
  | { type: 'project:change'; data: { projects: Project[]; active: string | null } }
  | { type: 'chat:message'; data: { sessionId: string; message: ChatMessage } }
  | { type: 'chat:delta'; data: { sessionId: string; messageId: string; delta: string } }
  | { type: 'chat:error'; data: { sessionId: string; error: string } }
  | { type: 'chat:session:create'; data: { session: ChatSession } }
  | { type: 'chat:regenerate'; data: { sessionId: string } }
  | { type: 'pair:change'; data: Record<string, unknown> }
  | { type: 'notification:new'; data: { id: string; message: string; kind?: string } }
  | { type: 'notifications:change'; data: Record<string, unknown> }
  | { type: 'background:change'; data: { instance: BackgroundAgent } }
  | { type: 'background:status'; data: { id: string; status: BgStatus; resultPreview?: string; error?: string } }
  | { type: 'artifact:new'; data: { id: string; name: string; url: string } }
  | { type: 'settings:change'; data: { settings: Partial<WsSnapshotSettings> } }
  | { type: 'change'; data: Record<string, unknown> }
  | { type: string; data?: unknown }; // fallback for unhandled types

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export type ApiError = { error: string; message?: string };
