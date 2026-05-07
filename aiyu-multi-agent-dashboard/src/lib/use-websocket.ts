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
  step: number;
  thought: string | null;
  toolCalls: { tool: string; duration_ms?: number | null; error?: string | null }[] | null;
  duration_ms: number | null;
  error: string | null;
  timestamp: number;
}

interface ChatCompletion {
  sessionId: string;
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
  chatCompletions: Record<string, ChatCompletion>;
  handoffs: HandoffRecord[];
  delegates: DelegateRecord[];
  sendRun: (opts: { agentName?: string; input: string; provider?: string; maxSteps?: number }) => void;
  sendIntervene: (runId: string, message: string) => void;
  sendChatCreate: (opts: { agentName?: string; provider?: string; model?: string }) => void;
  sendChatSend: (sessionId: string, input: string) => void;
  sendPing: () => void;
  clearErrors: () => void;
}

export function useWebSocket(url?: string): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const intentionalCloseRef = useRef(false);
  const [connected, setConnected] = useState(false);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [runs, setRuns] = useState<Record<string, RunStep[]>>({});
  const [completedRuns, setCompletedRuns] = useState<Record<string, CompletedRun>>({});
  const [errors, setErrors] = useState<{ message: string; time: number }[]>([]);
  const [chatSessions, setChatSessions] = useState<Record<string, ChatSession>>({});
  const [chatSteps, setChatSteps] = useState<ChatStep[]>([]);
  const [chatCompletions, setChatCompletions] = useState<Record<string, ChatCompletion>>({});
  const [handoffs, setHandoffs] = useState<HandoffRecord[]>([]);
  const [delegates, setDelegates] = useState<DelegateRecord[]>([]);

  const wsUrl = useMemo(() => {
    let base = url || (typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3000/ws")
      : "ws://localhost:3000/ws");
    const apiKey = process.env.NEXT_PUBLIC_API_KEY;
    if (apiKey && base && !base.includes("token=")) {
      const sep = base.includes("?") ? "&" : "?";
      base = `${base}${sep}token=${encodeURIComponent(apiKey)}`;
    }
    return base;
  }, [url]);

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

  const connect = useCallback(() => {
    clearReconnect();
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      reconnectAttemptsRef.current = 0;
      setErrors([]);
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      
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
          connect();
        }, delay);
      } else {
        pushError("WebSocket reconnection failed after max attempts. Please refresh the page.");
      }
    };

    ws.onerror = () => {
      pushError("WebSocket connection error");
    };

    ws.onmessage = (ev) => {
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
          setChatCompletions(prev => ({
            ...prev,
            [e.sessionId]: {
              sessionId: e.sessionId,
              content: e.content,
              usage: e.usage,
              traceId: e.traceId,
              completedAt: parseServerTime(e.timestamp),
            },
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
      }
    };
  }, [wsUrl, pushError, clearReconnect, parseServerTime]);

  useEffect(() => {
    connect();
    
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
    cleanupTimer.unref?.();
    
    return () => {
      clearInterval(cleanupTimer);
      intentionalCloseRef.current = true;
      clearReconnect();
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect, clearReconnect]);

  const sendRun = useCallback((opts: { agentName?: string; input: string; provider?: string; maxSteps?: number }) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "run", ...opts }));
    } else {
      pushError("Cannot send: WebSocket not connected");
    }
  }, [pushError]);

  const sendIntervene = useCallback((runId: string, message: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "intervene", runId, message }));
    } else {
      pushError("Cannot send intervention: WebSocket not connected");
    }
  }, [pushError]);

  const sendChatCreate = useCallback((opts: { agentName?: string; provider?: string; model?: string }) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "chat.create", ...opts }));
    } else {
      pushError("Cannot create chat: WebSocket not connected");
    }
  }, [pushError]);

  const sendChatSend = useCallback((sessionId: string, input: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "chat.send", sessionId, input }));
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

  return { connected, agentStatuses, runs, completedRuns, errors, chatSessions, chatSteps, chatCompletions, handoffs, delegates, sendRun, sendIntervene, sendChatCreate, sendChatSend, sendPing, clearErrors };
}
