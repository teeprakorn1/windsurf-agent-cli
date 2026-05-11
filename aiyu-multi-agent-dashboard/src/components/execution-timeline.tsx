"use client";

import { memo } from "react";
import { useWs } from "@/lib/ws-context";
import type { ActivityStep } from "@/lib/types";
import { CheckCircle2, ChevronDown, Zap, Activity } from "lucide-react";

function formatDuration(ms: number | null): string {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StepEntry({ step, index, onOpen }: { step: ActivityStep; index: number; onOpen: () => void }) {
  const hasError = !!step.error;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-2 rounded px-2 py-1 text-left hover:bg-gray-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
    >
      <span className={`font-mono text-[9px] w-4 text-center shrink-0 ${hasError ? "text-red-500" : "text-gray-400 dark:text-zinc-500"}`}>{index + 1}</span>
      <span className="text-[10px] text-gray-800 dark:text-zinc-300 truncate flex-1 leading-tight">
        {step.thought ? step.thought.slice(0, 50) : step.error ? <span className="text-red-500">Error: {step.error.slice(0, 25)}</span> : `Step ${index + 1}`}
      </span>
      {step.toolCalls && step.toolCalls.length > 0 && (
        <span className="text-[8px] text-blue-500 dark:text-blue-400 shrink-0">+{step.toolCalls.length}</span>
      )}
      <span className="text-[8px] text-gray-400 dark:text-zinc-600 shrink-0">{formatDuration(step.duration_ms)}</span>
    </button>
  );
}

interface ExecutionTimelineProps {
  onInspectActivity?: (activityId: string | null) => void;
  activeActivity?: string | null;
}

export const ExecutionTimeline = memo(function ExecutionTimeline({ onInspectActivity, activeActivity }: ExecutionTimelineProps) {
  const activities = useWs(s => s.activities);
  const connected = useWs(s => s.connected);

  const activityEntries = Object.entries(activities ?? {})
    .filter(([, a]) => a.steps.length > 0 || a.completions.length > 0);

  if (activityEntries.length === 0) {
    return (
      <div className="glass-card p-3">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />
          <h2 className="section-title text-[10px] mb-0">Timeline</h2>
        </div>
        <div className="flex flex-col items-center py-3 text-gray-500 dark:text-zinc-600">
          <Activity className="h-5 w-5 mb-1 opacity-30" />
          <p className="text-[10px]">{connected ? "No runs yet" : "Connecting..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />
          <h2 className="section-title text-[10px] mb-0">Timeline</h2>
          <span className="text-[9px] text-gray-400 dark:text-zinc-600">{activityEntries.length}</span>
        </div>
      </div>
      <div className="space-y-2">
        {activityEntries.map(([activityId, activity]) => {
          const isActive = activity.status === "running" || activity.status === "idle";
          const lastCompletion = activity.completions[activity.completions.length - 1];
          const isInspected = activeActivity === activityId;
          const statusDot = isActive ? "bg-blue-500 animate-pulse" : activity.status === "completed" ? "bg-emerald-500" : (activity.status === "error" || activity.status === "max_steps") ? "bg-red-500" : "bg-zinc-400";
          return (
            <div key={activityId}>
              <button
                type="button"
                onClick={() => onInspectActivity?.(activityId)}
                className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 border transition-all duration-200 cursor-pointer text-left ${isInspected ? "bg-blue-50 dark:bg-blue-500/5 ring-1 ring-blue-500/20 border-transparent" : "border-gray-200 dark:border-zinc-700/40 hover:border-zinc-400 dark:hover:border-zinc-500/60"}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusDot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-gray-900 dark:text-zinc-200 truncate leading-tight">{activity.agentName || (activityId.length > 20 ? `${activityId.slice(0, 10)}…${activityId.slice(-6)}` : activityId)}</p>
                  <div className="flex items-center gap-1.5 text-[8px]">
                    {activity.mode === "chat" && <span className="px-1 py-0 rounded bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400">chat</span>}
                    <span className="text-gray-400 dark:text-zinc-600">{activity.steps.length} steps</span>
                  </div>
                </div>
                <ChevronDown className="h-3 w-3 text-gray-400 dark:text-zinc-600 shrink-0" />
              </button>
              <div className="ml-3 border-l-2 border-gray-200 dark:border-zinc-700/40 pl-2 space-y-0.5 mt-0.5">
                {activity.steps.slice(-5).map((step, i) => (
                  <StepEntry key={`${activityId}-step-${step.step}-${i}`} step={step} index={activity.steps.length > 5 ? activity.steps.length - 5 + i : i} onOpen={() => onInspectActivity?.(activityId)} />
                ))}
                {activity.steps.length > 5 && <p className="text-[8px] text-gray-400 dark:text-zinc-600 pl-6">+{activity.steps.length - 5} earlier</p>}
                {lastCompletion?.content && (
                  <button
                    type="button"
                    onClick={() => onInspectActivity?.(activityId)}
                    className="w-full flex items-center gap-2 rounded px-2 py-1 text-left hover:bg-emerald-50 dark:hover:bg-emerald-500/5 transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
                    <span className="text-[9px] text-emerald-700 dark:text-emerald-400 truncate flex-1">{lastCompletion.content.slice(0, 35)}…</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
