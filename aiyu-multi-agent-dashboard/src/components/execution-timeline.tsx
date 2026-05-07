"use client";

import { memo, useState } from "react";
import { useWs } from "@/lib/ws-context";
import type { RunStep } from "@/lib/types";
import { ChevronRight, Wrench, Brain, Clock, Zap, CheckCircle2, AlertTriangle, ChevronDown, X, Copy, Check } from "lucide-react";

function formatDuration(ms: number | null): string {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500 dark:text-zinc-500">{label}</span>
      <span className="font-medium text-gray-800 dark:text-zinc-300 text-right break-all">{value}</span>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
      className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
      aria-label="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function StepEntry({ step, index, total }: { step: RunStep; index: number; total: number }) {
  const isLast = index === total - 1;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex gap-3 py-1.5">
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className={`flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold transition-all duration-200 cursor-pointer
          ${step.error ? "bg-red-500/20 text-red-500 dark:text-red-400 border border-red-500/20" : "bg-zinc-200 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700/50"}
          ${expanded ? "ring-2 ring-blue-500 dark:ring-blue-400" : "hover:ring-1 hover:ring-blue-300 dark:hover:ring-blue-500/50"}`}
        >
          {index + 1}
        </button>
        {!isLast && <div className="w-px flex-1 bg-gradient-to-b from-zinc-300 dark:from-zinc-700/50 to-zinc-200 dark:to-zinc-800/30 my-1" />}
      </div>
      <div className="flex-1 min-w-0 pb-2">
        <button type="button" onClick={() => setExpanded(!expanded)} className="w-full text-left cursor-pointer">
          {step.thought && (
            <div className="flex items-start gap-2 mb-1.5">
              <Brain className="h-3 w-3 text-cyan-600 dark:text-cyan-400 mt-0.5 shrink-0" />
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
          {!expanded && step.result && (
            <pre className="text-[10px] text-gray-700 dark:text-zinc-500 bg-gray-50 dark:bg-zinc-900/60 rounded-lg px-3 py-2 overflow-x-auto max-h-20 mt-1 border border-gray-200 dark:border-zinc-800/40">
              {step.result.length > 300 ? step.result.slice(0, 300) + "..." : step.result}
            </pre>
          )}
          {!expanded && step.error && (
            <div className="flex items-center gap-1.5 mt-1 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-3 w-3" />
              <p className="text-xs">{step.error}</p>
            </div>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <Clock className="h-2.5 w-2.5 text-gray-500 dark:text-zinc-600" />
            <span className="text-[10px] text-gray-500 dark:text-zinc-600">{formatDuration(step.duration_ms)}</span>
            <ChevronDown className={`h-2.5 w-2.5 text-gray-400 dark:text-zinc-600 ml-auto transition-transform ${expanded ? "rotate-180" : ""}`} />
          </div>
        </button>

        {expanded && (
          <div className="mt-2 p-3 rounded-lg bg-white dark:bg-zinc-900/80 border border-gray-200 dark:border-zinc-700/60 space-y-2 text-[11px] animate-slide-in">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-gray-900 dark:text-zinc-100">Step {index + 1}</span>
              <button type="button" onClick={() => setExpanded(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300"><X className="h-3 w-3" /></button>
            </div>
            <DetailRow label="Step #" value={String(step.step)} />
            <DetailRow label="Duration" value={formatDuration(step.duration_ms)} />
            <DetailRow label="Timestamp" value={step.timestamp ? new Date(step.timestamp).toLocaleTimeString() : "—"} />
            {step.thought && (
              <div className="pt-2 mt-2 border-t border-gray-200 dark:border-zinc-700/60">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-gray-500 dark:text-zinc-500 uppercase tracking-wider">Thought</span>
                  <CopyButton text={step.thought} />
                </div>
                <p className="text-xs text-gray-800 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">{step.thought}</p>
              </div>
            )}
            {step.action && Object.keys(step.action).length > 0 && (
              <div className="pt-2 mt-2 border-t border-gray-200 dark:border-zinc-700/60">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-gray-500 dark:text-zinc-500 uppercase tracking-wider">Action</span>
                  <CopyButton text={JSON.stringify(step.action, null, 2)} />
                </div>
                <pre className="text-[10px] text-gray-700 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-950/60 rounded-lg px-3 py-2 overflow-x-auto max-h-40 border border-gray-200 dark:border-zinc-800/40">
                  {JSON.stringify(step.action, null, 2)}
                </pre>
              </div>
            )}
            {step.toolCalls && step.toolCalls.length > 0 && (
              <div className="pt-2 mt-2 border-t border-gray-200 dark:border-zinc-700/60">
                <span className="text-[9px] text-gray-500 dark:text-zinc-500 uppercase tracking-wider">Tool Calls</span>
                {step.toolCalls.map((tc, i) => (
                  <div key={i} className="mt-1.5 flex items-center gap-2">
                    <Wrench className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                    <span className="font-mono text-blue-600 dark:text-blue-400">{tc.tool}</span>
                    {tc.duration_ms != null && <span className="text-gray-500 dark:text-zinc-500">{formatDuration(tc.duration_ms)}</span>}
                    {tc.error && <span className="text-red-500 dark:text-red-400 text-[10px]">{tc.error}</span>}
                  </div>
                ))}
              </div>
            )}
            {step.result && (
              <div className="pt-2 mt-2 border-t border-gray-200 dark:border-zinc-700/60">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-gray-500 dark:text-zinc-500 uppercase tracking-wider">Result</span>
                  <CopyButton text={step.result} />
                </div>
                <pre className="text-[10px] text-gray-700 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-950/60 rounded-lg px-3 py-2 overflow-x-auto max-h-60 border border-gray-200 dark:border-zinc-800/40 whitespace-pre-wrap">
                  {step.result}
                </pre>
              </div>
            )}
            {step.error && (
              <div className="pt-2 mt-2 border-t border-red-200 dark:border-red-500/20">
                <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400">
                  <AlertTriangle className="h-3 w-3" />
                  <span className="text-[9px] uppercase tracking-wider">Error</span>
                </div>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1 whitespace-pre-wrap">{step.error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const ExecutionTimeline = memo(function ExecutionTimeline() {
  const { runs, completedRuns, connected } = useWs();
  const runEntries = Object.entries(runs);
  const [expandedComplete, setExpandedComplete] = useState<string | null>(null);

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
          const isCompleteExpanded = expandedComplete === runId;
          const usage = completed?.usage as Record<string, number> | null;
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
                {completed && <span className="text-[9px] text-gray-400 dark:text-zinc-600">{steps.length} steps</span>}
              </div>
              {steps.map((step, i) => (
                <StepEntry key={`${runId}-step-${step.step}-${i}`} step={step} index={i} total={steps.length} />
              ))}
              {completed?.output && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setExpandedComplete(isCompleteExpanded ? null : runId)}
                    className="w-full rounded-lg bg-gray-50 dark:bg-zinc-900/60 border border-gray-200 dark:border-zinc-800/40 p-3 text-left cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-900/80 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Output</p>
                      <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform ${isCompleteExpanded ? "rotate-180" : ""}`} />
                    </div>
                    {!isCompleteExpanded && (
                      <p className="text-xs text-gray-900 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed mt-1 line-clamp-3">{completed.output}</p>
                    )}
                  </button>
                  {isCompleteExpanded && (
                    <div className="p-3 rounded-b-lg bg-white dark:bg-zinc-900/80 border border-t-0 border-gray-200 dark:border-zinc-700/60 space-y-2 text-[11px] animate-slide-in">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-gray-900 dark:text-zinc-100">Run Complete</span>
                        <button type="button" onClick={() => setExpandedComplete(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300"><X className="h-3 w-3" /></button>
                      </div>
                      <DetailRow label="Status" value={completed.status} />
                      <DetailRow label="Steps" value={String(steps.length)} />
                      <DetailRow label="Completed" value={new Date(completed.completedAt).toLocaleTimeString()} />
                      {usage && (
                        <div className="pt-2 mt-2 border-t border-gray-200 dark:border-zinc-700/60">
                          <p className="text-[9px] text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-1">Token Usage</p>
                          <div className="grid grid-cols-3 gap-2">
                            {usage.promptTokens != null && <div className="bg-blue-50 dark:bg-blue-500/10 rounded-lg px-2 py-1.5 text-center"><p className="text-[9px] text-gray-500 dark:text-zinc-500">Prompt</p><p className="text-xs font-bold text-blue-700 dark:text-blue-400">{usage.promptTokens}</p></div>}
                            {usage.completionTokens != null && <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-lg px-2 py-1.5 text-center"><p className="text-[9px] text-gray-500 dark:text-zinc-500">Completion</p><p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{usage.completionTokens}</p></div>}
                            {usage.totalTokens != null && <div className="bg-cyan-50 dark:bg-cyan-500/10 rounded-lg px-2 py-1.5 text-center"><p className="text-[9px] text-gray-500 dark:text-zinc-500">Total</p><p className="text-xs font-bold text-cyan-700 dark:text-cyan-400">{usage.totalTokens}</p></div>}
                          </div>
                        </div>
                      )}
                      <div className="pt-2 mt-2 border-t border-gray-200 dark:border-zinc-700/60">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[9px] text-gray-500 dark:text-zinc-500 uppercase tracking-wider">Full Output</p>
                          <CopyButton text={completed.output || ""} />
                        </div>
                        <pre className="text-xs text-gray-900 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">{completed.output}</pre>
                      </div>
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
});
