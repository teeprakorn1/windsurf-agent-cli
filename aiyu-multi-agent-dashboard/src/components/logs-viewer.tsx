"use client";

import { memo, useMemo, useRef, useState, useCallback, useEffect } from "react";
import { useWs } from "@/lib/ws-context";
import { MarkdownRenderer } from "./markdown-renderer";
import { Search, ChevronDown, FileText, Layers, Footprints, CheckCircle, AlertTriangle, ArrowRight, Users, X, Copy, Check, Wrench, Brain } from "lucide-react";

interface LogEntry {
  id: string;
  time: number;
  displayTime: string;
  type: "step" | "complete" | "error" | "handoff" | "delegate";
  runId?: string;
  message: string;
  raw: Record<string, unknown>;
}

const TYPE_OPTIONS: { value: string; label: string; icon: typeof Layers }[] = [
  { value: "all", label: "All", icon: Layers },
  { value: "step", label: "Steps", icon: Footprints },
  { value: "complete", label: "Complete", icon: CheckCircle },
  { value: "error", label: "Errors", icon: AlertTriangle },
  { value: "handoff", label: "Handoffs", icon: ArrowRight },
  { value: "delegate", label: "Delegates", icon: Users },
];

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
      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
      className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
      aria-label="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export const LogsViewer = memo(function LogsViewer() {
  const { runs, completedRuns, errors, handoffs, delegates } = useWs();
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [typeOpen, setTypeOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const typeRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (typeRef.current && !typeRef.current.contains(e.target as Node)) {
      setTypeOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClickOutside]);

  const logs = useMemo<LogEntry[]>(() => {
    const list: LogEntry[] = [];
    Object.entries(runs).forEach(([runId, steps]) => {
      steps.forEach((step) => {
        list.push({
          id: `step-${runId}-${step.step}-${step.timestamp}-${Math.random().toString(16).slice(2, 6)}`,
          time: step.timestamp,
          displayTime: new Date(step.timestamp).toLocaleTimeString(),
          type: "step",
          runId,
          message: step.thought ?? `Step ${step.step} completed`,
          raw: { step: step.step, thought: step.thought, result: step.result, error: step.error, duration_ms: step.duration_ms, toolCalls: step.toolCalls, action: step.action },
        });
      });
    });

    Object.entries(completedRuns).forEach(([runId, result]) => {
      list.push({
        id: `complete-${runId}-${result.completedAt}-${result.status}-${Math.random().toString(16).slice(2, 6)}`,
        time: result.completedAt,
        displayTime: new Date(result.completedAt).toLocaleTimeString(),
        type: "complete",
        runId,
        message: `Run completed: ${result.status}`,
        raw: { status: result.status, output: result.output, usage: result.usage },
      });
    });

    errors.forEach((err, idx) => {
      list.push({ id: `error-${err.time}-${idx}`, time: err.time, displayTime: new Date(err.time).toLocaleTimeString(), type: "error", message: err.message, raw: { message: err.message } });
    });

    handoffs.forEach((h) => {
      list.push({ id: `handoff-${h.handoffId}-${h.status}-${h.timestamp}`, time: h.timestamp, displayTime: new Date(h.timestamp).toLocaleTimeString(), type: "handoff", message: `Handoff: ${h.fromAgent} → ${h.toAgent} (${h.status})`, raw: { handoffId: h.handoffId, fromAgent: h.fromAgent, toAgent: h.toAgent, status: h.status, artifacts: h.artifacts, pendingTasks: h.pendingTasks } });
    });

    delegates.forEach((d) => {
      list.push({ id: `delegate-${d.runId}-${d.status}-${d.timestamp}`, time: d.timestamp, displayTime: new Date(d.timestamp).toLocaleTimeString(), type: "delegate", message: `Delegate: ${d.parentAgent} → ${d.childAgent} depth=${d.depth} (${d.status})`, raw: { runId: d.runId, parentAgent: d.parentAgent, childAgent: d.childAgent, depth: d.depth, status: d.status } });
    });

    list.sort((a, b) => b.time - a.time);
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs, completedRuns, errors, handoffs, delegates]);

  const filteredLogs = logs.filter((log) => {
    const matchesText = !filter || log.message.toLowerCase().includes(filter.toLowerCase()) || log.runId?.toLowerCase().includes(filter.toLowerCase());
    const matchesType = typeFilter === "all" || log.type === typeFilter;
    return matchesText && matchesType;
  });

  const typeStyles: Record<string, string> = {
    step: "text-blue-800 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20",
    complete: "text-emerald-800 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20",
    error: "text-red-800 dark:text-red-400 bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20",
    handoff: "text-cyan-800 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20",
    delegate: "text-amber-800 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20",
  };

  const typeIcons: Record<string, typeof Layers> = {
    step: Footprints,
    complete: CheckCircle,
    error: AlertTriangle,
    handoff: ArrowRight,
    delegate: Users,
  };

  const selectedLogEntry = selectedLog ? logs.find(l => l.id === selectedLog) : null;

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-3.5 w-3.5 text-gray-500 dark:text-zinc-400" />
        <h2 className="section-title mb-0">Logs</h2>
      </div>
      
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 dark:text-zinc-600" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search logs..."
            aria-label="Search logs"
            className="input-field pl-8 py-2 text-xs"
          />
        </div>
        <div ref={typeRef} className="relative">
          <button
            type="button"
            onClick={() => setTypeOpen(!typeOpen)}
            className="input-field text-xs py-1.5 pr-7 appearance-none flex items-center justify-between cursor-pointer"
            aria-label="Filter by log type"
            aria-expanded={typeOpen}
          >
            <span>{TYPE_OPTIONS.find(t => t.value === typeFilter)?.label || "All"}</span>
            <ChevronDown className={`h-3 w-3 text-gray-400 dark:text-zinc-500 shrink-0 transition-transform duration-200 ${typeOpen ? "rotate-180" : ""}`} />
          </button>
          {typeOpen && (
            <div className="absolute z-50 mt-1 right-0 w-44 dropdown-panel overflow-hidden animate-slide-in">
              <ul className="py-1">
                {TYPE_OPTIONS.map((opt) => {
                  const isSelected = typeFilter === opt.value;
                  return (
                    <li key={opt.value}>
                      <button
                        type="button"
                        onClick={() => { setTypeFilter(opt.value); setTypeOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors
                          ${isSelected ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-gray-50 dark:hover:bg-zinc-800"}`}
                      >
                        <opt.icon className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-blue-500" : "text-gray-400 dark:text-zinc-500"}`} />
                        <span className={`font-medium ${isSelected ? "text-blue-700 dark:text-blue-400" : "text-gray-900 dark:text-zinc-100"}`}>{opt.label}</span>
                        {isSelected && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="max-h-64 sm:max-h-48 overflow-y-auto space-y-1">
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center py-4 text-gray-500 dark:text-zinc-600">
            <FileText className="h-6 w-6 mb-1.5 opacity-30" />
            <p className="text-xs">No logs match your filter</p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isSelected = selectedLog === log.id;
            const TypeIcon = typeIcons[log.type] || FileText;
            return (
              <div key={log.id}>
                <button
                  type="button"
                  onClick={() => setSelectedLog(isSelected ? null : log.id)}
                  className={`w-full flex gap-2 text-[10px] py-1.5 border-b border-gray-100 dark:border-zinc-800/30 last:border-0 rounded px-1 transition-colors cursor-pointer text-left ${isSelected ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-gray-50 dark:hover:bg-zinc-800/20"}`}
                >
                  <span className="text-gray-500 dark:text-zinc-600 font-mono shrink-0">{log.displayTime}</span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 font-medium ${typeStyles[log.type]}`}>{log.type}</span>
                  {log.runId && <span className="text-gray-500 dark:text-zinc-600 font-mono truncate max-w-[80px] shrink-0">{log.runId}</span>}
                  <span className="text-gray-800 dark:text-zinc-400 truncate flex-1">{log.message}</span>
                  <ChevronDown className={`h-2.5 w-2.5 text-gray-400 dark:text-zinc-600 shrink-0 transition-transform ${isSelected ? "rotate-180" : ""}`} />
                </button>
                {isSelected && selectedLogEntry && (
                  <div className="p-3 rounded-lg bg-white dark:bg-zinc-900/80 border border-gray-200 dark:border-zinc-700/60 space-y-2 text-[11px] animate-slide-in">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <TypeIcon className="h-3.5 w-3.5 text-gray-500 dark:text-zinc-400" />
                        <span className="text-xs font-bold text-gray-900 dark:text-zinc-100 capitalize">{log.type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CopyButton text={JSON.stringify(selectedLogEntry.raw, null, 2)} />
                        <button type="button" onClick={() => setSelectedLog(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300"><X className="h-3 w-3" /></button>
                      </div>
                    </div>
                    <DetailRow label="Time" value={selectedLogEntry.displayTime} />
                    {selectedLogEntry.runId && <DetailRow label="Run ID" value={selectedLogEntry.runId} />}

                    {selectedLogEntry.type === "step" && (() => {
                      const raw = selectedLogEntry.raw as Record<string, unknown>;
                      return (
                        <>
                          <DetailRow label="Step #" value={String(raw.step ?? "—")} />
                          <DetailRow label="Duration" value={raw.duration_ms != null ? `${raw.duration_ms}ms` : "—"} />
                          {raw.thought && (
                            <div className="pt-2 mt-2 border-t border-gray-200 dark:border-zinc-700/60">
                              <div className="flex items-center gap-1 mb-1"><Brain className="h-3 w-3 text-cyan-500" /><span className="text-[9px] text-gray-500 uppercase tracking-wider">Thought</span></div>
                              <MarkdownRenderer content={String(raw.thought)} className="text-xs text-gray-800 dark:text-zinc-300" />
                            </div>
                          )}
                          {raw.toolCalls && Array.isArray(raw.toolCalls) && (raw.toolCalls as Array<Record<string, unknown>>).length > 0 && (
                            <div className="pt-2 mt-2 border-t border-gray-200 dark:border-zinc-700/60">
                              <span className="text-[9px] text-gray-500 uppercase tracking-wider">Tool Calls</span>
                              {(raw.toolCalls as Array<Record<string, unknown>>).map((tc, i) => (
                                <div key={i} className="flex items-center gap-1.5 mt-1">
                                  <Wrench className="h-3 w-3 text-blue-500" />
                                  <span className="font-mono text-blue-600 dark:text-blue-400">{String(tc.tool)}</span>
                                  {tc.duration_ms != null && <span className="text-gray-500">{String(tc.duration_ms)}ms</span>}
                                  {Boolean(tc.error) && <span className="text-red-500">{String(tc.error)}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                          {raw.result && (
                            <div className="pt-2 mt-2 border-t border-gray-200 dark:border-zinc-700/60">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[9px] text-gray-500 uppercase tracking-wider">Result</span>
                                <CopyButton text={String(raw.result)} />
                              </div>
                              <MarkdownRenderer content={String(raw.result)} className="text-[10px] text-gray-700 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-950/60 rounded px-2 py-1.5 overflow-x-auto max-h-40 border border-gray-200 dark:border-zinc-800/40" />
                            </div>
                          )}
                          {raw.error && (
                            <div className="pt-2 mt-2 border-t border-red-200 dark:border-red-500/20">
                              <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400"><AlertTriangle className="h-3 w-3" /><span className="text-[9px] uppercase tracking-wider">Error</span></div>
                              <p className="text-xs text-red-600 dark:text-red-400 mt-1 whitespace-pre-wrap">{String(raw.error)}</p>
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {selectedLogEntry.type === "complete" && (() => {
                      const raw = selectedLogEntry.raw as Record<string, unknown>;
                      const usage = raw.usage as Record<string, number> | null;
                      return (
                        <>
                          <DetailRow label="Status" value={String(raw.status ?? "—")} />
                          {raw.output && (
                            <div className="pt-2 mt-2 border-t border-gray-200 dark:border-zinc-700/60">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[9px] text-gray-500 uppercase tracking-wider">Output</span>
                                <CopyButton text={String(raw.output)} />
                              </div>
                              <MarkdownRenderer content={String(raw.output)} className="text-[10px] text-gray-700 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-950/60 rounded px-2 py-1.5 overflow-x-auto max-h-40 border border-gray-200 dark:border-zinc-800/40" />
                            </div>
                          )}
                          {usage && (
                            <div className="pt-2 mt-2 border-t border-gray-200 dark:border-zinc-700/60">
                              <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Token Usage</p>
                              <div className="flex gap-3 text-[10px]">
                                {usage.promptTokens != null && <span>Prompt: {usage.promptTokens}</span>}
                                {usage.completionTokens != null && <span>Comp: {usage.completionTokens}</span>}
                                {usage.totalTokens != null && <span>Total: {usage.totalTokens}</span>}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {selectedLogEntry.type === "handoff" && (() => {
                      const raw = selectedLogEntry.raw as Record<string, unknown>;
                      return (
                        <>
                          <DetailRow label="Handoff ID" value={String(raw.handoffId ?? "—")} />
                          <DetailRow label="From" value={String(raw.fromAgent ?? "—")} />
                          <DetailRow label="To" value={String(raw.toAgent ?? "—")} />
                          <DetailRow label="Status" value={String(raw.status ?? "—")} />
                          <DetailRow label="Artifacts" value={String(raw.artifacts ?? 0)} />
                          <DetailRow label="Pending" value={String(raw.pendingTasks ?? 0)} />
                        </>
                      );
                    })()}

                    {selectedLogEntry.type === "delegate" && (() => {
                      const raw = selectedLogEntry.raw as Record<string, unknown>;
                      return (
                        <>
                          <DetailRow label="Run ID" value={String(raw.runId ?? "—")} />
                          <DetailRow label="Parent" value={String(raw.parentAgent ?? "—")} />
                          <DetailRow label="Child" value={String(raw.childAgent ?? "—")} />
                          <DetailRow label="Depth" value={String(raw.depth ?? "—")} />
                          <DetailRow label="Status" value={String(raw.status ?? "—")} />
                        </>
                      );
                    })()}

                    {selectedLogEntry.type === "error" && (() => {
                      const raw = selectedLogEntry.raw as Record<string, unknown>;
                      return (
                        <div className="pt-2 mt-2 border-t border-red-200 dark:border-red-500/20">
                          <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400"><AlertTriangle className="h-3 w-3" /><span className="text-[9px] uppercase tracking-wider">Error</span></div>
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1 whitespace-pre-wrap">{String(raw.message ?? "")}</p>
                        </div>
                      );
                    })()}

                    <div className="pt-2 mt-2 border-t border-gray-200 dark:border-zinc-700/60">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] text-gray-500 uppercase tracking-wider">Raw Data</span>
                        <CopyButton text={JSON.stringify(selectedLogEntry.raw, null, 2)} />
                      </div>
                      <pre className="text-[10px] text-gray-600 dark:text-zinc-500 bg-gray-50 dark:bg-zinc-950/60 rounded px-2 py-1.5 overflow-x-auto max-h-32 border border-gray-200 dark:border-zinc-800/40">{JSON.stringify(selectedLogEntry.raw, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
})
