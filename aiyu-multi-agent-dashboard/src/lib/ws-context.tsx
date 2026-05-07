"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useWebSocket } from "@/lib/use-websocket";

type WsContextValue = ReturnType<typeof useWebSocket>;

const WsContext = createContext<WsContextValue | null>(null);

export function WsProvider({ children }: { children: ReactNode }) {
  const ws = useWebSocket();
  const value = useMemo(() => ws, // eslint-disable-next-line react-hooks/exhaustive-deps
    [ws.connected, ws.agentStatuses, ws.runs, ws.completedRuns, ws.errors, ws.chatSessions, ws.chatSteps, ws.chatCompletions, ws.handoffs, ws.delegates, ws.sendRun, ws.sendIntervene, ws.sendPing, ws.clearErrors]);
  return <WsContext.Provider value={value}>{children}</WsContext.Provider>;
}

export function useWs() {
  const ctx = useContext(WsContext);
  if (!ctx) throw new Error("useWs must be used within <WsProvider>");
  return ctx;
}
