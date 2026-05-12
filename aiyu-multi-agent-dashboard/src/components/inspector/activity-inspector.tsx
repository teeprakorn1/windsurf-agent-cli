"use client";

import type { Activity as ActivityType } from "@/lib/types";
import { X, Zap, MessageSquare, Activity as ActivityIcon, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { MarkdownRenderer } from "@/components/markdown-renderer";

interface ActivityInspectorProps {
  activityId: string;
  activity: ActivityType;
  onClose: () => void;
  formatAgentSince: (since: number) => string;
}

export function ActivityInspector({ activityId, activity, onClose, formatAgentSince }: ActivityInspectorProps) {
  const steps = activity.steps;
  const completion = activity.completions[activity.completions.length - 1];
  const usage = activity.usage;
  const isActive = activity.status === "running" || activity.status === "idle";
  const statusCfg = isActive
    ? { icon: ActivityIcon, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", gradient: "from-blue-500/5 to-cyan-500/5", label: "Running" }
    : activity.status === "completed"
    ? { icon: CheckCircle, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", gradient: "from-emerald-500/5 to-green-500/5", label: "Completed" }
    : (activity.status === "error" || activity.status === "max_steps")
    ? { icon: AlertTriangle, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", gradient: "from-red-500/5 to-orange-500/5", label: activity.status === "max_steps" ? "Max Steps" : "Error" }
    : { icon: Clock, color: "text-gray-600 dark:text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20", gradient: "from-zinc-500/5 to-gray-500/5", label: activity.status };
  const SI = statusCfg.icon;
  return (
    <div className="flex-1 overflow-y-auto">
      <div className={`bg-gradient-to-br ${statusCfg.gradient} border-b ${statusCfg.border} px-6 py-5`}>
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`flex items-center justify-center h-12 w-12 rounded-2xl ${statusCfg.bg} border ${statusCfg.border} shadow-sm`}>
              <SI className={`h-6 w-6 ${statusCfg.color}`} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100">{activity.mode === "chat" ? "Chat" : "Run"}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border} border`}>
                  <span className={`h-1.5 w-1.5 rounded-full bg-current ${isActive ? "animate-pulse" : ""}`} />
                  {statusCfg.label}
                </span>
                {activity.mode === "chat" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20">chat</span>}
                <span className="text-[10px] text-gray-500 dark:text-zinc-500">{steps.length} steps</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/50 dark:hover:bg-zinc-800/50 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-zinc-700">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="max-w-xl mx-auto p-6 space-y-5">
        <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30">
          <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">Activity ID</p>
          <p className="font-mono text-xs text-gray-800 dark:text-zinc-300 break-all">{activityId}</p>
        </div>
        {steps.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Steps ({steps.length})</p>
            </div>
            <div className="space-y-1.5">
              {steps.slice(-8).map((s: { step: number; thought: string | null; error: string | null; duration_ms: number | null }, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30">
                  <span className="font-mono text-[11px] text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">#{s.step}</span>
                  <span className="text-xs text-gray-800 dark:text-zinc-300 flex-1 break-words">{s.thought ? s.thought.slice(0, 120) : s.error ? <span className="text-red-500">Error: {s.error.slice(0, 60)}</span> : `Step ${s.step}`}</span>
                  {s.duration_ms != null && <span className="text-[10px] text-gray-400 dark:text-zinc-500 shrink-0">{formatAgentSince(s.duration_ms)}</span>}
                </div>
              ))}
              {steps.length > 8 && <p className="text-[11px] text-gray-400 dark:text-zinc-600 text-center">+{steps.length - 8} more steps</p>}
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
        {usage && (
          <div className="rounded-xl px-4 py-3 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 border border-blue-500/10 dark:border-blue-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-3.5 w-3.5 text-blue-500" />
              <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Token Usage</p>
            </div>
            <div className="flex items-baseline gap-5">
              {usage.promptTokens != null && <div className="flex items-baseline gap-1.5"><span className="text-[11px] text-gray-400 dark:text-zinc-500">Prompt</span><span className="text-sm font-bold text-gray-800 dark:text-zinc-200">{usage.promptTokens.toLocaleString()}</span></div>}
              {usage.completionTokens != null && <div className="flex items-baseline gap-1.5"><span className="text-[11px] text-gray-400 dark:text-zinc-500">Comp</span><span className="text-sm font-bold text-gray-800 dark:text-zinc-200">{usage.completionTokens.toLocaleString()}</span></div>}
              {usage.totalTokens != null && <div className="flex items-baseline gap-1.5"><span className="text-[11px] text-gray-400 dark:text-zinc-500">Total</span><span className="text-sm font-bold text-blue-600 dark:text-blue-400">{usage.totalTokens.toLocaleString()}</span></div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
