"use client";

import type { InteractionInspectData } from "@/lib/types";
import { ArrowRight, X, ChevronDown } from "lucide-react";

interface InteractionInspectorProps {
  data: InteractionInspectData;
  onClose: () => void;
}

export function InteractionInspector({ data, onClose }: InteractionInspectorProps) {
  const entry = data;
  const isHandoff = entry.type === "handoff";
  const cfg = isHandoff
    ? { icon: ArrowRight, color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20", gradient: "from-cyan-500/5 to-blue-500/5", label: "Handoff" }
    : { icon: ArrowRight, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", gradient: "from-amber-500/5 to-orange-500/5", label: "Delegate" };
  const II = cfg.icon;
  const r = entry.raw;
  return (
    <div className="flex-1 overflow-y-auto">
      <div className={`bg-gradient-to-br ${cfg.gradient} border-b ${cfg.border} px-6 py-5`}>
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`flex items-center justify-center h-12 w-12 rounded-2xl ${cfg.bg} border ${cfg.border} shadow-sm`}>
              <II className={`h-6 w-6 ${cfg.color}`} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100">{cfg.label}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${cfg.bg} ${cfg.color} ${cfg.border} border`}>
                  {entry.status}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-zinc-500">{new Date(entry.time).toLocaleTimeString()}</span>
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
            <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">{isHandoff ? "From" : "Parent"}</p>
            <p className="text-xs font-semibold text-gray-800 dark:text-zinc-300">{String(isHandoff ? r.fromAgent ?? "—" : r.parentAgent ?? "—")}</p>
          </div>
          <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30">
            <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">{isHandoff ? "To" : "Child"}</p>
            <p className="text-xs font-semibold text-gray-800 dark:text-zinc-300">{String(isHandoff ? r.toAgent ?? "—" : r.childAgent ?? "—")}</p>
          </div>
        </div>
        {isHandoff ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30 text-center">
              <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">Artifacts</p>
              <p className="text-xs font-semibold text-gray-800 dark:text-zinc-300">{String(r.artifacts ?? 0)}</p>
            </div>
            <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30 text-center">
              <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">Pending</p>
              <p className="text-xs font-semibold text-gray-800 dark:text-zinc-300">{String(r.pendingTasks ?? 0)}</p>
            </div>
            <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30 text-center">
              <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">Status</p>
              <p className="text-xs font-semibold text-gray-800 dark:text-zinc-300">{String(r.status ?? "—")}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30 text-center">
              <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">Depth</p>
              <p className="text-xs font-semibold text-gray-800 dark:text-zinc-300">{String(r.depth ?? "—")}</p>
            </div>
            <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30 text-center">
              <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">Status</p>
              <p className="text-xs font-semibold text-gray-800 dark:text-zinc-300">{String(r.status ?? "—")}</p>
            </div>
          </div>
        )}
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30 hover:bg-gray-100 dark:hover:bg-zinc-800/60 transition-colors">
            <span className="text-[11px] text-gray-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Raw Data</span>
            <ChevronDown className="h-3.5 w-3.5 text-gray-400 transition-transform group-open:rotate-180" />
          </summary>
          <pre className="mt-2 text-[11px] text-gray-600 dark:text-zinc-500 bg-gray-50 dark:bg-zinc-800/30 rounded-xl px-4 py-3 overflow-x-auto max-h-48 border border-gray-200 dark:border-zinc-700/40">{JSON.stringify(r, null, 2)}</pre>
        </details>
      </div>
    </div>
  );
}
