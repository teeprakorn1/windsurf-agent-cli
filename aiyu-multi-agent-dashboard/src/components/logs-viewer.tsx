"use client";

import { memo, useMemo, useRef, useState } from "react";
import { useWs } from "@/lib/ws-context";
import { Search, ChevronDown, FileText } from "lucide-react";

interface LogEntry {
  id: number;
  time: number;
  displayTime: string;
  type: "step" | "complete" | "error" | "handoff" | "delegate";
  runId?: string;
  message: string;
}

export const LogsViewer = memo(function LogsViewer() {
  const { runs, completedRuns, errors, handoffs, delegates } = useWs();
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const logIdRef = useRef(0);

  const logs = useMemo<LogEntry[]>(() => {
    const list: LogEntry[] = [];
    Object.entries(runs).forEach(([runId, steps]) => {
      steps.forEach((step) => {
        list.push({
          id: ++logIdRef.current,
          time: step.timestamp,
          displayTime: new Date(step.timestamp).toLocaleTimeString(),
          type: "step",
          runId,
          message: step.thought ?? `Step ${step.step} completed`,
        });
      });
    });

    Object.entries(completedRuns).forEach(([runId, result]) => {
      list.push({
        id: ++logIdRef.current,
        time: result.completedAt,
        displayTime: new Date(result.completedAt).toLocaleTimeString(),
        type: "complete",
        runId,
        message: `Run completed: ${result.status}`
      });
    });

    errors.forEach((err) => {
      list.push({ id: ++logIdRef.current, time: err.time, displayTime: new Date(err.time).toLocaleTimeString(), type: "error", message: err.message });
    });

    handoffs.forEach((h) => {
      list.push({ id: ++logIdRef.current, time: h.timestamp, displayTime: new Date(h.timestamp).toLocaleTimeString(), type: "handoff", message: `Handoff: ${h.fromAgent} → ${h.toAgent} (${h.status})` });
    });

    delegates.forEach((d) => {
      list.push({ id: ++logIdRef.current, time: d.timestamp, displayTime: new Date(d.timestamp).toLocaleTimeString(), type: "delegate", message: `Delegate: ${d.parentAgent} → ${d.childAgent} depth=${d.depth} (${d.status})` });
    });

    list.sort((a, b) => b.time - a.time);
    return list;
  }, [runs, completedRuns, errors, handoffs, delegates]);

  const filteredLogs = logs.filter((log) => {
    const matchesText = !filter || log.message.toLowerCase().includes(filter.toLowerCase()) || log.runId?.toLowerCase().includes(filter.toLowerCase());
    const matchesType = typeFilter === "all" || log.type === typeFilter;
    return matchesText && matchesType;
  });

  const typeColors: Record<string, string> = {
    step: "text-blue-800 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20",
    complete: "text-emerald-800 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20",
    error: "text-red-800 dark:text-red-400 bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20",
    handoff: "text-violet-800 dark:text-violet-400 bg-violet-100 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20",
    delegate: "text-amber-800 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20",
  };

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
            className="input-field pl-8 text-xs py-1.5"
          />
        </div>
        <div className="relative">
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 dark:text-zinc-600 pointer-events-none" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input-field text-xs py-1.5 pr-7 appearance-none"
            aria-label="Filter by log type"
          >
            <option value="all">All</option>
            <option value="step">Steps</option>
            <option value="complete">Complete</option>
            <option value="error">Errors</option>
            <option value="handoff">Handoffs</option>
            <option value="delegate">Delegates</option>
          </select>
        </div>
      </div>

      <div className="max-h-64 sm:max-h-48 overflow-y-auto space-y-1">
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center py-4 text-gray-500 dark:text-zinc-600">
            <FileText className="h-6 w-6 mb-1.5 opacity-30" />
            <p className="text-xs">No logs match your filter</p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="flex gap-2 text-[10px] py-1.5 border-b border-gray-100 dark:border-zinc-800/30 last:border-0 hover:bg-gray-50 dark:hover:bg-zinc-800/20 rounded px-1 transition-colors">
              <span className="text-gray-500 dark:text-zinc-600 font-mono shrink-0">{log.displayTime}</span>
              <span className={`shrink-0 rounded px-1.5 py-0.5 font-medium ${typeColors[log.type]}`}>{log.type}</span>
              {log.runId && <span className="text-gray-500 dark:text-zinc-600 font-mono truncate max-w-[80px] shrink-0">{log.runId}</span>}
              <span className="text-gray-800 dark:text-zinc-400 truncate flex-1">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
})
