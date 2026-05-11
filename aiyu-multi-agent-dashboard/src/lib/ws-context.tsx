"use client";

import { useEffect, type ReactNode } from "react";
import { useDashboardStore, startCleanupTimer, stopCleanupTimer, closeConnection, cancelClose } from "@/lib/store";
import type { DashboardState } from "@/lib/store";

// Re-export the store hook as useWs for backward compatibility
export const useWs = useDashboardStore;

// Backward-compatible type alias
export type WsContextValue = DashboardState;

// Provider component that handles WS lifecycle
export function WsProvider({ children }: { children: ReactNode }) {
  const initConnection = useDashboardStore(s => s.initConnection);

  useEffect(() => {
    cancelClose();
    initConnection();
    startCleanupTimer();

    return () => {
      stopCleanupTimer();
      closeConnection();
    };
  }, [initConnection]);

  return <>{children}</>;
}
