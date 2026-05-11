"use client";

import { memo, useMemo } from "react";
import { useWs } from "@/lib/ws-context";
import { Activity, CheckCircle, AlertCircle, Clock, Network, ArrowRight, ChevronDown, Users } from "lucide-react";
import type { AgentStatus } from "@/lib/types";

const statusCfg: Record<string, { icon: typeof Activity; color: string; bg: string; dot: string; label: string }> = {
  running:   { icon: Activity,    color: "text-blue-700 dark:text-blue-400",    bg: "bg-blue-500/10",    dot: "bg-blue-500",    label: "Running" },
  completed: { icon: CheckCircle, color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-500/10", dot: "bg-emerald-500", label: "Completed" },
  error:     { icon: AlertCircle, color: "text-red-700 dark:text-red-400",     bg: "bg-red-500/10",     dot: "bg-red-500",     label: "Error" },
  idle:      { icon: Clock,       color: "text-gray-700 dark:text-zinc-400",    bg: "bg-zinc-500/10",    dot: "bg-zinc-400",    label: "Idle" },
};

interface InteractionMapProps {
  onAgentSelect?: (agentName: string | null) => void;
  activeAgent?: string | null;
}

export const InteractionMap = memo(function InteractionMap({ onAgentSelect, activeAgent }: InteractionMapProps) {
  const agentStatuses = useWs(s => s.agentStatuses);
  const activities = useWs(s => s.activities);
  const handoffs = useWs(s => s.handoffs);
  const delegates = useWs(s => s.delegates);

  const enrichedStatuses = useMemo<Record<string, AgentStatus>>(() => {
    const statuses: Record<string, AgentStatus> = { ...(agentStatuses ?? {}) };
    for (const [id, act] of Object.entries(activities ?? {})) {
      const name = act.agentName;
      if (!name) continue;
      if (!statuses[name] || (act.completedAt ?? act.createdAt) > (statuses[name].since ?? 0)) {
        statuses[name] = {
          status: act.status === "idle" ? "idle" : act.status === "running" ? "running" : act.status === "error" || act.status === "max_steps" ? "error" : "completed",
          runId: id,
          since: act.completedAt ?? act.createdAt,
        };
      }
    }
    const edgeList = [
      ...handoffs.map(h => ({ from: h.fromAgent, to: h.toAgent })),
      ...delegates.map(d => ({ from: d.parentAgent, to: d.childAgent })),
    ];
    for (const e of edgeList) {
      if (e.from && !statuses[e.from]) statuses[e.from] = { status: "idle", runId: null, since: Date.now() };
      if (e.to && !statuses[e.to]) statuses[e.to] = { status: "idle", runId: null, since: Date.now() };
    }
    return statuses;
  }, [agentStatuses, activities, handoffs, delegates]);

  const edges = useMemo(() => [
    ...handoffs.map(h => ({ from: h.fromAgent, to: h.toAgent, label: "handoff" as const, status: h.status, key: `h-${h.handoffId}`, id: h.handoffId, artifacts: h.artifacts, pendingTasks: h.pendingTasks, timestamp: h.timestamp })),
    ...delegates.map(d => ({ from: d.parentAgent, to: d.childAgent, label: "delegate" as const, status: d.status, key: `d-${d.runId}`, id: d.runId, depth: d.depth, timestamp: d.timestamp })),
  ], [handoffs, delegates]);

  const entries = Object.entries(enrichedStatuses);
  const hasEdges = edges.length > 0;

  if (entries.length === 0 && !hasEdges) {
    return (
      <div className="glass-card p-3">
        <div className="flex items-center gap-2 mb-2">
          <Network className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
          <h2 className="section-title text-[10px] mb-0">Agent Graph</h2>
        </div>
        <div className="flex flex-col items-center py-4 text-gray-500 dark:text-zinc-600">
          <Network className="h-6 w-6 mb-1.5 opacity-30" />
          <p className="text-[10px]">No interactions yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Network className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
          <h2 className="section-title text-[10px] mb-0">Agent Graph</h2>
          <span className="text-[9px] text-gray-400 dark:text-zinc-600">{entries.length}</span>
        </div>
        {hasEdges && <span className="flex items-center gap-1 text-[9px] text-cyan-600 dark:text-cyan-400"><ArrowRight className="h-2.5 w-2.5" />{edges.length}</span>}
      </div>

      {/* Agent nodes */}
      <div className="space-y-1 mb-2">
        {entries.map(([name, status]) => {
          const cfg = statusCfg[status.status] || statusCfg.idle;
          const Icon = cfg.icon;
          const isActive = activeAgent === name;
          const agentEdges = edges.filter(e => e.from === name || e.to === name);
          return (
            <div key={name}>
              <button
                type="button"
                onClick={() => onAgentSelect?.(isActive ? null : name)}
                className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 border transition-all duration-200 cursor-pointer text-left ${isActive ? `${cfg.bg} ring-1 ring-cyan-500/20 border-transparent` : "border-gray-200 dark:border-zinc-700/40 hover:border-zinc-400 dark:hover:border-zinc-500/60"}`}
              >
                <div className={`flex h-6 w-6 items-center justify-center rounded-md ${cfg.bg} shrink-0`}>
                  <Icon className={`h-3 w-3 ${cfg.color} ${status.status === "running" ? "animate-pulse" : ""}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-gray-900 dark:text-zinc-200 truncate leading-tight">{name}</p>
                </div>
                {agentEdges.length > 0 && (
                  <span className="text-[9px] text-gray-400 dark:text-zinc-600 shrink-0">{agentEdges.length} link{agentEdges.length > 1 ? "s" : ""}</span>
                )}
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dot} ${status.status === "running" ? "animate-pulse" : ""}`} />
                <ChevronDown className="h-3 w-3 text-gray-400 dark:text-zinc-600 shrink-0" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Edge flow cards */}
      {hasEdges && (
        <div className="border-t border-gray-200 dark:border-zinc-700/40 pt-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Users className="h-3 w-3 text-gray-400 dark:text-zinc-500" />
            <span className="text-[9px] text-gray-500 dark:text-zinc-600 uppercase tracking-wider font-semibold">Flows</span>
          </div>
          <div className="space-y-1">
            {edges.slice(0, 10).map(edge => {
              const fromCfg = statusCfg[enrichedStatuses[edge.from]?.status ?? "idle"] || statusCfg.idle;
              const toCfg = statusCfg[enrichedStatuses[edge.to]?.status ?? "idle"] || statusCfg.idle;
              return (
                <button
                  key={edge.key}
                  type="button"
                  onClick={() => onAgentSelect?.(edge.from)}
                  className="w-full flex items-center gap-1.5 rounded-lg px-2 py-1.5 border border-gray-200 dark:border-zinc-700/40 transition-all duration-200 cursor-pointer text-left hover:border-zinc-400 dark:hover:border-zinc-500/60"
                >
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${fromCfg.dot}`} />
                  <span className="text-[10px] font-medium text-gray-800 dark:text-zinc-300 truncate">{edge.from}</span>
                  <ArrowRight className={`h-3 w-3 shrink-0 ${edge.label === "handoff" ? "text-cyan-500" : "text-amber-500"}`} />
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${toCfg.dot}`} />
                  <span className="text-[10px] font-medium text-gray-800 dark:text-zinc-300 truncate">{edge.to}</span>
                  <span className={`ml-auto px-1 py-0.5 rounded text-[8px] font-semibold uppercase tracking-wider shrink-0 ${edge.label === "handoff" ? "bg-cyan-100 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400" : "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}>{edge.label}</span>
                </button>
              );
            })}
            {edges.length > 10 && <p className="text-[9px] text-gray-400 dark:text-zinc-600 pl-2">+{edges.length - 10} more</p>}
          </div>
        </div>
      )}
    </div>
  );
})
