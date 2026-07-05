/**
 * Shared API response types for the Bizar Companion app.
 * These mirror the dashboard's REST surface.
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
  | { type: 'artifact:new'; data: { id: string; name: string; url: string } }
  | { type: 'settings:change'; data: { settings: Partial<WsSnapshotSettings> } }
  | { type: 'change'; data: Record<string, unknown> }
  | { type: string; data?: unknown }; // fallback for unhandled types

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export type ApiError = { error: string; message?: string };
