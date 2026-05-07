"use client";

import { WsProvider, useWs } from "@/lib/ws-context";
import { AgentStatusPanel } from "@/components/agent-status-panel";
import { ExecutionTimeline } from "@/components/execution-timeline";
import { InterventionPanel } from "@/components/intervention-panel";
import { InteractionMap } from "@/components/interaction-map";
import { MemoryViewer } from "@/components/memory-viewer";
import { MetricsPanel } from "@/components/metrics-panel";
import { LogsViewer } from "@/components/logs-viewer";
import { ThemeToggle } from "@/components/theme-toggle";
import { ErrorBoundary } from "@/components/error-boundary";
import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Wifi, WifiOff, Download, Zap, Sparkles, RotateCcw } from "lucide-react";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "2.7.1";

type Provider = "openai" | "claude" | "local" | "mock";

function useCallbackRef<T extends (...args: unknown[]) => void>(callback: T) {
  const ref = useRef(callback);
  useEffect(() => { ref.current = callback; });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stableRef = useRef((...args: any[]) => ref.current(...args));
  return stableRef.current;
}

function DashboardContent() {
  const { connected, sendRun, errors, clearErrors, runs, completedRuns, agentStatuses, chatSessions, chatSteps, chatCompletions, handoffs, delegates } = useWs();
  const [input, setInput] = useState("");
  const [agentName, setAgentName] = useState("");
  const [provider, setProvider] = useState<Provider>("mock");
  const [toast, setToast] = useState<string | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);

  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast(msg);
    toastTimeoutRef.current = setTimeout(() => { setToast(null); toastTimeoutRef.current = null; }, 4000);
  }, []);

  useEffect(() => {
    return () => { if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current); };
  }, []);

  const handleRun = useCallback(() => {
    if (!input.trim()) return;
    if (!connected) {
      showToast("Backend offline — connect to API server first (port 3000)");
      return;
    }
    sendRun({ agentName: agentName || undefined, input: input.trim(), provider });
    setInput("");
    setAgentName("");
  }, [input, agentName, provider, sendRun, connected, showToast]);

  const handleRunRef = useCallbackRef(handleRun);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "Escape" && tag !== "SELECT") {
        setInput("");
        setAgentName("");
      }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleRunRef();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleRunRef]);

  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current); };
  }, []);

  const handleExport = () => {
    try {
      const safeReplacer = (_key: string, value: unknown) =>
        typeof value === "bigint" ? String(value) : value;
      const safeCompleted = Object.fromEntries(
        Object.entries(completedRuns).map(([k, v]) => [k, { ...v, usage: v.usage ? JSON.parse(JSON.stringify(v.usage, safeReplacer)) : null }])
      );
      const exportData = { timestamp: new Date().toISOString(), runs, completedRuns: safeCompleted, agentStatuses, chatSessions, chatSteps, chatCompletions, handoffs, delegates };
      const blob = new Blob([JSON.stringify(exportData, safeReplacer, 2)], { type: "application/json" });
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      const a = document.createElement("a");
      a.href = url;
      a.download = `aiyu-trace-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
      a.click();
      showToast("Trace exported successfully");
    } catch {
      showToast("Export failed — check browser console");
    }
  };

  const activeRunCount = Object.keys(runs).filter(id => !completedRuns[id]).length;
  const agentCount = Object.keys(agentStatuses).length;

  return (
    <div className="min-h-screen text-zinc-900 dark:text-zinc-100 relative" style={{ background: 'var(--bg-primary)' }}>
      <div className="fixed inset-0 dot-pattern dark:opacity-30 pointer-events-none" />

      <header className="sticky top-0 z-50 border-b bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl" style={{ borderColor: 'var(--border-color)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div className="absolute inset-0 blur-md bg-blue-600/40 dark:bg-blue-400/40" />
            </div>
            <h1 className="text-base font-bold tracking-tight gradient-text">Aiyu MultiAgent</h1>
            <span className="text-[10px] text-gray-500 dark:text-zinc-600 border border-gray-300 dark:border-zinc-800 rounded-full px-2 py-0.5">v{APP_VERSION}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExport} className="btn-ghost" aria-label="Export trace to JSON">
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button onClick={() => setShowResetDialog(true)} className="btn-ghost" aria-label="Reset dashboard">
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
            <ThemeToggle />
            <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition-all duration-300
              ${connected 
                ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400 border border-green-200 dark:border-green-500/20" 
                : "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20"}`}>
              {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              <span className="hidden sm:inline">{connected ? "Live" : "Offline"}</span>
              {connected && <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" /></span>}
            </div>
          </div>
        </div>
      </header>

      <main className="relative max-w-7xl mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5" role="main">
        <section className="lg:col-span-4 space-y-4" aria-label="Controls">
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              <h2 className="section-title mb-0">New Run</h2>
            </div>
            <div className="space-y-2.5">
              <input type="text" value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="Agent name (optional)" aria-label="Agent name" className="input-field" />
              <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Describe the task... (Ctrl+Enter to run, Esc to clear)" rows={3} aria-label="Task description" className="input-field resize-none" />
              <div className="flex gap-2">
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as Provider)}
                  className="input-field text-xs py-2 flex-1"
                  aria-label="Select LLM provider"
                >
                  <option value="mock">Test / Mock (No API Key)</option>
                  <option value="openai">OpenAI</option>
                  <option value="claude">Claude (Anthropic)</option>
                  <option value="local">Ollama (Local / Free)</option>
                </select>
                <button onClick={handleRun} disabled={!input.trim()} className="btn-primary flex-[2] py-2.5 text-sm">
                  <Play className="h-4 w-4" />
                  Run Agent
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card p-3 text-center glow-blue">
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{agentCount}</p>
              <p className="text-[10px] text-gray-500 dark:text-zinc-500 uppercase tracking-wider">Agents</p>
            </div>
            <div className="glass-card p-3 text-center glow-purple">
              <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">{activeRunCount}</p>
              <p className="text-[10px] text-gray-500 dark:text-zinc-500 uppercase tracking-wider">Active Runs</p>
            </div>
          </div>

          <AgentStatusPanel />
          <InterventionPanel />
          <MetricsPanel />
        </section>

        <section className="lg:col-span-8 space-y-4" aria-label="Activity">
          <InteractionMap />
          <ExecutionTimeline />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MemoryViewer />
            <LogsViewer />
          </div>
        </section>
      </main>

      {showResetDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowResetDialog(false)} role="dialog" aria-modal="true" aria-label="Confirm reset">
          <div className="glass-card p-6 max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-200 mb-2">Reset Dashboard</h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mb-4">Clear all dashboard data and reload? This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowResetDialog(false)} className="btn-ghost px-4 py-2 text-xs">Cancel</button>
              <button onClick={() => window.location.reload()} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-500 transition-colors">
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            </div>
          </div>
        </div>
      )}

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
