"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useWebSocket } from "@/lib/use-websocket";

type WsContextValue = ReturnType<typeof useWebSocket>;

const WsContext = createContext<WsContextValue | null>(null);

export function WsProvider({ children }: { children: ReactNode }) {
  const ws = useWebSocket();
  return <WsContext.Provider value={ws}>{children}</WsContext.Provider>;
}

const noopWs: WsContextValue = {
  connected: false, agentStatuses: {}, runs: {}, completedRuns: {}, errors: [],
  chatSessions: {}, chatSteps: [], chatCompletions: {}, handoffs: [], delegates: [],
  sendRun: () => {}, sendIntervene: () => {}, sendChatCreate: () => {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  sendChatSend: ((..._args: unknown[]) => {}) as WsContextValue["sendChatSend"], sendPing: () => {}, clearErrors: () => {},
};

export function useWs() {
  const ctx = useContext(WsContext);
  if (!ctx) {
    console.warn("useWs called outside <WsProvider>; returning noop");
    return noopWs;
  }
  return ctx;
}
