"use client";

import { memo } from "react";
import { useWs } from "@/lib/ws-context";
import type { RunStep } from "@/lib/types";
import { ChevronRight, Wrench, Brain, Clock, Zap, CheckCircle2, AlertTriangle } from "lucide-react";

function formatDuration(ms: number | null): string {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StepEntry({ step, index, total }: { step: RunStep; index: number; total: number }) {
  const isLast = index === total - 1;
  return (
    <div className="flex gap-3 py-1.5">
      <div className="flex flex-col items-center">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold transition-all duration-200
          ${step.error ? "bg-red-500/20 text-red-500 dark:text-red-400 border border-red-500/20" : "bg-zinc-200 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700/50"}`}>
          {index + 1}
        </div>
        {!isLast && <div className="w-px flex-1 bg-gradient-to-b from-zinc-300 dark:from-zinc-700/50 to-zinc-200 dark:to-zinc-800/30 my-1" />}
      </div>
      <div className="flex-1 min-w-0 pb-2">
        {step.thought && (
          <div className="flex items-start gap-2 mb-1.5">
            <Brain className="h-3 w-3 text-violet-600 dark:text-violet-400 mt-0.5 shrink-0" />
            <p className="text-xs text-gray-800 dark:text-zinc-300 leading-relaxed">{step.thought}</p>
          </div>
        )}
        {step.toolCalls && step.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {step.toolCalls.map((tc, i) => (
              <span key={i} className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-mono border
                ${tc.error ? "bg-red-500/10 text-red-500 dark:text-red-400 border-red-500/20" : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"}`}>
                <Wrench className="h-2.5 w-2.5" />
                {tc.tool}
              </span>
            ))}
          </div>
        )}
        {step.result && (
          <pre className="text-[10px] text-gray-700 dark:text-zinc-500 bg-gray-50 dark:bg-zinc-900/60 rounded-lg px-3 py-2 overflow-x-auto max-h-20 mt-1 border border-gray-200 dark:border-zinc-800/40">
            {step.result.length > 300 ? step.result.slice(0, 300) + "..." : step.result}
          </pre>
        )}
        {step.error && (
          <div className="flex items-center gap-1.5 mt-1 text-red-700 dark:text-red-400">
            <AlertTriangle className="h-3 w-3" />
            <p className="text-xs">{step.error}</p>
          </div>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <Clock className="h-2.5 w-2.5 text-gray-500 dark:text-zinc-600" />
          <span className="text-[10px] text-gray-500 dark:text-zinc-600">{formatDuration(step.duration_ms)}</span>
        </div>
      </div>
    </div>
  );
}

export const ExecutionTimeline = memo(function ExecutionTimeline() {
  const { runs, completedRuns, connected } = useWs();
  const runEntries = Object.entries(runs);

  if (runEntries.length === 0) {
    return (
      <div className="glass-card p-4">
        <h2 className="section-title">Execution Timeline</h2>
        <div className="flex flex-col items-center py-8 text-gray-500 dark:text-zinc-600">
          <Zap className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-xs">{connected ? "No active runs" : "Connecting..."}</p>
          <p className="text-[10px] text-gray-400 dark:text-zinc-700">{connected ? "Start a run to see the timeline" : "Waiting for WebSocket connection"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-4">
      <h2 className="section-title">Execution Timeline</h2>
      <div className="space-y-5">
        {runEntries.map(([runId, steps]) => {
          const completed = completedRuns[runId];
          const isActive = !completed;
          return (
            <div key={runId} className="animate-slide-in">
              <div className="flex items-center gap-2 mb-3">
                <div className={`h-2 w-2 rounded-full ${isActive ? "bg-blue-500 dark:bg-blue-400 animate-pulse" : "bg-zinc-400 dark:bg-zinc-600"}`} />
                <span className="text-xs font-mono text-zinc-500">{runId}</span>
                {completed && (
                  <span className={completed.status === "completed" ? "badge-completed" : completed.status === "error" || completed.status === "max_steps" ? "badge-error" : "badge-idle"}>
                    {completed.status === "completed" && <CheckCircle2 className="h-2.5 w-2.5" />}
                    {(completed.status === "error" || completed.status === "max_steps") && <AlertTriangle className="h-2.5 w-2.5" />}
                    {completed.status === "max_steps" ? "max steps" : completed.status}
                  </span>
                )}
                {isActive && <span className="badge-running"><ChevronRight className="h-2.5 w-2.5" />Running</span>}
              </div>
              {steps.map((step, i) => (
                <StepEntry key={`${runId}-${step.step}-${step.timestamp}`} step={step} index={i} total={steps.length} />
              ))}
              {completed?.output && (
                <div className="mt-3 rounded-lg bg-gray-50 dark:bg-zinc-900/60 border border-gray-200 dark:border-zinc-800/40 p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Output</p>
                  <p className="text-xs text-gray-900 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">{completed.output}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
