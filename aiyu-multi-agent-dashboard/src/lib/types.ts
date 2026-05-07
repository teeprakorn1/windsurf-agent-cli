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
