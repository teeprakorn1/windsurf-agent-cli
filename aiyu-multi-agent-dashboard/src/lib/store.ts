import { create } from "zustand";
import type {
  WsServerEvent, AgentStatus, Activity, ActivityStep, ActivityCompletion,
  UserMessage, Notification, NotificationType, HandoffRecord, DelegateRecord,
  TokenUsage, StepEvent, CompleteEvent, ChatStepEvent, ChatCompleteEvent,
  ChatTokenEvent, AgentStatusEvent, HandoffStartedEvent, HandoffCompleteEvent,
  DelegateStartedEvent, DelegateCompleteEvent,
} from "@/lib/types";

// --- Constants ---
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const MAX_ACTIVITIES = 50;
const MAX_STEPS_PER_ACTIVITY = 100;
const MAX_NOTIFICATIONS = 100;
const AGENT_STATUS_TTL_MS = 30 * 60 * 1000;
const CHAT_HISTORY_KEY = "aiyu-chat-history";
const MAX_HISTORY_SESSIONS = 50;
const MAX_ARRAY_SIZE = 500;
const MAX_INPUT_LENGTH = 10000;
const MAX_MESSAGE_LENGTH = 10000;
const MAX_IDENTIFIER_LENGTH = 256;
const VALID_PROVIDERS = new Set(["mock", "openai", "claude", "ollama", "local", ""]);

// --- Validation helpers ---
function validateIdentifier(value: unknown, name: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new Error(`${name} must be a string`);
  if (value.length > MAX_IDENTIFIER_LENGTH) throw new Error(`${name} exceeds max length (${MAX_IDENTIFIER_LENGTH})`);
  return value;
}

function validateInput(value: string, name: string, maxLen: number): void {
  if (typeof value !== "string") throw new Error(`${name} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${name} is required`);
  if (trimmed.length > maxLen) throw new Error(`${name} exceeds max length (${maxLen})`);
}

function parseServerTime(ts: string | undefined): number {
  if (!ts) return Date.now();
  const parsed = Date.parse(ts);
  return isNaN(parsed) ? Date.now() : parsed;
}

// --- Chat history persistence ---
function loadChatHistory(): {
  activities: Record<string, Activity>;
  userMessages: Record<string, UserMessage[]>;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveChatHistory(data: {
  activities: Record<string, Activity>;
  userMessages: Record<string, UserMessage[]>;
}) {
  if (typeof window === "undefined") return;
  try {
    const activityIds = Object.keys(data.activities);
    const keepIds = activityIds.slice(-MAX_HISTORY_SESSIONS);
    const keepSet = new Set(keepIds);
    const trimmed: typeof data = {
      activities: Object.fromEntries(Object.entries(data.activities).filter(([k]) => keepSet.has(k))),
      userMessages: Object.fromEntries(Object.entries(data.userMessages).filter(([k]) => keepSet.has(k))),
    };
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(trimmed));
  } catch { /* quota exceeded */ }
}

// --- Notification helper ---
function createNotification(type: NotificationType, title: string, message: string, activityId?: string): Notification {
  return {
    id: `notif_${Math.random().toString(36).slice(2)}_${Date.now()}`,
    type,
    title,
    message,
    activityId,
    timestamp: Date.now(),
    dismissed: false,
  };
}

// --- Store interface ---
export interface DashboardState {
  // Connection
  connected: boolean;

  // Unified Activity model
  activities: Record<string, Activity>;

  // Agent status
  agentStatuses: Record<string, AgentStatus>;

  // Notifications
  notifications: Notification[];

  // Handoffs & Delegates
  handoffs: HandoffRecord[];
  delegates: DelegateRecord[];

  // Errors
  errors: { message: string; time: number }[];

  // History loaded flag
  historyLoaded: boolean;

