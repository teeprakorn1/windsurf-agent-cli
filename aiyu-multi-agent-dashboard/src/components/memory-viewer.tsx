"use client";

import { memo } from "react";
import { useWs } from "@/lib/ws-context";
import { Database, ArrowRight } from "lucide-react";

export const MemoryViewer = memo(function MemoryViewer() {
  const { handoffs, delegates } = useWs();

  const memoryEntries = [
    ...handoffs.map(h => ({
      key: `handoff:${h.handoffId}`,
      agent: h.fromAgent,
      detail: `${h.fromAgent} → ${h.toAgent}`,
      status: h.status,
      time: h.timestamp,
    })),
    ...delegates.map(d => ({
      key: `delegate:${d.runId}`,
      agent: d.parentAgent,
      detail: `${d.parentAgent} → ${d.childAgent} (depth ${d.depth})`,
      status: d.status,
      time: d.timestamp,
    })),
  ].sort((a, b) => b.time - a.time);

  const statusColors: Record<string, string> = {
    started: "text-blue-600 dark:text-blue-400",
    completed: "text-emerald-600 dark:text-emerald-400",
    error: "text-red-600 dark:text-red-400",
    "max_steps": "text-amber-600 dark:text-amber-400",
  };

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Database className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
        <h2 className="section-title mb-0">Interactions</h2>
      </div>
      {memoryEntries.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-gray-500 dark:text-zinc-600">
          <Database className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-xs">No interactions yet</p>
          <p className="text-[10px] text-gray-400 dark:text-zinc-700">Handoffs and delegates appear here</p>
        </div>
      ) : (
        <div className="max-h-64 sm:max-h-48 overflow-y-auto space-y-1.5">
          {memoryEntries.slice(0, 50).map(entry => (
            <div key={entry.key} className="flex items-center gap-2 text-[10px] py-1.5 border-b border-gray-100 dark:border-zinc-800/30 last:border-0 hover:bg-gray-50 dark:hover:bg-zinc-800/20 rounded px-1 transition-colors">
              <ArrowRight className="h-2.5 w-2.5 text-gray-400 dark:text-zinc-600 shrink-0" />
              <span className="text-gray-500 dark:text-zinc-600 font-mono shrink-0">{new Date(entry.time).toLocaleTimeString()}</span>
              <span className="text-gray-800 dark:text-zinc-400 truncate flex-1">{entry.detail}</span>
              <span className={`shrink-0 font-medium ${statusColors[entry.status] || "text-gray-500"}`}>{entry.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
})
