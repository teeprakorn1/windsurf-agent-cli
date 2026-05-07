"use client";

import { memo, useEffect, useState } from "react";
import { useWs } from "@/lib/ws-context";
import type { AgentStatus } from "@/lib/types";
import { Activity, CheckCircle, AlertCircle, Clock, ChevronDown, X } from "lucide-react";

const statusConfig: Record<string, { icon: typeof Activity; color: string; bg: string; label: string; glow: string }> = {
  running:   { icon: Activity,   color: "text-blue-700 dark:text-blue-400",   bg: "bg-blue-500/10",   label: "Running",   glow: "glow-blue" },
  completed: { icon: CheckCircle, color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-500/10", label: "Completed", glow: "glow-green" },
  error:     { icon: AlertCircle, color: "text-red-700 dark:text-red-400",   bg: "bg-red-500/10",    label: "Error",     glow: "glow-red" },
  idle:      { icon: Clock,      color: "text-gray-700 dark:text-zinc-400",  bg: "bg-zinc-500/10",   label: "Idle",      glow: "" },
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500 dark:text-zinc-500">{label}</span>
      <span className="font-medium text-gray-800 dark:text-zinc-300 text-right break-all">{value}</span>
    </div>
  );
}

export const AgentStatusPanel = memo(function AgentStatusPanel() {
  const { agentStatuses, runs, completedRuns, connected } = useWs();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  // Force re-render every second so running agent durations stay fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const hasRunning = Object.values(agentStatuses).some(s => s.status === "running");
    if (!hasRunning) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [agentStatuses]);
  const entries = Object.entries(agentStatuses);

  const selectedStatus = selectedAgent ? agentStatuses[selectedAgent] : null;
  const selectedRunId = selectedStatus?.runId;
  const selectedSteps = selectedRunId ? runs[selectedRunId] : undefined;
  const selectedComplete = selectedRunId ? completedRuns[selectedRunId] : undefined;

  if (entries.length === 0) {
    return (
      <div className="glass-card p-4">
        <h2 className="section-title">Agent Status</h2>
        <div className="flex flex-col items-center py-6 text-gray-500 dark:text-zinc-600">
          <Activity className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-xs">{connected ? "No agents running" : "Connecting..."}</p>
          <p className="text-[10px] text-gray-400 dark:text-zinc-700">{connected ? "Start a run to see status here" : "Waiting for WebSocket connection"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-4">
      <h2 className="section-title">Agent Status</h2>
      <div className="space-y-2">
        {entries.map(([name, status]: [string, AgentStatus]) => {
          const cfg = statusConfig[status.status] || statusConfig.idle;
          const Icon = cfg.icon;
          const isSelected = selectedAgent === name;
          return (
            <div key={name}>
              <button
                type="button"
                onClick={() => setSelectedAgent(isSelected ? null : name)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 border transition-all duration-200 cursor-pointer text-left ${cfg.bg} ${cfg.glow} ${status.status === "running" ? "border-blue-500/10" : "hover:border-zinc-700/50"} ${isSelected ? "ring-2 ring-blue-500 dark:ring-blue-400 shadow-md" : ""}`}
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${cfg.bg}`}>
                  <Icon className={`h-4 w-4 ${cfg.color} ${status.status === "running" ? "animate-glow-pulse" : ""}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-zinc-200 truncate">{name}</p>
                  <p className={`text-[10px] font-medium uppercase tracking-wider ${cfg.color}`}>{cfg.label}</p>
                </div>
                {status.runId && (
                  <span className="text-[9px] text-zinc-500 dark:text-zinc-600 font-mono truncate max-w-[100px] bg-zinc-100 dark:bg-zinc-900/50 px-1.5 py-0.5 rounded">{status.runId}</span>
                )}
                <ChevronDown className={`h-3 w-3 text-gray-400 dark:text-zinc-600 shrink-0 transition-transform ${isSelected ? "rotate-180" : ""}`} />
              </button>
              {isSelected && selectedStatus && (
                <div className="mt-1.5 p-3 rounded-lg bg-white dark:bg-zinc-900/80 border border-gray-200 dark:border-zinc-700/60 space-y-1.5 text-[11px] animate-slide-in">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-gray-900 dark:text-zinc-100">{name}</span>
                    <button type="button" onClick={() => setSelectedAgent(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300"><X className="h-3 w-3" /></button>
                  </div>
                  <DetailRow label="Status" value={selectedStatus.status} />
                  <DetailRow label="Run ID" value={selectedStatus.runId || "—"} />
                  <DetailRow label="Since" value={new Date(selectedStatus.since).toLocaleTimeString()} />
                  <DetailRow label="Duration" value={selectedStatus.since ? formatSince(selectedStatus.since) : "—"} />
                  {selectedSteps && (
                    <div className="pt-2 mt-2 border-t border-gray-200 dark:border-zinc-700/60">
                      <DetailRow label="Steps" value={String(selectedSteps.length)} />
                      {selectedSteps.length > 0 && (
                        <div className="mt-1.5 space-y-0.5">
                          {selectedSteps.slice(-5).map((s, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-[10px] text-gray-600 dark:text-zinc-400">
                              <span className="font-mono text-gray-400 dark:text-zinc-600">#{s.step}</span>
                              <span className="truncate">{s.thought ? s.thought.slice(0, 60) : s.error ? `Error: ${s.error.slice(0, 40)}` : `Step ${s.step}`}</span>
                            </div>
                          ))}
                          {selectedSteps.length > 5 && <p className="text-[9px] text-gray-400 dark:text-zinc-600">+{selectedSteps.length - 5} more steps</p>}
                        </div>
                      )}
                    </div>
                  )}
                  {selectedComplete && (
                    <div className="pt-2 mt-2 border-t border-gray-200 dark:border-zinc-700/60">
                      <DetailRow label="Result" value={selectedComplete.status} />
                      {selectedComplete.output && (
                        <div className="mt-1.5">
                          <p className="text-[9px] text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Output</p>
                          <pre className="text-[10px] text-gray-700 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-950/60 rounded px-2 py-1.5 overflow-x-auto max-h-24 whitespace-pre-wrap border border-gray-200 dark:border-zinc-800/40">{selectedComplete.output.length > 200 ? selectedComplete.output.slice(0, 200) + "..." : selectedComplete.output}</pre>
                        </div>
                      )}
                      {(() => {
                        const usage = selectedComplete.usage as Record<string, number> | null;
                        if (!usage) return null;
                        const pt = usage.promptTokens;
                        const ct = usage.completionTokens;
                        const tt = usage.totalTokens;
                        return (
                          <div className="mt-1.5">
                            <p className="text-[9px] text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Token Usage</p>
                            <div className="flex gap-3 text-[10px]">
                              {pt != null && <span>Prompt: {pt}</span>}
                              {ct != null && <span>Comp: {ct}</span>}
                              {tt != null && <span>Total: {tt}</span>}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
})

function formatSince(since: number): string {
  const diff = Math.max(0, Date.now() - since);
  if (diff < 1000) return `${diff}ms`;
  if (diff < 60000) return `${(diff / 1000).toFixed(1)}s`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ${Math.floor((diff % 60000) / 1000)}s`;
  return `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`;
}