  // Actions
  sendRun: (opts: { agentName?: string; input: string; provider?: string; maxSteps?: number }) => void;
  sendChatCreate: (opts: { agentName?: string; provider?: string; model?: string }) => void;
  sendChatSend: (sessionId: string, input: string, opts?: { turnId?: string }) => void;
  sendIntervene: (runId: string, message: string) => void;
  sendPing: () => void;
  addChatUserMsg: (sessionId: string, msg: UserMessage) => void;
  clearChatHistory: () => void;
  deleteChatSession: (sessionId: string) => void;
  dismissNotification: (id: string) => void;
  clearErrors: () => void;
  initConnection: () => void;
}

// --- Internal WS refs (not in store state to avoid re-renders) ---
let wsRef: WebSocket | null = null;
let reconnectAttemptsRef = 0;
let reconnectTimeoutRef: number | null = null;
let intentionalCloseRef = false;
let closeTimerRef: number | null = null;
let cleanupTimerRef: number | null = null;
let historyLoadedRef = false;

function getWsUrl(): string {
  if (typeof window === "undefined") return "ws://localhost:3000/ws";
  return process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3000/ws";
}

function getWsProtocols(): string[] | undefined {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY;
  if (!apiKey) return undefined;
  return [`aiyu-token.${apiKey}`];
}

