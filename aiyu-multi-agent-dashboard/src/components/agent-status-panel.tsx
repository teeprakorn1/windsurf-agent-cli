"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { useWs } from "@/lib/ws-context";
import type { AgentStatus } from "@/lib/types";
import { Activity, CheckCircle, AlertCircle, Clock, ChevronDown, Zap } from "lucide-react";

const statusCfg: Record<string, { icon: typeof Activity; color: string; bg: string; ring: string; label: string; dot: string }> = {
  running:   { icon: Activity,   color: "text-blue-700 dark:text-blue-400",    bg: "bg-blue-500/10",    ring: "ring-blue-500/30", label: "Running",   dot: "bg-blue-500" },
  completed: { icon: CheckCircle, color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-500/10", ring: "ring-emerald-500/20", label: "Completed", dot: "bg-emerald-500" },
  error:     { icon: AlertCircle, color: "text-red-700 dark:text-red-400",     bg: "bg-red-500/10",     ring: "ring-red-500/20",   label: "Error",     dot: "bg-red-500" },
  idle:      { icon: Clock,      color: "text-gray-700 dark:text-zinc-400",    bg: "bg-zinc-500/10",    ring: "",                  label: "Idle",      dot: "bg-zinc-400" },
};

interface AgentStatusPanelProps {
  onAgentSelect?: (agentName: string | null) => void;
  activeAgent?: string | null;
}

export const AgentStatusPanel = memo(function AgentStatusPanel({ onAgentSelect, activeAgent }: AgentStatusPanelProps) {
  const agentStatuses = useWs(s => s.agentStatuses);
  const activities = useWs(s => s.activities);
  const connected = useWs(s => s.connected);

  // Force re-render every second so running durations stay fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const hasRunning = Object.entries(agentStatuses ?? {}).some(([, s]) => s.status === "running");
    if (!hasRunning) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [agentStatuses]);

  // Merge agentStatuses with activities to show all agents that have ever run
  const merged = useMemo(() => {
    const map: Record<string, AgentStatus & { runId?: string | null }> = { ...agentStatuses };
    for (const [id, act] of Object.entries(activities ?? {})) {
      const name = act.agentName;
      if (!name) continue;
      if (!map[name] || (act.completedAt ?? act.createdAt) > (map[name].since ?? 0)) {
        map[name] = {
          status: act.status === "idle" ? "idle" : act.status === "running" ? "running" : act.status === "error" || act.status === "max_steps" ? "error" : "completed",
          runId: id,
          since: act.completedAt ?? act.createdAt,
        };
      }
    }
    return map;
  }, [agentStatuses, activities]);

  const entries = Object.entries(merged);
  const running = entries.filter(([, s]) => s.status === "running").length;
  const completed = entries.filter(([, s]) => s.status === "completed").length;

  if (entries.length === 0) {
    return (
      <div className="glass-card p-3">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />
          <h2 className="section-title text-[10px] mb-0">Agents</h2>
        </div>
        <div className="flex flex-col items-center py-3 text-gray-500 dark:text-zinc-600">
          <Activity className="h-5 w-5 mb-1 opacity-30" />
          <p className="text-[10px]">{connected ? "No agents yet" : "Connecting..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />
          <h2 className="section-title text-[10px] mb-0">Agents</h2>
          <span className="text-[9px] text-gray-400 dark:text-zinc-600">{entries.length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {running > 0 && <span className="flex items-center gap-1 text-[9px] text-blue-600 dark:text-blue-400"><span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />{running}</span>}
          {completed > 0 && <span className="flex items-center gap-1 text-[9px] text-emerald-600 dark:text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{completed}</span>}
        </div>
      </div>
      <div className="space-y-1">
        {entries.map(([name, status]) => {
          const cfg = statusCfg[status.status] || statusCfg.idle;
          const Icon = cfg.icon;
          const isActive = activeAgent === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => onAgentSelect?.(isActive ? null : name)}
              className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 border transition-all duration-200 cursor-pointer text-left ${isActive ? `${cfg.bg} ring-1 ${cfg.ring} border-transparent` : "border-gray-200 dark:border-zinc-700/40 hover:border-zinc-400 dark:hover:border-zinc-500/60"}`}
            >
              <div className={`flex h-6 w-6 items-center justify-center rounded-md ${cfg.bg} shrink-0`}>
                <Icon className={`h-3 w-3 ${cfg.color} ${status.status === "running" ? "animate-pulse" : ""}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-gray-900 dark:text-zinc-200 truncate leading-tight">{name}</p>
              </div>
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dot} ${status.status === "running" ? "animate-pulse" : ""}`} />
              <ChevronDown className="h-3 w-3 text-gray-400 dark:text-zinc-600 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
})
