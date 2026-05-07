"use client";

import { memo, useState, useMemo } from "react";
import { useWs } from "@/lib/ws-context";
import { Activity, CheckCircle, AlertCircle, Clock, Network, ArrowRight, ChevronDown, X } from "lucide-react";
import type { AgentStatus } from "@/lib/types";

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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500 dark:text-zinc-500">{label}</span>
      <span className="font-medium text-gray-800 dark:text-zinc-300 text-right break-all">{value}</span>
    </div>
  );
}

export const InteractionMap = memo(function InteractionMap() {
  const { agentStatuses, handoffs, delegates } = useWs();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);

  // Auto-add agent nodes from edge data when missing from agentStatuses
  const enrichedStatuses = useMemo<Record<string, AgentStatus>>(() => {
    const statuses: Record<string, AgentStatus> = { ...agentStatuses };
    const edgeList = [
      ...handoffs.map(h => ({ from: h.fromAgent, to: h.toAgent, label: "handoff" as const, status: h.status, key: `h-${h.handoffId}`, id: h.handoffId, artifacts: h.artifacts, pendingTasks: h.pendingTasks, timestamp: h.timestamp })),
      ...delegates.map(d => ({ from: d.parentAgent, to: d.childAgent, label: "delegate" as const, status: d.status, key: `d-${d.runId}`, id: d.runId, depth: d.depth, timestamp: d.timestamp })),
    ];
    for (const edge of edgeList) {
      if (edge.from && !statuses[edge.from]) statuses[edge.from] = { status: "idle", runId: null, since: Date.now() };
      if (edge.to && !statuses[edge.to]) statuses[edge.to] = { status: "idle", runId: null, since: Date.now() };
    }
    return statuses;
  }, [agentStatuses, handoffs, delegates]);

  const edges = useMemo(() => [
    ...handoffs.map(h => ({ from: h.fromAgent, to: h.toAgent, label: "handoff" as const, status: h.status, key: `h-${h.handoffId}`, id: h.handoffId, artifacts: h.artifacts, pendingTasks: h.pendingTasks, timestamp: h.timestamp })),
    ...delegates.map(d => ({ from: d.parentAgent, to: d.childAgent, label: "delegate" as const, status: d.status, key: `d-${d.runId}`, id: d.runId, depth: d.depth, timestamp: d.timestamp })),
  ], [handoffs, delegates]);
  const entries = Object.entries(enrichedStatuses);

  const selectedStatus = selectedAgent ? enrichedStatuses[selectedAgent] : null;
  const selectedEdgeData = selectedEdge ? edges.find((e: typeof edges[number]) => e.key === selectedEdge) : null;
  const agentEdges = selectedAgent ? edges.filter((e: typeof edges[number]) => e.from === selectedAgent || e.to === selectedAgent) : [];

  if (entries.length === 0 && edges.length === 0) {
    return (
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Network className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
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
        <Network className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
        <h2 className="section-title mb-0">Agent Graph</h2>
      </div>
      <div className="relative rounded-xl bg-gray-50 dark:bg-zinc-950/60 border border-gray-200 dark:border-zinc-800/40 p-4 min-h-[120px]">
        {entries.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-3">
            {entries.map(([name, status]: [string, AgentStatus]) => {
              const Icon = statusIcons[status.status] || Clock;
              const colorClass = statusColors[status.status] || statusColors.idle;
              const isSelected = selectedAgent === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSelectedAgent(isSelected ? null : name)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-all duration-200 cursor-pointer text-left ${colorClass} ${isSelected ? "ring-2 ring-blue-500 dark:ring-blue-400 shadow-md" : "hover:shadow-sm"}`}
                >
                  <Icon className={`h-3.5 w-3.5 ${status.status === "running" ? "animate-pulse" : ""}`} />
                  <div>
                    <p className="text-xs font-medium">{name}</p>
                    <p className="text-[9px] uppercase tracking-wider opacity-70">{status.status}</p>
                  </div>
                  <ChevronDown className={`h-3 w-3 opacity-50 transition-transform ${isSelected ? "rotate-180" : ""}`} />
                </button>
              );
            })}
          </div>
        )}
        {selectedAgent && selectedStatus && (
          <div className="mb-3 p-3 rounded-lg bg-white dark:bg-zinc-900/80 border border-gray-200 dark:border-zinc-700/60 space-y-1.5 text-[11px] animate-slide-in">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-gray-900 dark:text-zinc-100">{selectedAgent}</span>
              <button type="button" onClick={() => setSelectedAgent(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300"><X className="h-3 w-3" /></button>
            </div>
            <DetailRow label="Status" value={selectedStatus.status} />
            <DetailRow label="Run ID" value={selectedStatus.runId || "—"} />
            <DetailRow label="Since" value={new Date(selectedStatus.since).toLocaleTimeString()} />
            {agentEdges.length > 0 && (
              <div className="pt-2 mt-2 border-t border-gray-200 dark:border-zinc-700/60">
                <p className="text-[9px] text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-1">Related Interactions</p>
                {agentEdges.slice(0, 10).map(edge => (
                  <button key={edge.key} type="button" onClick={() => setSelectedEdge(selectedEdge === edge.key ? null : edge.key)} className="flex items-center gap-1.5 w-full text-left hover:bg-gray-50 dark:hover:bg-zinc-800/40 rounded px-1 py-0.5">
                    <span className="font-medium">{edge.from}</span>
                    <ArrowRight className="h-2 w-2 text-gray-400" />
                    <span className="font-medium">{edge.to}</span>
                    <span className={`px-1 py-0.5 rounded text-[9px] ${edge.label === "handoff" ? "bg-cyan-100 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400" : "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}>{edge.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {edges.length > 0 && (
          <div className="space-y-1.5 border-t border-gray-200 dark:border-zinc-800/40 pt-3">
            <p className="text-[9px] text-gray-500 dark:text-zinc-600 uppercase tracking-wider mb-1">Interactions</p>
            {edges.slice(0, 20).map(edge => {
              const isSelected = selectedEdge === edge.key;
              return (
                <button
                  key={edge.key}
                  type="button"
                  onClick={() => setSelectedEdge(isSelected ? null : edge.key)}
                  className={`flex items-center gap-2 text-[10px] w-full text-left rounded px-1 py-0.5 transition-colors cursor-pointer ${isSelected ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-gray-100 dark:hover:bg-zinc-800/40"}`}
                >
                  <span className="font-medium text-gray-700 dark:text-zinc-300">{edge.from}</span>
                  <ArrowRight className="h-2.5 w-2.5 text-gray-400 dark:text-zinc-600" />
                  <span className="font-medium text-gray-700 dark:text-zinc-300">{edge.to}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                    edge.label === "handoff" ? "bg-cyan-100 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400" : "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  }`}>{edge.label}</span>
                  <span className={`text-[9px] ${edge.status === "completed" ? "text-emerald-600 dark:text-emerald-400" : edge.status === "error" ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}`}>{edge.status}</span>
                  <ChevronDown className={`h-2.5 w-2.5 ml-auto opacity-40 transition-transform ${isSelected ? "rotate-180" : ""}`} />
                </button>
              );
            })}
          </div>
        )}
        {selectedEdgeData && (
          <div className="mt-2 p-3 rounded-lg bg-white dark:bg-zinc-900/80 border border-gray-200 dark:border-zinc-700/60 space-y-1.5 text-[11px] animate-slide-in">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-gray-900 dark:text-zinc-100">{selectedEdgeData.label === "handoff" ? "Handoff" : "Delegate"}</span>
              <button type="button" onClick={() => setSelectedEdge(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300"><X className="h-3 w-3" /></button>
            </div>
            <DetailRow label="ID" value={selectedEdgeData.id} />
            <DetailRow label="From" value={selectedEdgeData.from} />
            <DetailRow label="To" value={selectedEdgeData.to} />
            <DetailRow label="Status" value={selectedEdgeData.status} />
            <DetailRow label="Time" value={selectedEdgeData.timestamp ? new Date(selectedEdgeData.timestamp).toLocaleTimeString() : "—"} />
            {"depth" in selectedEdgeData && <DetailRow label="Depth" value={String((selectedEdgeData as Record<string, unknown>).depth)} />}
            {"artifacts" in selectedEdgeData && <DetailRow label="Artifacts" value={String((selectedEdgeData as Record<string, unknown>).artifacts ?? 0)} />}
            {"pendingTasks" in selectedEdgeData && <DetailRow label="Pending" value={String((selectedEdgeData as Record<string, unknown>).pendingTasks ?? 0)} />}
          </div>
        )}
      </div>
    </div>
  );
})
