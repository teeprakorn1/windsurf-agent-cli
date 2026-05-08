"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WsServerEvent, AgentStatus, RunStep, AgentStatusEvent, StepEvent, CompleteEvent, ChatStepEvent, ChatCompleteEvent, HandoffStartedEvent, HandoffCompleteEvent, DelegateStartedEvent, DelegateCompleteEvent } from "@/lib/types";

const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const MAX_ARRAY_SIZE = 500;
const MAX_RUNS = 50;
const MAX_STEPS_PER_RUN = 100;
const AGENT_STATUS_TTL_MS = 30 * 60 * 1000;
const CHAT_HISTORY_KEY = "aiyu-chat-history";
const MAX_HISTORY_SESSIONS = 50;

// Input validation limits — match backend guardrails
const MAX_INPUT_LENGTH = 10000;
const MAX_MESSAGE_LENGTH = 10000;
const MAX_IDENTIFIER_LENGTH = 256;
const VALID_PROVIDERS = new Set(["mock", "openai", "claude", "ollama", "local", ""]);

// Chat history persistence helpers
function loadChatHistory() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Migrate old format: completions was Record<string, ChatCompletion>, now Record<string, ChatCompletion[]>
    if (data.completions) {
      for (const key of Object.keys(data.completions)) {
        const val = data.completions[key];
        if (Array.isArray(val)) continue;
        if (val && typeof val === "object" && val.sessionId) {
          data.completions[key] = [val];
        } else {
          data.completions[key] = [];
        }
      }
    }
    return data;
  } catch { return null; }
}

function saveChatHistory(data: {
  sessions: Record<string, ChatSession>;
  steps: ChatStep[];
  completions: Record<string, ChatCompletion[]>;
  userMsgs: { sessionId: string; input: string; timestamp: number; turnKey: string; turnId: string }[];
}) {
  if (typeof window === "undefined") return;
  try {
    const sessionIds = Object.keys(data.sessions);
    const keepIds = sessionIds.slice(-MAX_HISTORY_SESSIONS);
    const keepSet = new Set(keepIds);
    const trimmed = {
      sessions: Object.fromEntries(Object.entries(data.sessions).filter(([k]) => keepSet.has(k))),
      steps: data.steps.filter(s => keepSet.has(s.sessionId)).slice(-MAX_ARRAY_SIZE),
      completions: Object.fromEntries(Object.entries(data.completions).filter(([k]) => keepSet.has(k))),
      userMsgs: data.userMsgs.filter(m => keepSet.has(m.sessionId)).slice(-MAX_ARRAY_SIZE),
    };
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(trimmed));
  } catch { /* quota exceeded — ignore */ }
}

export function validateIdentifier(value: unknown, name: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") { throw new Error(`${name} must be a string`); }
  if (value.length > MAX_IDENTIFIER_LENGTH) { throw new Error(`${name} exceeds max length (${MAX_IDENTIFIER_LENGTH})`); }
  return value;
}

export function validateInput(value: string, name: string, maxLen: number): void {
  if (typeof value !== "string") { throw new Error(`${name} must be a string`); }
  const trimmed = value.trim();
  if (!trimmed) { throw new Error(`${name} is required`); }
  if (trimmed.length > maxLen) { throw new Error(`${name} exceeds max length (${maxLen})`); }
}

interface CompletedRun {
  status: string;
  output: string | null;
  usage: unknown;
  completedAt: number;
}

interface ChatSession {
  sessionId: string;
  agentName: string;
  provider: string;
  model: string;
}

interface ChatStep {
  sessionId: string;
  turnId?: string;
  step: number;
  thought: string | null;
  toolCalls: { tool: string; duration_ms?: number | null; error?: string | null }[] | null;
  duration_ms: number | null;
  error: string | null;
  timestamp: number;
}

interface ChatCompletion {
  sessionId: string;
  turnId?: string;
  content: string | null;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  traceId: string | null;
  completedAt: number;
}

interface HandoffRecord {
  handoffId: string;
  fromAgent: string;
  toAgent: string;
  status: "started" | "completed" | "error";
  artifacts: number;
  pendingTasks: number;
  timestamp: number;
}

interface DelegateRecord {
  runId: string;
  parentAgent: string;
  childAgent: string;
  depth: number;
  status: "started" | "completed" | "max_steps" | "error";
  timestamp: number;
}

