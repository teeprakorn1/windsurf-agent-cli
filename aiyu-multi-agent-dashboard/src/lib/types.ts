// WS event types — mirrors docs/WS-SCHEMA.md

export interface StepEvent {
  type: "step";
  runId: string;
  step: number;
  thought: string | null;
  action: Record<string, unknown> | null;
  result: string | null;
  error: string | null;
  duration_ms: number | null;
  toolCalls: ToolCallSummary[] | null;
  timestamp?: string;
}

export interface CompleteEvent {
  type: "complete";
  runId: string;
  status: "completed" | "max_steps" | "error";
  output: string | null;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  steps: number | null;
  timestamp?: string;
}

export interface ErrorEvent {
  type: "error";
  runId?: string | null;
  sessionId?: string | null;
  message: string;
}

export interface ChatCreatedEvent {
  type: "chat.created";
  sessionId: string;
  agentName: string;
  provider: string;
  model: string;
}

export interface ChatStepEvent {
  type: "chat.step";
  sessionId: string;
  turnId?: string;
  step: number;
  thought: string | null;
  toolCalls: ToolCallSummary[] | null;
  duration_ms: number | null;
  error: string | null;
  timestamp?: string;
}

export interface ChatCompleteEvent {
  type: "chat.complete";
  sessionId: string;
  turnId?: string;
  content: string | null;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  traceId: string | null;
  timestamp?: string;
}

export interface AgentStatusEvent {
  type: "agent.status";
  agentName: string;
  status: "idle" | "running" | "error" | "completed";
  runId: string | null;
  timestamp: string;
}

export interface HandoffStartedEvent {
  type: "handoff.started";
  handoffId: string;
  fromAgent: string;
  toAgent: string;
  timestamp: string;
}

export interface HandoffCompleteEvent {
  type: "handoff.complete";
  handoffId: string;
  status: "completed" | "error";
  artifacts: number;
  pendingTasks: number;
  timestamp: string;
}

export interface DelegateStartedEvent {
  type: "delegate.started";
  runId: string;
  parentAgent: string;
  childAgent: string;
  depth: number;
  timestamp: string;
}

export interface DelegateCompleteEvent {
  type: "delegate.complete";
  runId: string;
  childAgent: string;
  status: "completed" | "max_steps" | "error";
  timestamp: string;
}

export interface PongEvent { type: "pong" }
export interface InterveneAckEvent { type: "intervene.ack"; runId: string }
export interface SubscribeAckEvent { type: "subscribe.ack"; runId: string }

export interface ToolCallSummary {
  tool: string;
  duration_ms?: number | null;
  error?: string | null;
}

export type WsServerEvent =
  | StepEvent
  | CompleteEvent
  | ErrorEvent
  | ChatCreatedEvent
  | ChatStepEvent
  | ChatCompleteEvent
  | ChatTokenEvent
  | AgentStatusEvent
  | HandoffStartedEvent
  | HandoffCompleteEvent
  | DelegateStartedEvent
  | DelegateCompleteEvent
  | PongEvent
  | InterveneAckEvent
  | SubscribeAckEvent;

export interface AgentStatus {
  status: "idle" | "running" | "error" | "completed";
  runId: string | null;
  since: number;
}

export interface ChatTokenEvent {
  type: "chat.token";
  sessionId: string;
  turnId?: string;
  token: string;
  timestamp?: string;
}

export interface RunStep {
  step: number;
  thought: string | null;
  action: Record<string, unknown> | null;
  result: string | null;
  error: string | null;
  duration_ms: number | null;
  toolCalls: ToolCallSummary[] | null;
  timestamp: number;
}

// --- Unified Activity Model (v2.8) ---

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ActivityStep {
  step: number;
  thought: string | null;
  action: Record<string, unknown> | null;
  result: string | null;
  error: string | null;
  duration_ms: number | null;
  toolCalls: ToolCallSummary[] | null;
  timestamp: number;
  turnId?: string;
}

export interface ActivityCompletion {
  content: string | null;
  usage: TokenUsage | null;
  traceId: string | null;
  completedAt: number;
  turnId?: string;
}

export interface UserMessage {
  input: string;
  timestamp: number;
  turnKey: string;
  turnId: string;
}

export type ActivityMode = "run" | "chat";
export type ActivityStatus = "idle" | "running" | "completed" | "error" | "max_steps";

export interface Activity {
  id: string;
  mode: ActivityMode;
  agentName: string;
  provider: string;
  model: string;
  status: ActivityStatus;
  steps: ActivityStep[];
  completions: ActivityCompletion[];
  userMessages: UserMessage[];
  streamingContent: string;
  isStreaming: boolean;
  createdAt: number;
  completedAt: number | null;
  usage: TokenUsage | null;
}

export type NotificationType = "success" | "error" | "warning" | "info";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  activityId?: string;
  timestamp: number;
  dismissed: boolean;
}

export interface HandoffRecord {
  handoffId: string;
  fromAgent: string;
  toAgent: string;
  status: "started" | "completed" | "error";
  artifacts: number;
  pendingTasks: number;
  timestamp: number;
}

export interface DelegateRecord {
  runId: string;
  parentAgent: string;
  childAgent: string;
  depth: number;
  status: "started" | "completed" | "max_steps" | "error";
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  steps?: { thought: string | null; toolCalls: { tool: string }[] | null; duration_ms: number | null; error: string | null }[];
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  isStreaming?: boolean;
  handoff?: { from: string; to: string } | null;
}

// --- Inspector types (discriminated union for single inspected item) ---

export interface InteractionInspectData {
  key: string;
  type: string;
  detail: string;
  status: string;
  time: number;
  raw: Record<string, unknown>;
}

export interface LogInspectData {
  id: string;
  time: number;
  displayTime: string;
  type: string;
  runId?: string;
  message: string;
  raw: Record<string, unknown>;
}

export type InspectedItem =
  | { type: "agent"; name: string }
  | { type: "activity"; id: string }
  | { type: "interaction"; data: InteractionInspectData }
  | { type: "log"; data: LogInspectData }
  | null;