// --- Zustand store ---
export const useDashboardStore = create<DashboardState>((set) => ({
  connected: false,
  activities: {},
  agentStatuses: {},
  notifications: [],
  handoffs: [],
  delegates: [],
  errors: [],
  historyLoaded: false,

  sendRun: (opts) => {
    try {
      validateInput(opts.input, "Task input", MAX_INPUT_LENGTH);
      if (opts.agentName) validateIdentifier(opts.agentName, "Agent name");
      if (opts.provider && !VALID_PROVIDERS.has(opts.provider)) throw new Error(`Invalid provider: ${opts.provider}`);
      if (opts.maxSteps !== undefined && (typeof opts.maxSteps !== "number" || opts.maxSteps < 1 || opts.maxSteps > 100)) throw new Error("maxSteps must be between 1 and 100");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid run parameters";
      set(s => ({ errors: [...s.errors.slice(-49), { message: msg, time: Date.now() }] }));
      return;
    }
    if (wsRef?.readyState === WebSocket.OPEN) {
      wsRef.send(JSON.stringify({ type: "run", ...opts }));
    } else {
      set(s => ({ errors: [...s.errors.slice(-49), { message: "Cannot send: WebSocket not connected", time: Date.now() }] }));
    }
  },

  sendChatCreate: (opts) => {
    try {
      if (opts.agentName) validateIdentifier(opts.agentName, "Agent name");
      if (opts.provider && !VALID_PROVIDERS.has(opts.provider)) throw new Error(`Invalid provider: ${opts.provider}`);
      if (opts.model) validateIdentifier(opts.model, "Model");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid chat parameters";
      set(s => ({ errors: [...s.errors.slice(-49), { message: msg, time: Date.now() }] }));
      return;
    }
    if (wsRef?.readyState === WebSocket.OPEN) {
      wsRef.send(JSON.stringify({ type: "chat.create", ...opts }));
    } else {
      set(s => ({ errors: [...s.errors.slice(-49), { message: "Cannot create chat: WebSocket not connected", time: Date.now() }] }));
    }
  },

  sendChatSend: (sessionId, input, opts) => {
    try {
      validateInput(sessionId, "Session ID", MAX_IDENTIFIER_LENGTH);
      validateInput(input, "Chat input", MAX_INPUT_LENGTH);
      if (opts?.turnId) validateIdentifier(opts.turnId, "Turn ID");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid chat send parameters";
      set(s => ({ errors: [...s.errors.slice(-49), { message: msg, time: Date.now() }] }));
      return;
    }
    if (wsRef?.readyState === WebSocket.OPEN) {
      const resolvedTurnId = (opts?.turnId && opts.turnId.length > 0) ? opts.turnId : `turn_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      wsRef.send(JSON.stringify({ type: "chat.send", sessionId, input, turnId: resolvedTurnId }));
    } else {
      set(s => ({ errors: [...s.errors.slice(-49), { message: "Cannot send chat: WebSocket not connected", time: Date.now() }] }));
    }
  },

  sendIntervene: (runId, message) => {
    try {
      validateInput(runId, "Run ID", MAX_IDENTIFIER_LENGTH);
      validateInput(message, "Message", MAX_MESSAGE_LENGTH);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid intervention parameters";
      set(s => ({ errors: [...s.errors.slice(-49), { message: msg, time: Date.now() }] }));
      return;
    }
    if (wsRef?.readyState === WebSocket.OPEN) {
      wsRef.send(JSON.stringify({ type: "intervene", runId, message }));
    } else {
      set(s => ({ errors: [...s.errors.slice(-49), { message: "Cannot send intervention: WebSocket not connected", time: Date.now() }] }));
    }
  },

  sendPing: () => {
    if (wsRef?.readyState === WebSocket.OPEN) {
      wsRef.send(JSON.stringify({ type: "ping" }));
    }
  },

  addChatUserMsg: (sessionId, msg) => {
    set(s => {
      const activity = s.activities[sessionId];
      if (!activity) return s;
      const updatedMsgs = [...activity.userMessages, msg];
      const updatedActivity = { ...activity, userMessages: updatedMsgs };
      const newActivities = { ...s.activities, [sessionId]: updatedActivity };
      if (historyLoadedRef) setTimeout(() => saveChatHistory({ activities: newActivities, userMessages: Object.fromEntries(Object.entries(newActivities).map(([k, a]) => [k, a.userMessages])) }), 0);
      return { activities: newActivities };
    });
  },

  clearChatHistory: () => {
    set({ activities: {} });
    if (typeof window !== "undefined") localStorage.removeItem(CHAT_HISTORY_KEY);
  },

  deleteChatSession: (sessionId) => {
    set(s => {
      const { [sessionId]: _removed, ...rest } = s.activities;
      void _removed;
      if (historyLoadedRef) setTimeout(() => saveChatHistory({ activities: rest, userMessages: Object.fromEntries(Object.entries(rest).map(([k, a]) => [k, a.userMessages])) }), 0);
      return { activities: rest };
    });
  },

  dismissNotification: (id) => {
    set(s => ({
      notifications: s.notifications.map(n => n.id === id ? { ...n, dismissed: true } : n),
    }));
  },

  clearErrors: () => set({ errors: [] }),

  initConnection: () => {
    if (typeof window === "undefined") return;

    // Load chat history
    if (!historyLoadedRef) {
      const h = loadChatHistory();
      if (h) {
        set({ activities: h.activities, historyLoaded: true });
      }
      historyLoadedRef = true;
    }

    // Cancel pending close timer (React Strict Mode remount)
    if (closeTimerRef) {
      clearTimeout(closeTimerRef);
      closeTimerRef = null;
    }

    connect();
  },
}));

// --- WS Connection Logic (outside store to avoid re-render on ref changes) ---

function clearReconnect() {
  if (reconnectTimeoutRef) {
    clearTimeout(reconnectTimeoutRef);
    reconnectTimeoutRef = null;
  }
}

function connect() {
  clearReconnect();
  intentionalCloseRef = false;

  if (wsRef && wsRef.readyState !== WebSocket.CLOSED) return;

  const wsUrl = getWsUrl();
  const protocols = getWsProtocols();
  const ws = protocols ? new WebSocket(wsUrl, protocols) : new WebSocket(wsUrl);
  wsRef = ws;

  ws.onopen = () => {
    if (wsRef !== ws) return;
    useDashboardStore.setState({ connected: true });
    reconnectAttemptsRef = 0;

    // Re-subscribe to active runs
    const activities = useDashboardStore.getState().activities ?? {};
    for (const [id, activity] of Object.entries(activities)) {
      if (activity.mode === "run" && activity.status === "running") {
        try { ws.send(JSON.stringify({ type: "subscribe", runId: id })); } catch { /* ignore */ }
      }
    }
  };

  ws.onclose = () => {
    if (wsRef === ws) wsRef = null;
    if (wsRef !== null) return;
    useDashboardStore.setState({ connected: false });

    if (intentionalCloseRef) {
      intentionalCloseRef = false;
      return;
    }

    if (reconnectAttemptsRef < MAX_RECONNECT_ATTEMPTS) {
      const delay = Math.min(INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef), MAX_RECONNECT_DELAY);
      reconnectAttemptsRef++;
      pushError(`WebSocket closed. Reconnecting in ${delay / 1000}s... (attempt ${reconnectAttemptsRef}/${MAX_RECONNECT_ATTEMPTS})`);
      useDashboardStore.setState(s => ({
        notifications: [...s.notifications.slice(-(MAX_NOTIFICATIONS - 1)), createNotification("warning", "Disconnected", `Reconnecting in ${delay / 1000}s...`)],
      }));
      reconnectTimeoutRef = window.setTimeout(connect, delay);
    } else {
      pushError("WebSocket reconnection failed after max attempts. Please refresh the page.");
      useDashboardStore.setState(s => ({
        notifications: [...s.notifications.slice(-(MAX_NOTIFICATIONS - 1)), createNotification("error", "Connection Lost", "Max reconnection attempts reached. Please refresh.")],
      }));
    }
  };

  ws.onerror = () => {
    if (wsRef !== ws) return;
    pushError("WebSocket connection error");
  };

  ws.onmessage = (ev) => {
    if (wsRef !== ws) return;
    let event: WsServerEvent;
    try { event = JSON.parse(ev.data); } catch { return; }

    switch (event.type) {
      case "agent.status": {
        const e = event as AgentStatusEvent;
        useDashboardStore.setState(s => ({
          agentStatuses: {
            ...s.agentStatuses,
            [e.agentName]: { status: e.status, runId: e.runId, since: parseServerTime(e.timestamp) },
          },
        }));
        break;
      }

      case "step": {
        const e = event as StepEvent;
        useDashboardStore.setState(s => {
          const existing = s.activities[e.runId];
          const newStep: ActivityStep = {
            step: e.step, thought: e.thought, action: e.action, result: e.result,
            error: e.error, duration_ms: e.duration_ms, toolCalls: e.toolCalls,
            timestamp: parseServerTime(e.timestamp),
          };

          if (existing) {
            const deduped = existing.steps.filter(s => s.step !== e.step);
            const steps = [...deduped, newStep].slice(-MAX_STEPS_PER_ACTIVITY);
            return { activities: { ...s.activities, [e.runId]: { ...existing, steps, status: "running" } } };
          }

          // Create new run activity
          const activity: Activity = {
            id: e.runId, mode: "run", agentName: "", provider: "", model: "",
            status: "running", steps: [newStep], completions: [], userMessages: [],
            streamingContent: "", isStreaming: false, createdAt: parseServerTime(e.timestamp),
            completedAt: null, usage: null,
          };
          const keys = Object.keys(s.activities);
          if (keys.length >= MAX_ACTIVITIES) {
            const oldest = keys[0];
            const { [oldest]: _r, ...rest } = s.activities;
            void _r;
            return { activities: { ...rest, [e.runId]: activity } };
          }
          return { activities: { ...s.activities, [e.runId]: activity } };
        });
        break;
      }

      case "complete": {
        const e = event as CompleteEvent;
        useDashboardStore.setState(s => {
          const existing = s.activities[e.runId];
          const completion: ActivityCompletion = {
            content: e.output, usage: e.usage, traceId: null,
            completedAt: parseServerTime(e.timestamp),
          };
          const status = e.status === "max_steps" ? "max_steps" : e.status;
          const notif = e.status === "error"
            ? createNotification("error", "Run Failed", `Agent run ${e.runId.slice(0, 12)}... failed`, e.runId)
            : createNotification("success", "Run Completed", `Agent run ${e.runId.slice(0, 12)}... completed`, e.runId);

          if (existing) {
            const updated = {
              ...existing, status: status as Activity["status"],
              completions: [...existing.completions, completion],
              completedAt: parseServerTime(e.timestamp),
              usage: e.usage ?? existing.usage,
              isStreaming: false, streamingContent: "",
            };
            const newActivities = { ...s.activities, [e.runId]: updated };
            evictOldActivities(newActivities);
            return { activities: newActivities, notifications: [...s.notifications.slice(-(MAX_NOTIFICATIONS - 1)), notif] };
          }

          // Complete without prior step — create activity
          const activity: Activity = {
            id: e.runId, mode: "run", agentName: "", provider: "", model: "",
            status: status as Activity["status"], steps: [], completions: [completion],
            userMessages: [], streamingContent: "", isStreaming: false,
            createdAt: parseServerTime(e.timestamp), completedAt: parseServerTime(e.timestamp),
            usage: e.usage,
          };
          const newActivities = { ...s.activities, [e.runId]: activity };
          evictOldActivities(newActivities);
          return { activities: newActivities, notifications: [...s.notifications.slice(-(MAX_NOTIFICATIONS - 1)), notif] };
        });
        break;
      }

      case "chat.created": {
        useDashboardStore.setState(s => {
          const activity: Activity = {
            id: event.sessionId, mode: "chat",
            agentName: event.agentName, provider: event.provider, model: event.model,
            status: "idle", steps: [], completions: [], userMessages: [],
            streamingContent: "", isStreaming: false, createdAt: Date.now(),
            completedAt: null, usage: null,
          };
          const newActivities = { ...s.activities, [event.sessionId]: activity };
          if (historyLoadedRef) setTimeout(() => saveChatHistory({ activities: newActivities, userMessages: Object.fromEntries(Object.entries(newActivities).map(([k, a]) => [k, a.userMessages])) }), 0);
          return { activities: newActivities };
        });
        break;
      }

      case "chat.step": {
        const e = event as ChatStepEvent;
        useDashboardStore.setState(s => {
          const existing = s.activities[e.sessionId];
          const newStep: ActivityStep = {
            step: e.step, thought: e.thought, action: null, result: null,
            error: e.error, duration_ms: e.duration_ms, toolCalls: e.toolCalls,
            timestamp: parseServerTime(e.timestamp), turnId: e.turnId,
          };
          if (existing) {
            const stepKey = (s: ActivityStep) => s.turnId ? `${s.turnId}-${s.step}` : `${s.step}`;
            const newKey = newStep.turnId ? `${newStep.turnId}-${newStep.step}` : `${newStep.step}`;
            const deduped = existing.steps.filter(s => stepKey(s) !== newKey);
            const steps = [...deduped, newStep].slice(-MAX_STEPS_PER_ACTIVITY);
            return { activities: { ...s.activities, [e.sessionId]: { ...existing, steps, status: "running" } } };
          }
          const activity: Activity = {
            id: e.sessionId, mode: "chat", agentName: "", provider: "", model: "",
            status: "running", steps: [newStep], completions: [], userMessages: [],
            streamingContent: "", isStreaming: true, createdAt: Date.now(),
            completedAt: null, usage: null,
          };
          return { activities: { ...s.activities, [e.sessionId]: activity } };
        });
        break;
      }

      case "chat.token": {
        const e = event as ChatTokenEvent;
        useDashboardStore.setState(s => {
          const existing = s.activities[e.sessionId];
          if (existing) {
            return {
              activities: {
                ...s.activities,
                [e.sessionId]: { ...existing, streamingContent: existing.streamingContent + e.token, isStreaming: true },
              },
            };
          }
          return s;
        });
        break;
      }

      case "chat.complete": {
        const e = event as ChatCompleteEvent;
        useDashboardStore.setState(s => {
          const existing = s.activities[e.sessionId];
          const completion: ActivityCompletion = {
            content: e.content, usage: e.usage, traceId: e.traceId,
            completedAt: parseServerTime(e.timestamp), turnId: e.turnId,
          };
          const notif = createNotification("success", "Chat Turn Completed", `Session ${e.sessionId.slice(0, 12)}...`, e.sessionId);

          if (existing) {
            const updated = {
              ...existing, status: "completed" as const,
              completions: [...existing.completions, completion],
              completedAt: parseServerTime(e.timestamp),
              usage: aggregateUsage(existing.usage, e.usage),
              isStreaming: false, streamingContent: "",
            };
            const newActivities = { ...s.activities, [e.sessionId]: updated };
            if (historyLoadedRef) setTimeout(() => saveChatHistory({ activities: newActivities, userMessages: Object.fromEntries(Object.entries(newActivities).map(([k, a]) => [k, a.userMessages])) }), 0);
            return { activities: newActivities, notifications: [...s.notifications.slice(-(MAX_NOTIFICATIONS - 1)), notif] };
          }

          const activity: Activity = {
            id: e.sessionId, mode: "chat", agentName: "", provider: "", model: "",
            status: "completed", steps: [], completions: [completion], userMessages: [],
            streamingContent: "", isStreaming: false, createdAt: Date.now(),
            completedAt: parseServerTime(e.timestamp), usage: e.usage,
          };
          const newActivities = { ...s.activities, [e.sessionId]: activity };
          if (historyLoadedRef) setTimeout(() => saveChatHistory({ activities: newActivities, userMessages: Object.fromEntries(Object.entries(newActivities).map(([k, a]) => [k, a.userMessages])) }), 0);
          return { activities: newActivities, notifications: [...s.notifications.slice(-(MAX_NOTIFICATIONS - 1)), notif] };
        });
        break;
      }

      case "error": {
        pushError(event.message);
        useDashboardStore.setState(s => ({
          notifications: [...s.notifications.slice(-(MAX_NOTIFICATIONS - 1)), createNotification("error", "Error", event.message, event.sessionId ?? event.runId ?? undefined)],
        }));
        break;
      }

      case "handoff.started": {
        const e = event as HandoffStartedEvent;
        useDashboardStore.setState(s => ({
          handoffs: [...s.handoffs.slice(-(MAX_ARRAY_SIZE - 1)), {
            handoffId: e.handoffId, fromAgent: e.fromAgent, toAgent: e.toAgent,
            status: "started" as const, artifacts: 0, pendingTasks: 0,
            timestamp: parseServerTime(e.timestamp),
          }],
          notifications: [...s.notifications.slice(-(MAX_NOTIFICATIONS - 1)), createNotification("info", "Handoff", `${e.fromAgent} → ${e.toAgent}`)],
        }));
        break;
      }

      case "handoff.complete": {
        const e = event as HandoffCompleteEvent;
        useDashboardStore.setState(s => {
          const existing = s.handoffs.find(h => h.handoffId === e.handoffId);
          const updatedHandoffs = existing
            ? s.handoffs.map(h => h.handoffId === e.handoffId ? {
                ...h, status: (e.status === "completed" ? "completed" : "error") as HandoffRecord["status"],
                artifacts: e.artifacts ?? h.artifacts, pendingTasks: e.pendingTasks ?? h.pendingTasks,
                timestamp: parseServerTime(e.timestamp),
              } : h)
            : [...s.handoffs.slice(-(MAX_ARRAY_SIZE - 1)), {
                handoffId: e.handoffId, fromAgent: "", toAgent: "",
                status: (e.status === "completed" ? "completed" : "error") as HandoffRecord["status"],
                artifacts: e.artifacts ?? 0, pendingTasks: e.pendingTasks ?? 0,
                timestamp: parseServerTime(e.timestamp),
              }];
          const notif = e.status === "error"
            ? createNotification("warning", "Handoff Failed", `Handoff ${e.handoffId.slice(0, 12)}... failed`)
            : createNotification("info", "Handoff Complete", `Handoff ${e.handoffId.slice(0, 12)}... completed`);
          return { handoffs: updatedHandoffs, notifications: [...s.notifications.slice(-(MAX_NOTIFICATIONS - 1)), notif] };
        });
        break;
      }

      case "delegate.started": {
        const e = event as DelegateStartedEvent;
        useDashboardStore.setState(s => ({
          delegates: [...s.delegates.slice(-(MAX_ARRAY_SIZE - 1)), {
            runId: e.runId, parentAgent: e.parentAgent, childAgent: e.childAgent,
            depth: e.depth, status: "started" as const, timestamp: parseServerTime(e.timestamp),
          }],
          notifications: [...s.notifications.slice(-(MAX_NOTIFICATIONS - 1)), createNotification("info", "Delegate", `${e.parentAgent} → ${e.childAgent} (depth ${e.depth})`)],
        }));
        break;
      }

      case "delegate.complete": {
        const e = event as DelegateCompleteEvent;
        useDashboardStore.setState(s => {
          const existing = s.delegates.find(d => d.runId === e.runId && d.status === "started");
          const updatedDelegates = existing
            ? s.delegates.map(d => d.runId === e.runId && d.status === "started" ? {
                ...d, status: e.status, timestamp: parseServerTime(e.timestamp),
              } : d)
            : [...s.delegates.slice(-(MAX_ARRAY_SIZE - 1)), {
                runId: e.runId, parentAgent: "", childAgent: e.childAgent,
                depth: 0, status: e.status, timestamp: parseServerTime(e.timestamp),
              }];
          return { delegates: updatedDelegates };
        });
        break;
      }

      default:
        console.warn("[WS] Unknown event type:", (event as unknown as Record<string, unknown>).type);
    }
  };
}

function pushError(msg: string) {
  useDashboardStore.setState(s => ({ errors: [...s.errors.slice(-49), { message: msg, time: Date.now() }] }));
}

function evictOldActivities(activities: Record<string, Activity>) {
  const keys = Object.keys(activities);
  if (keys.length <= MAX_ACTIVITIES) return;
  keys.sort((a, b) => (activities[a]?.completedAt ?? activities[a]?.createdAt ?? 0) - (activities[b]?.completedAt ?? activities[b]?.createdAt ?? 0));
  const cleaned: Record<string, Activity> = {};
  for (let i = keys.length - MAX_ACTIVITIES; i < keys.length; i++) {
    cleaned[keys[i]] = activities[keys[i]];
  }
  Object.assign(activities, cleaned);
  for (const k of Object.keys(activities)) {
    if (!(k in cleaned)) delete (activities as Record<string, Activity>)[k];
  }
}

function aggregateUsage(existing: TokenUsage | null, incoming: TokenUsage | null): TokenUsage | null {
  if (!existing && !incoming) return null;
  if (!existing) return incoming;
  if (!incoming) return existing;
  return {
    promptTokens: existing.promptTokens + incoming.promptTokens,
    completionTokens: existing.completionTokens + incoming.completionTokens,
    totalTokens: existing.totalTokens + incoming.totalTokens,
  };
}

// --- Periodic cleanup (called from component mount) ---
export function startCleanupTimer() {
  cleanupTimerRef = window.setInterval(() => {
    const now = Date.now();
    useDashboardStore.setState(s => {
      // Evict stale agent statuses
      const cleanedStatuses: Record<string, AgentStatus> = {};
      for (const [name, entry] of Object.entries(s.agentStatuses)) {
        if (now - entry.since < AGENT_STATUS_TTL_MS) cleanedStatuses[name] = entry;
      }
      // Evict old notifications
      const activeNotifs = s.notifications.filter(n => !n.dismissed && now - n.timestamp < 300_000);
      // Evict old completed activities
      const activities = { ...s.activities };
      evictOldActivities(activities);
      return {
        agentStatuses: Object.keys(cleanedStatuses).length === Object.keys(s.agentStatuses).length ? s.agentStatuses : cleanedStatuses,
        notifications: activeNotifs.length === s.notifications.length ? s.notifications : activeNotifs,
        activities,
      };
    });
  }, 60_000);
}

export function stopCleanupTimer() {
  if (cleanupTimerRef) {
    clearInterval(cleanupTimerRef);
    cleanupTimerRef = null;
  }
}

export function closeConnection() {
  // Defer close for React Strict Mode
  closeTimerRef = window.setTimeout(() => {
    intentionalCloseRef = true;
    wsRef?.close();
    wsRef = null;
    closeTimerRef = null;
  }, 100);
}

export function cancelClose() {
  if (closeTimerRef) {
    clearTimeout(closeTimerRef);
    closeTimerRef = null;
  }
}
