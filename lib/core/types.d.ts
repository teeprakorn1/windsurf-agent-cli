/**
 * TypeScript declarations for aiyu-multi-agent core modules
 * V2.6 — Initial type definitions for gradual TS migration
 */

declare module "../core/agent-runtime" {
  export interface AgentRunOptions {
    input: string;
    agentName: string;
    projectDir?: string;
    provider?: "openai" | "claude" | "local" | "mock";
    model?: string;
    maxSteps?: number;
    onStep?: (step: StepRecord, state: RunState) => void;
    json?: boolean;
    noCache?: boolean;
    outputFormat?: "text" | "json";
    deterministic?: boolean;
  }

  export interface StepRecord {
    step: number;
    thought: string;
    action: { name: string; args: Record<string, unknown> } | null;
    result: unknown;
    error: string | null;
    duration_ms: number;
    toolCalls: ToolCallRecord[];
  }

  export interface ToolCallRecord {
    tool: string;
    args: Record<string, unknown>;
    result?: unknown;
    error?: string;
    duration_ms: number;
  }

  export interface RunState {
    input: string;
    steps: StepRecord[];
    status: "running" | "complete" | "error" | "max_steps";
    output: string | null;
    error: string | null;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number };
    traceId: string;
    _fromCache?: boolean;
  }

  export interface ChatSession {
    agentName: string;
    provider: string;
    model: string;
    outputFormat: string;
    send(userInput: string): Promise<ChatEntry>;
    getHistory(): ChatEntry[];
    getMessages(): Array<{ role: string; content: string }>;
  }

  export interface ChatEntry {
    role: "assistant";
    content: string;
    toolCalls: Array<{ tool: string; result?: unknown; error?: string }>;
    steps: Array<{ step: number; thought: string; toolCalls: unknown[]; duration_ms: number }>;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number };
    traceId: string;
  }

  export interface AgentSpec {
    name: string;
    description: string;
    tools: string[];
    skills: string[];
    provider: string;
    model: string;
    memory: string;
    guardrails: boolean;
    maxSteps: number;
    loop: string;
    outputFormat: string;
    deterministic: boolean;
    instructions: string;
  }

  export function runAgent(options: AgentRunOptions): Promise<RunState>;
  export function createChatSession(options: { agentName: string; projectDir?: string; provider?: string; model?: string; outputFormat?: string }): ChatSession;
  export function loadAgentSpec(projectDir: string, agentName: string): AgentSpec;
  export function loadSkillInstructions(projectDir: string, skillNames: string[]): Record<string, string>;
  export function parseToolCalls(content: string, apiToolCalls?: unknown[]): Array<{ tool: string; args: Record<string, unknown> }>;
  export function buildSystemPrompt(agentSpec: AgentSpec, skillInstructions: Record<string, string>, projectProfile: unknown): string;
  export function truncateSkillContent(content: string): string;
  export function isAnyLlmAvailable(): boolean;
  export function sanitizeInput(input: unknown): string;
  export function safeStringify(obj: unknown): string;

  export const MAX_CONTEXT_CHARS: number;
  export const TOOL_TIMEOUT_MS: number;
  export const MAX_SKILL_INSTRUCTION_CHARS: number;
  export const MAX_INPUT_LENGTH: number;
  export const DEFAULT_MAX_STEPS: number;
  export const MAX_ALLOWED_STEPS: number;
}

declare module "../core/circuit-breaker" {
  export interface BreakerOptions {
    failureThreshold: number;
    resetTimeoutMs: number;
  }

  export interface BreakerStatus {
    name: string;
    state: "closed" | "open" | "half_open";
    failureCount: number;
    successCount: number;
    lastFailureTime: number | null;
    lastError: string | null;
  }

  export function createBreaker(name: string, options: BreakerOptions): void;
  export function canExecute(name: string): boolean;
  export function recordSuccess(name: string): void;
  export function recordFailure(name: string, error: Error): void;
  export function getBreaker(name: string): BreakerStatus | undefined;
  export function getBreakerStatus(name: string): BreakerStatus | null;
  export function getAllBreakers(): BreakerStatus[];
  export function resetBreaker(name: string): void;
}

declare module "../core/tracing" {
  export interface TraceSpan {
    traceId: string;
    spanId: string;
    operationName: string;
    startTime: number;
    endTime: number | null;
    durationMs: number | null;
    status: string;
    attributes: Record<string, unknown>;
    events: Array<{ name: string; timestamp: number; attributes: Record<string, unknown> }>;
  }

  export interface TraceData {
    traceId: string;
    operationName: string;
    startTime: number;
    endTime: number | null;
    durationMs: number | null;
    status: string;
    meta: Record<string, unknown>;
    attributes: Record<string, unknown>;
    spans: TraceSpan[];
  }

  export interface TraceMetrics {
    total: number;
    completed: number;
    failed: number;
    avgDurationMs: number;
    p95DurationMs: number;
    totalSpans: number;
  }

  export function startTrace(operationName: string, meta?: Record<string, unknown>): string;
  export function endTrace(traceId: string, status?: string, attributes?: Record<string, unknown>): TraceData | undefined;
  export function startSpan(traceId: string, operationName: string, attributes?: Record<string, unknown>): string | null;
  export function endSpan(traceId: string, spanId: string, result?: Record<string, unknown>): void;
  export function addSpanEvent(traceId: string, spanId: string, name: string, attributes?: Record<string, unknown>): void;
  export function getTrace(traceId: string): Omit<TraceData, "spans"> & { spans: TraceSpan[] } | null;
  export function getRecentTraces(limit?: number): Array<Partial<TraceData>>;
  export function getTraceMetrics(): TraceMetrics;
  export function exportOpenTelemetry(traceId: string): Record<string, unknown> | null;
  export function enablePersistentTraces(dir: string): void;
}

