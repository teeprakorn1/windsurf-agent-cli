"use client";

import type { Activity as ActivityType, AgentStatus } from "@/lib/types";
import { X, Zap, MessageSquare, Activity as ActivityIcon, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { MarkdownRenderer } from "@/components/markdown-renderer";

interface AgentInspectorProps {
  agentName: string;
  status: AgentStatus;
  activities: Record<string, ActivityType>;
  onClose: () => void;
  formatAgentSince: (since: number) => string;
}

export function AgentInspector({ agentName, status, activities, onClose, formatAgentSince }: AgentInspectorProps) {
  const runId = status.runId;
  const activity = runId ? activities[runId] : undefined;
  const steps = activity?.steps;
  const completion = activity?.completions[activity.completions.length - 1];
  const cfg = { running: { icon: ActivityIcon, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", gradient: "from-blue-500/5 to-cyan-500/5", label: "Running" }, completed: { icon: CheckCircle, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", gradient: "from-emerald-500/5 to-green-500/5", label: "Completed" }, error: { icon: AlertTriangle, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", gradient: "from-red-500/5 to-orange-500/5", label: "Error" }, idle: { icon: Clock, color: "text-gray-600 dark:text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20", gradient: "from-zinc-500/5 to-gray-500/5", label: "Idle" } }[status.status] ?? { icon: Clock, color: "text-gray-600 dark:text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20", gradient: "from-zinc-500/5 to-gray-500/5", label: status.status };
  const I = cfg.icon;
  return (
    <div className="flex-1 overflow-y-auto">
      <div className={`bg-gradient-to-br ${cfg.gradient} border-b ${cfg.border} px-6 py-5`}>
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`flex items-center justify-center h-12 w-12 rounded-2xl ${cfg.bg} border ${cfg.border} shadow-sm`}>
              <I className={`h-6 w-6 ${cfg.color}`} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100">{agentName}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${cfg.bg} ${cfg.color} ${cfg.border} border`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                  {cfg.label}
                </span>
                {status.since && (
                  <span className="text-[10px] text-gray-500 dark:text-zinc-500">{formatAgentSince(status.since)}</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/50 dark:hover:bg-zinc-800/50 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-zinc-700">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="max-w-xl mx-auto p-6 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30">
            <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">Status</p>
            <p className="text-sm font-semibold text-gray-800 dark:text-zinc-300 capitalize">{status.status}</p>
          </div>
          <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30">
            <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">Since</p>
            <p className="text-sm font-semibold text-gray-800 dark:text-zinc-300">{status.since ? new Date(status.since).toLocaleTimeString() : "—"}</p>
          </div>
        </div>
        {runId && (
          <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30">
            <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">Run ID</p>
            <p className="font-mono text-xs text-gray-800 dark:text-zinc-300 truncate" title={runId}>{runId.length > 24 ? `${runId.slice(0, 12)}…${runId.slice(-8)}` : runId}</p>
          </div>
        )}

        {steps && steps.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Steps ({steps.length})</p>
            </div>
            <div className="space-y-1.5">
              {steps.slice(-5).map((s: { step: number; thought: string | null; error: string | null }, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30">
                  <span className="font-mono text-[11px] text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">#{s.step}</span>
                  <span className="text-xs text-gray-800 dark:text-zinc-300 flex-1 break-words">{s.thought ? s.thought.slice(0, 120) : s.error ? <span className="text-red-500">Error: {s.error.slice(0, 60)}</span> : `Step ${s.step}`}</span>
                </div>
              ))}
              {steps.length > 5 && <p className="text-[11px] text-gray-400 dark:text-zinc-600 text-center">+{steps.length - 5} more steps</p>}
            </div>
          </div>
        )}

        {completion?.content && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
              <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Output</p>
            </div>
            <MarkdownRenderer content={completion.content} className="text-sm text-gray-700 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-800/30 rounded-xl px-4 py-3 overflow-x-auto max-h-64 border border-gray-200 dark:border-zinc-700/40" />
          </div>
        )}

        {completion?.usage && (
          <div className="rounded-xl px-4 py-3 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 border border-blue-500/10 dark:border-blue-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-3.5 w-3.5 text-blue-500" />
              <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Token Usage</p>
            </div>
            <div className="flex items-baseline gap-5">
              {completion.usage.promptTokens != null && <div className="flex items-baseline gap-1.5"><span className="text-[11px] text-gray-400 dark:text-zinc-500">Prompt</span><span className="text-sm font-bold text-gray-800 dark:text-zinc-200">{completion.usage.promptTokens.toLocaleString()}</span></div>}
              {completion.usage.completionTokens != null && <div className="flex items-baseline gap-1.5"><span className="text-[11px] text-gray-400 dark:text-zinc-500">Comp</span><span className="text-sm font-bold text-gray-800 dark:text-zinc-200">{completion.usage.completionTokens.toLocaleString()}</span></div>}
              {completion.usage.totalTokens != null && <div className="flex items-baseline gap-1.5"><span className="text-[11px] text-gray-400 dark:text-zinc-500">Total</span><span className="text-sm font-bold text-blue-600 dark:text-blue-400">{completion.usage.totalTokens.toLocaleString()}</span></div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
