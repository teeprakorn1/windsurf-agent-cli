"use client";

import { WsProvider, useWs } from "@/lib/ws-context";
import { ChatPanel } from "@/components/chat-panel";
import { ErrorBoundary } from "@/components/error-boundary";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { DashboardHeader } from "@/components/dashboard-header";
import { ResetDialog } from "@/components/reset-dialog";
import { useState, useEffect, useCallback, useRef } from "react";
import { Zap } from "lucide-react";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "2.7.4";

function DashboardContent() {
  const { errors, clearErrors } = useWs();
  const [toast, setToast] = useState<string | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [connInfo, setConnInfo] = useState<Record<string, unknown> | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast(msg);
    toastTimeoutRef.current = setTimeout(() => { setToast(null); toastTimeoutRef.current = null; }, 4000);
  }, []);

  useEffect(() => {
    return () => { if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current); };
  }, []);

  const fetchConnInfo = useCallback(async () => {
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data = await res.json();
        setConnInfo(data);
      }
    } catch { /* ignore */ }
  }, []);

  return (
    <div className="min-h-screen text-zinc-900 dark:text-zinc-100 relative" style={{ background: 'var(--bg-primary)' }}>
      <div className="fixed inset-0 dot-pattern dark:opacity-30 pointer-events-none" />

      <DashboardHeader
        version={APP_VERSION}
        onReset={() => setShowResetDialog(true)}
        showToast={showToast}
        connInfo={connInfo}
        onConnInfoRequest={fetchConnInfo}
      />

      <main className="relative max-w-[1600px] mx-auto p-2 sm:p-4 lg:p-6" style={{ height: "calc(100vh - 80px)" }} role="main">
        <SectionErrorBoundary title="Chat Panel">
          <ChatPanel />
        </SectionErrorBoundary>
      </main>

      <ResetDialog
        open={showResetDialog}
        onClose={() => setShowResetDialog(false)}
        onConfirm={() => window.location.reload()}
      />

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-slide-in">
          <div className="glass-card px-4 py-2.5 flex items-center gap-2 shadow-lg shadow-black/10 dark:shadow-black/30">
            <Zap className="h-3.5 w-3.5 text-blue-500" />
            <p className="text-xs text-gray-800 dark:text-zinc-200">{toast}</p>
            <button onClick={() => setToast(null)} className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 text-xs" aria-label="Dismiss">✕</button>
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40 animate-slide-in">
          <div className="glass-card glow-red px-4 py-3 flex items-center gap-3 max-w-md cursor-pointer" onClick={clearErrors} role="alert">
            <div className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
            <p className="text-xs text-red-600 dark:text-red-300 line-clamp-2">{errors[errors.length - 1].message}</p>
            <span className="text-[9px] text-red-400 ml-1 shrink-0">{errors.length > 1 ? `+${errors.length - 1}` : ""}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <WsProvider>
      <ErrorBoundary>
        <DashboardContent />
      </ErrorBoundary>
    </WsProvider>
  );
}