declare module "../core/guardrails" {
  export function pathTraversal(filePath: string, projectRoot: string): string;
  export function safeWrite(filePath: string, content: string, encoding: string, projectRoot: string): void;
  export function rateLimit(key: string, limit?: number, windowMs?: number): boolean;
  export function sandboxExec(command: string, args: string[], options?: { timeout?: number; cwd?: string }): string;

  export const ALLOWED_COMMANDS: string[];
  export const BLOCKED_FLAGS: string[];
}

declare module "../core/request-queue" {
  export interface QueueMetrics {
    totalEnqueued: number;
    totalCompleted: number;
    totalFailed: number;
    totalTimedOut: number;
    totalRejected: number;
    currentRunning: number;
    currentQueued: number;
  }

  export interface QueueJob {
    id: string;
    status: "queued" | "running" | "completed" | "failed" | "timeout";
    result?: unknown;
    error?: string;
    enqueuedAt: number;
    startedAt?: number;
    completedAt?: number;
    durationMs?: number;
  }

  export class RequestQueue {
    constructor(options?: { concurrency?: number; maxQueueSize?: number; jobTimeoutMs?: number });
    enqueue(fn: () => Promise<unknown>): Promise<QueueJob>;
    getStatus(): { running: number; queued: number; metrics: QueueMetrics };
    getJob(id: string): QueueJob | undefined;
    getMetrics(): QueueMetrics;
  }
}

declare module "../core/health-check" {
  export interface HealthReport {
    status: "ready" | "degraded" | "not_ready" | "limited";
    initialized: boolean;
    uptimeMs: number;
    checks: Record<string, { status: string; message?: string }>;
    system: {
      cpuUsage: number;
      memoryUsageMb: number;
      loadAverage: number[];
    };
  }

  export function markInitialized(): void;
  export function checkLiveness(): boolean;
  export function checkReadiness(): boolean;
  export function getFullHealthReport(): HealthReport;
}

declare module "../core/config" {
  export function getConfigDir(projectDir: string): string | null;
  export function loadConfig(projectDir: string): Record<string, unknown> | null;
  export function saveConfig(projectDir: string, data: Record<string, unknown>): void;
}

declare module "../core/cache" {
  export function _cacheKey(input: string, agentName: string, provider: string, model: string, outputFormat: string, deterministic: boolean, maxSteps: number, hash: string, projectDir: string): string;
  export function _cacheGet(key: string): unknown;
  export function _cacheSet(key: string, data: unknown): void;
  export function clearCache(): void;

  export const CACHE_MAX: number;
  export const CACHE_TTL_MS: number;
}

declare module "../core/failover" {
  export function ensureLlmBreaker(provider: string): string;
  export function buildFailoverChain(preferredProvider: string): string[];
  export function callLLMWithFailover(messages: Array<{ role: string; content: string }>, llmOpts: Record<string, unknown>): Promise<{ response: unknown; provider: string }>;
  export function isAnyLlmAvailable(): boolean;

  export const LLM_BREAKER_OPTIONS: { failureThreshold: number; resetTimeoutMs: number };
  export const FAILOVER_CHAIN: string[];
}

declare module "../core/tool-registry" {
  export interface ToolResult {
    content?: string;
    error?: string;
    [key: string]: unknown;
  }

  export type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>;

  export const BUILTIN_TOOLS: Record<string, ToolHandler>;
  export const TOOL_SCHEMAS: Record<string, { required: string[]; optional: string[] }>;
  export const LEGACY_ALIAS: Record<string, string>;

  export function registerTool(name: string, handler: ToolHandler): void;
  export function resolveToolName(name: string): string;
  export function getTool(name: string): ToolHandler | null;
  export function listTools(): string[];
  export function validateToolArgs(toolName: string, args: Record<string, unknown>): string | null;
  export function truncateResult(result: unknown): unknown;
  export function parseCommandArgs(argsStr: string): string[];
  export function executeToolIsolated(toolName: string, args: Record<string, unknown>, permissions?: Record<string, boolean>): Promise<unknown>;

  export const MAX_RESULT_SIZE: number;
}

declare module "../core/llm-providers" {
  export interface LLMOptions {
    provider: "openai" | "claude" | "local" | "mock";
    model?: string;
    temperature?: number;
    outputFormat?: string;
    maxRetries?: number;
  }

  export interface LLMResponse {
    content: string;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
    toolCalls?: unknown[];
  }

  export function callLLM(messages: Array<{ role: string; content: string }>, options: LLMOptions): Promise<LLMResponse>;
}

declare module "../core/usage" {
  export interface UsageData {
    createdAt: string;
    lastUsedAt: string | null;
    commands: Record<string, { count: number; firstUsedAt: string | null; lastUsedAt: string | null }>;
    deployments: Array<{ date: string; name: string; version: string; status: string }>;
    sessions: number;
    agentRuns: number;
    skillInstalls: number;
    testRuns: number;
    testPasses: number;
    testFails: number;
  }

  export function trackCommand(projectDir: string, command: string, meta?: Record<string, unknown>): UsageData;
  export function getSummary(projectDir: string): Record<string, unknown>;
  export function formatSummary(projectDir: string): string;
  export function loadUsage(projectDir: string): UsageData;
  export function saveUsage(projectDir: string, data: UsageData): void;
  export function getMetrics(projectDir: string): Record<string, unknown>;
  export function formatPrometheusMetrics(projectDir: string): string;
  export function _flushBuffer(): void;
}
