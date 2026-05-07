"use client";

import { memo } from "react";
import { useWs } from "@/lib/ws-context";
import { Activity, CheckCircle, AlertCircle, Clock, Network, ArrowRight } from "lucide-react";

const statusColors: Record<string, string> = {
  running: "bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20",
  completed: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20",
  error: "bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-500/20",
  idle: "bg-gray-100 dark:bg-zinc-500/15 text-gray-700 dark:text-zinc-400 border border-gray-200 dark:border-zinc-500/20",
};

const statusIcons: Record<string, typeof Activity> = {
  running: Activity,
  completed: CheckCircle,
  error: AlertCircle,
  idle: Clock,
};

export const InteractionMap = memo(function InteractionMap() {
  const { agentStatuses, handoffs, delegates } = useWs();

  // Auto-add agent nodes from edge data when missing from agentStatuses
  const enrichedStatuses = { ...agentStatuses };
  const edges = [
    ...handoffs.map(h => ({ from: h.fromAgent, to: h.toAgent, label: "handoff", status: h.status, key: `h-${h.handoffId}` })),
    ...delegates.map(d => ({ from: d.parentAgent, to: d.childAgent, label: "delegate", status: d.status, key: `d-${d.runId}` })),
  ];
  for (const edge of edges) {
    if (edge.from && !enrichedStatuses[edge.from]) enrichedStatuses[edge.from] = { status: "idle", runId: null, since: Date.now() };
    if (edge.to && !enrichedStatuses[edge.to]) enrichedStatuses[edge.to] = { status: "idle", runId: null, since: Date.now() };
  }
  const entries = Object.entries(enrichedStatuses);

  if (entries.length === 0 && edges.length === 0) {
    return (
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Network className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
          <h2 className="section-title mb-0">Agent Graph</h2>
        </div>
        <div className="flex flex-col items-center py-6 text-gray-500 dark:text-zinc-600">
          <Network className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-xs">No agent interactions yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Network className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
        <h2 className="section-title mb-0">Agent Graph</h2>
      </div>
      <div className="relative rounded-xl bg-gray-50 dark:bg-zinc-950/60 border border-gray-200 dark:border-zinc-800/40 p-4 min-h-[120px]">
        {entries.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-3">
            {entries.map(([name, status]) => {
              const Icon = statusIcons[status.status] || Clock;
              const colorClass = statusColors[status.status] || statusColors.idle;
              return (
                <div key={name} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${colorClass} transition-all duration-200`}>
                  <Icon className={`h-3.5 w-3.5 ${status.status === "running" ? "animate-pulse" : ""}`} />
                  <div>
                    <p className="text-xs font-medium">{name}</p>
                    <p className="text-[9px] uppercase tracking-wider opacity-70">{status.status}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {edges.length > 0 && (
          <div className="space-y-1.5 border-t border-gray-200 dark:border-zinc-800/40 pt-3">
            <p className="text-[9px] text-gray-500 dark:text-zinc-600 uppercase tracking-wider mb-1">Interactions</p>
            {edges.slice(0, 20).map(edge => (
              <div key={edge.key} className="flex items-center gap-2 text-[10px]">
                <span className="font-medium text-gray-700 dark:text-zinc-300">{edge.from}</span>
                <ArrowRight className="h-2.5 w-2.5 text-gray-400 dark:text-zinc-600" />
                <span className="font-medium text-gray-700 dark:text-zinc-300">{edge.to}</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                  edge.label === "handoff" ? "bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400" : "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400"
                }`}>{edge.label}</span>
                <span className={`text-[9px] ${edge.status === "completed" ? "text-emerald-600 dark:text-emerald-400" : edge.status === "error" ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}`}>{edge.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
})
