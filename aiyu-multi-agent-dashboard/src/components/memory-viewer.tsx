"use client";

import { memo } from "react";
import { useWs } from "@/lib/ws-context";
import { Database, ChevronDown } from "lucide-react";

interface MemoryEntry {
  key: string;
  type: "handoff" | "delegate";
  agent: string;
  detail: string;
  status: string;
  time: number;
  raw: Record<string, unknown>;
}

interface MemoryViewerProps {
  onInspectInteraction?: (entry: MemoryEntry | null) => void;
}

const typeCfg: Record<string, { dot: string; bg: string; color: string }> = {
  handoff:  { dot: "bg-cyan-500",  bg: "bg-cyan-500/10",  color: "text-cyan-600 dark:text-cyan-400" },
  delegate: { dot: "bg-amber-500", bg: "bg-amber-500/10", color: "text-amber-600 dark:text-amber-400" },
};

const statusDot: Record<string, string> = {
  started: "bg-blue-500",
  completed: "bg-emerald-500",
  error: "bg-red-500",
  max_steps: "bg-amber-500",
};

export const MemoryViewer = memo(function MemoryViewer({ onInspectInteraction }: MemoryViewerProps) {
  const handoffs = useWs(s => s.handoffs);
  const delegates = useWs(s => s.delegates);

  const memoryEntries: MemoryEntry[] = [
    ...handoffs.map(h => ({
      key: `handoff:${h.handoffId}`,
      type: "handoff" as const,
      agent: h.fromAgent,
      detail: `${h.fromAgent} → ${h.toAgent}`,
      status: h.status,
      time: h.timestamp,
      raw: { ...h } as Record<string, unknown>,
    })),
    ...delegates.map(d => ({
      key: `delegate:${d.runId}`,
      type: "delegate" as const,
      agent: d.parentAgent,
      detail: `${d.parentAgent} → ${d.childAgent} (depth ${d.depth})`,
      status: d.status,
      time: d.timestamp,
      raw: { ...d } as Record<string, unknown>,
    })),
  ].sort((a, b) => b.time - a.time);

  return (
    <div className="glass-card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />
          <h2 className="section-title text-[10px] mb-0">Interactions</h2>
          <span className="text-[9px] text-gray-400 dark:text-zinc-600">{memoryEntries.length}</span>
        </div>
      </div>
      {memoryEntries.length === 0 ? (
        <div className="flex flex-col items-center py-3 text-gray-500 dark:text-zinc-600">
          <Database className="h-5 w-5 mb-1 opacity-30" />
          <p className="text-[10px]">No interactions yet</p>
        </div>
      ) : (
        <div className="max-h-52 overflow-y-auto space-y-1">
          {memoryEntries.slice(0, 20).map(entry => {
            const cfg = typeCfg[entry.type] || typeCfg.handoff;
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => onInspectInteraction?.(entry)}
                className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 border border-gray-200 dark:border-zinc-700/40 transition-all duration-200 cursor-pointer text-left hover:border-zinc-400 dark:hover:border-zinc-500/60"
              >
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-gray-900 dark:text-zinc-200 truncate leading-tight">{entry.detail}</p>
                  <div className="flex items-center gap-1.5 text-[8px]">
                    <span className={`px-1 py-0 rounded ${cfg.bg} ${cfg.color}`}>{entry.type}</span>
                    <span className={`h-1.5 w-1.5 rounded-full ${statusDot[entry.status] || "bg-zinc-400"}`} />
                    <span className="text-gray-400 dark:text-zinc-600">{new Date(entry.time).toLocaleTimeString()}</span>
                  </div>
                </div>
                <ChevronDown className="h-3 w-3 text-gray-400 dark:text-zinc-600 shrink-0" />
              </button>
            );
          })}
          {memoryEntries.length > 20 && <p className="text-[8px] text-gray-400 dark:text-zinc-600 text-center">+{memoryEntries.length - 20} more</p>}
        </div>
      )}
    </div>
  );
})
