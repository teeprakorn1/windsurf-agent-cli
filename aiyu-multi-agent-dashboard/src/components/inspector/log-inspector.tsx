"use client";

import type { LogInspectData } from "@/lib/types";
import { X, ChevronDown, FileText, Brain, AlertTriangle } from "lucide-react";
import { MarkdownRenderer } from "@/components/markdown-renderer";

interface LogInspectorProps {
  data: LogInspectData;
  onClose: () => void;
}

export function LogInspector({ data, onClose }: LogInspectorProps) {
  const log = data;
  const typeCfg: Record<string, { color: string; bg: string; border: string; gradient: string }> = {
    step: { color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", gradient: "from-blue-500/5 to-indigo-500/5" },
    complete: { color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", gradient: "from-emerald-500/5 to-green-500/5" },
    error: { color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", gradient: "from-red-500/5 to-orange-500/5" },
    handoff: { color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20", gradient: "from-cyan-500/5 to-blue-500/5" },
    delegate: { color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", gradient: "from-amber-500/5 to-orange-500/5" },
  };
  const cfg = typeCfg[log.type] || typeCfg.step;
  const r = log.raw;
  return (
    <div className="flex-1 overflow-y-auto">
      <div className={`bg-gradient-to-br ${cfg.gradient} border-b ${cfg.border} px-6 py-5`}>
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`flex items-center justify-center h-12 w-12 rounded-2xl ${cfg.bg} border ${cfg.border} shadow-sm`}>
              <FileText className={`h-6 w-6 ${cfg.color}`} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100 capitalize">{log.type}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${cfg.bg} ${cfg.color} ${cfg.border} border`}>
                  {log.type}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-zinc-500">{log.displayTime}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/50 dark:hover:bg-zinc-800/50 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-zinc-700">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="max-w-xl mx-auto p-6 space-y-5">
        {log.runId && (
          <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30">
            <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">Run ID</p>
            <p className="font-mono text-xs text-gray-800 dark:text-zinc-300 truncate">{log.runId}</p>
          </div>
        )}
        {log.type === "step" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30">
                <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">Step</p>
                <p className="text-xs font-semibold text-gray-800 dark:text-zinc-300">#{String(r.step ?? "—")}</p>
              </div>
              <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30">
                <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">Duration</p>
                <p className="text-xs font-semibold text-gray-800 dark:text-zinc-300">{r.duration_ms != null ? `${r.duration_ms}ms` : "—"}</p>
              </div>
            </div>
            {r.thought && (
              <div className="rounded-xl border border-cyan-200 dark:border-cyan-500/20 bg-cyan-50/50 dark:bg-cyan-500/5 px-4 py-3">
                <div className="flex items-center gap-2 mb-2"><Brain className="h-4 w-4 text-cyan-600 dark:text-cyan-400" /><span className="text-[11px] text-cyan-700 dark:text-cyan-400 uppercase tracking-wider font-semibold">Thought</span></div>
                <MarkdownRenderer content={String(r.thought)} className="text-sm text-gray-800 dark:text-zinc-300 leading-relaxed" />
              </div>
            )}
            {r.result && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-gray-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Result</span>
                </div>
                <MarkdownRenderer content={String(r.result)} className="text-sm text-gray-700 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-800/30 rounded-xl px-4 py-3 overflow-x-auto max-h-52 border border-gray-200 dark:border-zinc-700/40" />
              </div>
            )}
            {r.error && (
              <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5 px-4 py-3">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-1"><AlertTriangle className="h-4 w-4" /><span className="text-[11px] uppercase tracking-wider font-semibold">Error</span></div>
                <p className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">{String(r.error)}</p>
              </div>
            )}
          </>
        )}
        {log.type === "complete" && (
          <>
            <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30">
              <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">Status</p>
              <p className="text-xs font-semibold text-gray-800 dark:text-zinc-300">{String(r.status ?? "—")}</p>
            </div>
            {r.output && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-gray-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Output</span>
                </div>
                <MarkdownRenderer content={String(r.output)} className="text-sm text-gray-700 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-800/30 rounded-xl px-4 py-3 overflow-x-auto max-h-52 border border-gray-200 dark:border-zinc-700/40" />
              </div>
            )}
          </>
        )}
        {log.type === "error" && (
          <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5 px-4 py-3">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2"><AlertTriangle className="h-4 w-4" /><span className="text-[11px] uppercase tracking-wider font-semibold">Error</span></div>
            <p className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap leading-relaxed">{String(r.message ?? "")}</p>
          </div>
        )}
        {(log.type === "handoff" || log.type === "delegate") && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30">
              <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">{log.type === "handoff" ? "From" : "Parent"}</p>
              <p className="text-xs font-semibold text-gray-800 dark:text-zinc-300">{String(log.type === "handoff" ? r.fromAgent ?? "—" : r.parentAgent ?? "—")}</p>
            </div>
            <div className="rounded-xl px-4 py-3 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-700/30">
              <p className="text-[10px] text-gray-400 dark:text-zinc-600 uppercase tracking-wider mb-0.5">{log.type === "handoff" ? "To" : "Child"}</p>
              <p className="text-xs font-semibold text-gray-800 dark:text-zinc-300">{String(log.type === "handoff" ? r.toAgent ?? "—" : r.childAgent ?? "—")}</p>
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
