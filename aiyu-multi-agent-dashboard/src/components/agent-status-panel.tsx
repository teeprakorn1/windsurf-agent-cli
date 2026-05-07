"use client";

import { memo } from "react";
import { useWs } from "@/lib/ws-context";
import type { AgentStatus } from "@/lib/types";
import { Activity, CheckCircle, AlertCircle, Clock } from "lucide-react";

const statusConfig: Record<string, { icon: typeof Activity; color: string; bg: string; label: string; glow: string }> = {
  running:   { icon: Activity,   color: "text-blue-700 dark:text-blue-400",   bg: "bg-blue-500/10",   label: "Running",   glow: "glow-blue" },
  completed: { icon: CheckCircle, color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-500/10", label: "Completed", glow: "glow-green" },
  error:     { icon: AlertCircle, color: "text-red-700 dark:text-red-400",   bg: "bg-red-500/10",    label: "Error",     glow: "glow-red" },
  idle:      { icon: Clock,      color: "text-gray-700 dark:text-zinc-400",  bg: "bg-zinc-500/10",   label: "Idle",      glow: "" },
};

export const AgentStatusPanel = memo(function AgentStatusPanel() {
  const { agentStatuses, connected } = useWs();
  const entries = Object.entries(agentStatuses);

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
          return (
            <div key={name} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border border-transparent transition-all duration-200 ${cfg.bg} ${cfg.glow} ${status.status === "running" ? "border-blue-500/10" : "hover:border-zinc-700/50"}`}>
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
            </div>
          );
        })}
      </div>
    </div>
  );
})