interface UseWebSocketReturn {
  connected: boolean;
  agentStatuses: Record<string, AgentStatus>;
  runs: Record<string, RunStep[]>;
  completedRuns: Record<string, CompletedRun>;
  errors: { message: string; time: number }[];
  chatSessions: Record<string, ChatSession>;
  chatSteps: ChatStep[];
  chatCompletions: Record<string, ChatCompletion[]>;
  chatUserMsgs: { sessionId: string; input: string; timestamp: number; turnKey: string; turnId: string }[];
  addChatUserMsg: (msg: { sessionId: string; input: string; timestamp: number; turnKey: string; turnId: string }) => void;
  clearChatHistory: () => void;
  handoffs: HandoffRecord[];
  delegates: DelegateRecord[];
  sendRun: (opts: { agentName?: string; input: string; provider?: string; maxSteps?: number }) => void;
  sendIntervene: (runId: string, message: string) => void;
  sendChatCreate: (opts: { agentName?: string; provider?: string; model?: string }) => void;
  sendChatSend: (sessionId: string, input: string, opts?: { turnId?: string }) => void;
  sendPing: () => void;
  clearErrors: () => void;
  deleteChatSession: (sessionId: string) => void;
}

export function useWebSocket(url?: string): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const intentionalCloseRef = useRef(false);
  const closeTimerRef = useRef<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [runs, setRuns] = useState<Record<string, RunStep[]>>({});
  const [completedRuns, setCompletedRuns] = useState<Record<string, CompletedRun>>({});
  const [errors, setErrors] = useState<{ message: string; time: number }[]>([]);
  const [chatSessions, setChatSessions] = useState<Record<string, ChatSession>>({});
  const [chatSteps, setChatSteps] = useState<ChatStep[]>([]);
  const [chatCompletions, setChatCompletions] = useState<Record<string, ChatCompletion[]>>({});
  const [chatUserMsgs, setChatUserMsgs] = useState<{ sessionId: string; input: string; timestamp: number; turnKey: string; turnId: string }[]>([]);
  const historyLoadedRef = useRef(false);
  const [handoffs, setHandoffs] = useState<HandoffRecord[]>([]);
  const [delegates, setDelegates] = useState<DelegateRecord[]>([]);

  // Load chat history from localStorage after hydration to avoid mismatch
  useEffect(() => {
    const h = loadChatHistory();
    if (h) {
      setChatSessions(h.sessions ?? {});
      setChatSteps(h.steps ?? []);
      setChatCompletions(h.completions ?? {});
      setChatUserMsgs(h.userMsgs ?? []);
    }
    historyLoadedRef.current = true;
  }, []);

  // Auto-save chat history to localStorage on changes (only after initial load)
  useEffect(() => {
    if (!historyLoadedRef.current) return;
    saveChatHistory({ sessions: chatSessions, steps: chatSteps, completions: chatCompletions, userMsgs: chatUserMsgs });
  }, [chatSessions, chatSteps, chatCompletions, chatUserMsgs]);

  const wsUrl = useMemo(() => {
    return url || (typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3000/ws")
      : "ws://localhost:3000/ws");
  }, [url]);

  const wsProtocols = useMemo((): string[] | undefined => {
    const apiKey = process.env.NEXT_PUBLIC_API_KEY;
    if (!apiKey) return undefined;
    return [`aiyu-token.${apiKey}`];
  }, []);

  const pushError = useCallback((msg: string) => {
    setErrors(prev => [...prev.slice(-49), { message: msg, time: Date.now() }]);
  }, []);

  const parseServerTime = useCallback((ts: string | undefined): number => {
    if (!ts) return Date.now();
    const parsed = Date.parse(ts);
    return isNaN(parsed) ? Date.now() : parsed;
  }, []);

  const clearReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    clearReconnect();
    intentionalCloseRef.current = false; // Reset — new connect means we want to stay connected

    // Guard against creating duplicate connections
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      return;
    }

    const ws = wsProtocols ? new WebSocket(wsUrl, wsProtocols) : new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current !== ws) return; // Stale WS from previous mount (React Strict Mode)
      setConnected(true);
      reconnectAttemptsRef.current = 0;
      setErrors([]);
      // Re-subscribe to active runs so we don't miss steps after reconnect
      setRuns(prev => {
        const activeRunIds = Object.keys(prev);
        for (const runId of activeRunIds) {
          try { ws.send(JSON.stringify({ type: "subscribe", runId })); } catch { /* ignore */ }
        }
        return prev;
      });
    };

    ws.onclose = () => {
      if (wsRef.current === ws) wsRef.current = null; // Only nullify if still current
      if (wsRef.current !== null) return; // New WS already created by remount — skip
      setConnected(false);
      
      if (intentionalCloseRef.current) {
        intentionalCloseRef.current = false;
        return;
      }
      
      // Attempt reconnect with exponential backoff
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(
          INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current),
          MAX_RECONNECT_DELAY
        );
        reconnectAttemptsRef.current++;
        pushError(`WebSocket closed. Reconnecting in ${delay / 1000}s... (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
        
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connectRef.current();
        }, delay);
      } else {
        pushError("WebSocket reconnection failed after max attempts. Please refresh the page.");
      }
    };

    ws.onerror = () => {
      if (wsRef.current !== ws) return; // Stale WS
      pushError("WebSocket connection error");
    };

    ws.onmessage = (ev) => {
      if (wsRef.current !== ws) return; // Stale WS
      let event: WsServerEvent;
      try {
        event = JSON.parse(ev.data);
      } catch {
        return;
      }

      switch (event.type) {
        case "agent.status": {
          const e = event as AgentStatusEvent;
          setAgentStatuses(prev => ({
            ...prev,
            [e.agentName]: { status: e.status, runId: e.runId, since: parseServerTime(e.timestamp) },
          }));
          break;
        }

        case "step": {
          const e = event as StepEvent;
          setRuns(prev => {
            const existing = prev[e.runId] || [];
            const newStep = {
              step: e.step,
              thought: e.thought,
              action: e.action,
              result: e.result,
              error: e.error,
              duration_ms: e.duration_ms,
              toolCalls: e.toolCalls,
              timestamp: parseServerTime(e.timestamp),
            };
            const deduped = existing.filter(s => s.step !== e.step);
            const updated = [...deduped, newStep].slice(-MAX_STEPS_PER_RUN);
            const keys = Object.keys(prev);
            if (keys.length >= MAX_RUNS && !prev[e.runId]) {
              const oldest = keys[0];
              const { [oldest]: _removed, ...rest } = prev;
              void _removed;
              return { ...rest, [e.runId]: updated };
            }
            return { ...prev, [e.runId]: updated };
          });
          break;
        }

        case "complete": {
          const e = event as CompleteEvent;
          setCompletedRuns(prev => {
            const updated = {
              ...prev,
              [e.runId]: { status: e.status, output: e.output, usage: e.usage, completedAt: parseServerTime(e.timestamp) },
            };
            // Immediate eviction when over limit
            const keys = Object.keys(updated);
            if (keys.length > MAX_RUNS) {
              keys.sort((a, b) => (updated[a]?.completedAt ?? 0) - (updated[b]?.completedAt ?? 0));
              const cleaned: Record<string, CompletedRun> = {};
              for (let i = keys.length - MAX_RUNS; i < keys.length; i++) {
                cleaned[keys[i]] = updated[keys[i]];
              }
              return cleaned;
            }
            return updated;
          });
          break;
        }

        case "error":
          pushError(event.message);
          break;

        case "chat.created":
          setChatSessions(prev => ({
            ...prev,
            [event.sessionId]: { sessionId: event.sessionId, agentName: event.agentName, provider: event.provider, model: event.model },
          }));
          break;

        case "chat.step": {
          const e = event as ChatStepEvent;
          setChatSteps(prev => [...prev.slice(-(MAX_ARRAY_SIZE - 1)), {
            sessionId: e.sessionId,
            turnId: e.turnId || undefined,
            step: e.step,
            thought: e.thought,
            toolCalls: e.toolCalls,
            duration_ms: e.duration_ms,
            error: e.error,
            timestamp: parseServerTime(e.timestamp),
          }]);
          break;
        }

        case "chat.complete": {
          const e = event as ChatCompleteEvent;
          const completion: ChatCompletion = {
            sessionId: e.sessionId,
            turnId: e.turnId || undefined,
            content: e.content,
            usage: e.usage,
            traceId: e.traceId,
            completedAt: parseServerTime(e.timestamp),
          };
          setChatCompletions(prev => ({
            ...prev,
            [e.sessionId]: [...(prev[e.sessionId] || []), completion],
          }));
          break;
        }

        case "handoff.started": {
          const e = event as HandoffStartedEvent;
          setHandoffs(prev => [...prev.slice(-(MAX_ARRAY_SIZE - 1)), {
            handoffId: e.handoffId,
            fromAgent: e.fromAgent,
            toAgent: e.toAgent,
            status: "started" as const,
            artifacts: 0,
            pendingTasks: 0,
            timestamp: parseServerTime(e.timestamp),
          }]);
          break;
        }
        case "handoff.complete": {
          const e = event as HandoffCompleteEvent;
          setHandoffs(prev => {
            const existing = prev.find(h => h.handoffId === e.handoffId);
            if (existing) {
              return prev.map(h => h.handoffId === e.handoffId ? {
                ...h,
                status: e.status === "completed" ? "completed" as const : "error" as const,
                artifacts: e.artifacts ?? h.artifacts,
                pendingTasks: e.pendingTasks ?? h.pendingTasks,
                timestamp: parseServerTime(e.timestamp),
              } : h);
            }
            return [...prev.slice(-(MAX_ARRAY_SIZE - 1)), {
              handoffId: e.handoffId,
              fromAgent: "",
              toAgent: "",
              status: e.status === "completed" ? "completed" as const : "error" as const,
              artifacts: e.artifacts ?? 0,
              pendingTasks: e.pendingTasks ?? 0,
              timestamp: parseServerTime(e.timestamp),
            }];
          });
          break;
        }
        case "delegate.started": {
          const e = event as DelegateStartedEvent;
          setDelegates(prev => [...prev.slice(-(MAX_ARRAY_SIZE - 1)), {
            runId: e.runId,
            parentAgent: e.parentAgent,
            childAgent: e.childAgent,
            depth: e.depth,
            status: "started" as const,
            timestamp: parseServerTime(e.timestamp),
          }]);
          break;
        }
        case "delegate.complete": {
          const e = event as DelegateCompleteEvent;
          setDelegates(prev => {
            const existing = prev.find(d => d.runId === e.runId && d.status === "started");
            if (existing) {
              return prev.map(d => d.runId === e.runId && d.status === "started" ? {
                ...d,
                status: e.status,
                timestamp: parseServerTime(e.timestamp),
              } : d);
            }
            return [...prev.slice(-(MAX_ARRAY_SIZE - 1)), {
              runId: e.runId,
              parentAgent: "",
              childAgent: e.childAgent,
              depth: 0,
              status: e.status,
              timestamp: parseServerTime(e.timestamp),
            }];
          });
          break;
        }
        default:
          console.warn("[WS] Unknown event type:", (event as unknown as Record<string, unknown>).type);
      }
    };
  }, [wsUrl, wsProtocols, pushError, clearReconnect, parseServerTime]);

  connectRef.current = connect;

  useEffect(() => {
    // Strict Mode safe: cancel any pending close from simulated unmount, then connect
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    connectRef.current();

    // Periodic cleanup: evict stale agent statuses (TTL 30min) and orphaned completedRuns
    const cleanupTimer = setInterval(() => {
      const now = Date.now();
      setAgentStatuses(prev => {
        const cleaned: Record<string, AgentStatus> = {};
        for (const [name, entry] of Object.entries(prev)) {
          if (now - entry.since < AGENT_STATUS_TTL_MS) cleaned[name] = entry;
        }
        return Object.keys(cleaned).length === Object.keys(prev).length ? prev : cleaned;
      });
      setCompletedRuns(prev => {
        const keys = Object.keys(prev);
        if (keys.length <= MAX_RUNS) return prev;
        const sorted = keys.sort((a, b) => (prev[a]?.completedAt ?? 0) - (prev[b]?.completedAt ?? 0));
        const toRemove = sorted.slice(0, keys.length - MAX_RUNS);
        if (toRemove.length === 0) return prev;
        const cleaned = { ...prev };
        for (const k of toRemove) delete cleaned[k];
        return cleaned;
      });
    }, 60_000);
    // cleanupTimer.unref is Node-only; skip in browser
    
    return () => {
      clearInterval(cleanupTimer);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      // Defer close: Strict Mode unmount→remount happens synchronously.
      // If remount cancels this timer, WS stays alive. Real unmount closes after 100ms.
      closeTimerRef.current = window.setTimeout(() => {
        intentionalCloseRef.current = true;
        wsRef.current?.close();
        wsRef.current = null;
        closeTimerRef.current = null;
      }, 100);
    };
  }, []);

  const sendRun = useCallback((opts: { agentName?: string; input: string; provider?: string; maxSteps?: number }) => {
    try {
      validateInput(opts.input, "Task input", MAX_INPUT_LENGTH);
      if (opts.agentName) validateIdentifier(opts.agentName, "Agent name");
      if (opts.provider && !VALID_PROVIDERS.has(opts.provider)) {
        throw new Error(`Invalid provider: ${opts.provider}`);
      }
      if (opts.maxSteps !== undefined && (typeof opts.maxSteps !== "number" || opts.maxSteps < 1 || opts.maxSteps > 100)) {
        throw new Error("maxSteps must be between 1 and 100");
      }
    } catch (err) {
      pushError(err instanceof Error ? err.message : "Invalid run parameters");
      return;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "run", ...opts }));
    } else {
      pushError("Cannot send: WebSocket not connected");
    }
  }, [pushError]);

  const sendIntervene = useCallback((runId: string, message: string) => {
    try {
      validateInput(runId, "Run ID", MAX_IDENTIFIER_LENGTH);
      validateInput(message, "Message", MAX_MESSAGE_LENGTH);
    } catch (err) {
      pushError(err instanceof Error ? err.message : "Invalid intervention parameters");
      return;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "intervene", runId, message }));
    } else {
      pushError("Cannot send intervention: WebSocket not connected");
    }
  }, [pushError]);

  const sendChatCreate = useCallback((opts: { agentName?: string; provider?: string; model?: string }) => {
    try {
      if (opts.agentName) validateIdentifier(opts.agentName, "Agent name");
      if (opts.provider && !VALID_PROVIDERS.has(opts.provider)) {
        throw new Error(`Invalid provider: ${opts.provider}`);
      }
      if (opts.model) validateIdentifier(opts.model, "Model");
    } catch (err) {
      pushError(err instanceof Error ? err.message : "Invalid chat parameters");
      return;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "chat.create", ...opts }));
    } else {
      pushError("Cannot create chat: WebSocket not connected");
    }
  }, [pushError]);

  const sendChatSend = useCallback((sessionId: string, input: string, opts?: { turnId?: string }) => {
    try {
      validateInput(sessionId, "Session ID", MAX_IDENTIFIER_LENGTH);
      validateInput(input, "Chat input", MAX_INPUT_LENGTH);
      if (opts?.turnId) validateIdentifier(opts.turnId, "Turn ID");
    } catch (err) {
      pushError(err instanceof Error ? err.message : "Invalid chat send parameters");
      return;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const providedTurnId = opts?.turnId;
      const resolvedTurnId = (typeof providedTurnId === "string" && providedTurnId.length > 0)
        ? providedTurnId
        : `turn_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      wsRef.current.send(JSON.stringify({ type: "chat.send", sessionId, input, turnId: resolvedTurnId }));
    } else {
      pushError("Cannot send chat: WebSocket not connected");
    }
  }, [pushError]);

  const sendPing = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "ping" }));
    } else {
      pushError("Cannot send ping: WebSocket not connected");
    }
  }, [pushError]);

  const clearErrors = useCallback(() => setErrors([]), []);

  const addChatUserMsg = useCallback((msg: { sessionId: string; input: string; timestamp: number; turnKey: string; turnId: string }) => {
    setChatUserMsgs(prev => [...prev, msg]);
  }, []);

  const clearChatHistory = useCallback(() => {
    setChatSessions({});
    setChatSteps([]);
    setChatCompletions({});
    setChatUserMsgs([]);
    if (typeof window !== "undefined") localStorage.removeItem(CHAT_HISTORY_KEY);
  }, []);

  const deleteChatSession = useCallback((sessionId: string) => {
    setChatSessions(prev => {
      const { [sessionId]: _removed, ...rest } = prev;
      void _removed;
      return rest;
    });
    setChatSteps(prev => prev.filter(s => s.sessionId !== sessionId));
    setChatCompletions(prev => {
      const { [sessionId]: _removed, ...rest } = prev;
      void _removed;
      return rest;
    });
    setChatUserMsgs(prev => prev.filter(m => m.sessionId !== sessionId));
  }, []);

  return { connected, agentStatuses, runs, completedRuns, errors, chatSessions, chatSteps, chatCompletions, chatUserMsgs, addChatUserMsg, clearChatHistory, handoffs, delegates, sendRun, sendIntervene, sendChatCreate, sendChatSend, sendPing, clearErrors, deleteChatSession };
}
