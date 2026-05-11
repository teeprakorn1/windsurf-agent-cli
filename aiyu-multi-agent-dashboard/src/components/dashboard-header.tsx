"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useWs } from "@/lib/ws-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatUptime } from "@/lib/utils";
import { Download, RotateCcw, Wifi, WifiOff, Zap, ChevronDown } from "lucide-react";

interface InfoRowProps {
  label: string;
  value: string;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-gray-500 dark:text-zinc-500 shrink-0">{label}</span>
      <span className="text-gray-900 dark:text-zinc-200 font-mono text-right truncate">{value}</span>
    </div>
  );
}

interface ConnDisplayValues {
  version: string;
  nodeVersion: string;
  uptimeMs: number;
  llmProviders: [string, string][];
  heap: string | null;
  cpuRam: string | null;
}

interface DashboardHeaderProps {
  version: string;
  onReset: () => void;
  showToast: (msg: string) => void;
  connInfo: Record<string, unknown> | null;
  onConnInfoRequest?: () => void;
}

export function DashboardHeader({ version, onReset, showToast, connInfo, onConnInfoRequest }: DashboardHeaderProps) {
  const connected = useWs(s => s.connected);
  const errors = useWs(s => s.errors);
  const agentStatuses = useWs(s => s.agentStatuses);
  const activities = useWs(s => s.activities);
  const handoffs = useWs(s => s.handoffs);
  const delegates = useWs(s => s.delegates);

  // Derive legacy-compatible data from unified activities
  const safeActivities = useMemo(() => activities ?? {}, [activities]);
  const runs = useMemo(() => {
    const result: Record<string, unknown[]> = {};
    for (const [id, a] of Object.entries(safeActivities)) {
      if (a.mode === "run" && a.steps.length > 0) result[id] = a.steps;
    }
    return result;
  }, [safeActivities]);
  const completedRuns = useMemo(() => {
    const result: Record<string, { status: string; output: string | null; usage: unknown; completedAt: number }> = {};
    for (const [id, a] of Object.entries(safeActivities)) {
      if (a.completedAt && a.completions.length > 0) {
        const last = a.completions[a.completions.length - 1];
        result[id] = { status: a.status, output: last.content, usage: last.usage, completedAt: last.completedAt };
      }
    }
    return result;
  }, [safeActivities]);
  const chatSessions = useMemo(() => {
    const result: Record<string, { sessionId: string; agentName: string; provider: string; model: string }> = {};
    for (const [id, a] of Object.entries(safeActivities)) {
      if (a.mode === "chat") result[id] = { sessionId: id, agentName: a.agentName, provider: a.provider, model: a.model };
    }
    return result;
  }, [safeActivities]);
  const chatSteps = useMemo(() => {
    const result: { sessionId: string; step: number; thought: string | null; toolCalls: unknown; duration_ms: number | null; error: string | null; timestamp: number }[] = [];
    for (const [id, a] of Object.entries(safeActivities)) {
      if (a.mode === "chat") for (const s of a.steps) result.push({ sessionId: id, step: s.step, thought: s.thought, toolCalls: s.toolCalls, duration_ms: s.duration_ms, error: s.error, timestamp: s.timestamp });
    }
    return result;
  }, [safeActivities]);
  const chatCompletions = useMemo(() => {
    const result: Record<string, { content: string | null; usage: unknown; completedAt: number }[]> = {};
    for (const [id, a] of Object.entries(safeActivities)) {
      if (a.mode === "chat" && a.completions.length > 0) result[id] = a.completions.map(c => ({ content: c.content, usage: c.usage, completedAt: c.completedAt }));
    }
    return result;
  }, [safeActivities]);
  const [showAppInfo, setShowAppInfo] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showConnInfo, setShowConnInfo] = useState(false);
  const appRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const connRef = useRef<HTMLDivElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (appRef.current && !appRef.current.contains(e.target as Node)) setShowAppInfo(false);
      if (connRef.current && !connRef.current.contains(e.target as Node)) setShowConnInfo(false);
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setShowExportMenu(false);
    };
    if (showConnInfo || showAppInfo || showExportMenu) {
      if (onConnInfoRequest && showConnInfo) onConnInfoRequest();
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showConnInfo, showAppInfo, showExportMenu, onConnInfoRequest]);

  const connDisplayValues: ConnDisplayValues | null = useMemo(() => {
    if (!connInfo) return null;
    const c = connInfo as Record<string, unknown>;
    const checks = c.checks as Record<string, unknown> | undefined;
    const llm = checks?.llmProviders as Record<string, string> | undefined;
    const mem = checks?.memory as Record<string, number> | undefined;
    const sys = c.system as Record<string, number> | undefined;
    return {
      version: (c.version as string) || "—",
      nodeVersion: (c.nodeVersion as string) || "—",
      uptimeMs: (c.uptimeMs as number) || 0,
      llmProviders: llm ? Object.entries(llm).filter(([k]) => k !== "status") : [],
      heap: mem ? `${mem.heapUsedMB}/${mem.heapTotalMB} MB` : null,
      cpuRam: sys ? `${sys.cpuCount} cores / ${(Math.round(sys.freeMemoryMB / 102.4) / 10)}/${(Math.round(sys.totalMemoryMB / 102.4) / 10)} GB` : null,
    };
  }, [connInfo]);

  const safeReplacer = (_key: string, value: unknown) =>
    typeof value === "bigint" ? String(value) : value;

  const doExport = useCallback(
    (format: string) => {
      try {
        const ts = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
        const safeCompleted = Object.fromEntries(
          Object.entries(completedRuns).map(([k, v]) => [
            k,
            {
              ...(v as unknown as Record<string, unknown>),
              usage: (v as unknown as Record<string, unknown>).usage
                ? JSON.parse(JSON.stringify((v as unknown as Record<string, unknown>).usage, safeReplacer))
                : null,
            },
          ])
        );
        let blob: Blob;
        let filename: string;

        if (format === "json") {
          const data = {
            timestamp: new Date().toISOString(),
            runs,
            completedRuns: safeCompleted,
            agentStatuses,
            chatSessions,
            chatSteps,
            chatCompletions,
            handoffs,
            delegates,
          };
          blob = new Blob([JSON.stringify(data, safeReplacer, 2)], { type: "application/json" });
          filename = `aiyu-trace-${ts}.json`;
        } else if (format === "csv") {
          const csvEscape = (v: unknown) => {
            const s = String(v ?? "");
            return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
          };
          const rows = Object.entries(completedRuns).map(([id, r]) => {
            const cr = r as unknown as Record<string, unknown>;
            const u = cr.usage as Record<string, number> | null;
            return `${csvEscape(id)},${csvEscape(cr.status)},${csvEscape(cr.completedAt)},${csvEscape(u?.promptTokens)},${csvEscape(u?.completionTokens)},${csvEscape(u?.totalTokens)}`;
          });
          const header = "runId,status,completedAt,promptTokens,completionTokens,totalTokens";
          blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
          filename = `aiyu-summary-${ts}.csv`;
        } else if (format === "md") {
          const lines: string[] = [`# Aiyu MultiAgent Report`, ``, `Generated: ${new Date().toISOString()}`, ``];
          lines.push(`## Agent Statuses`, ``);
          Object.entries(agentStatuses ?? {}).forEach(([name, s]) => {
            const st = s as unknown as Record<string, unknown>;
            lines.push(`- **${name}** — ${String(st.status ?? "unknown")} (since ${String(st.since ?? "—")})`);
          });
          lines.push(``, `## Completed Runs`, ``);
          Object.entries(completedRuns).forEach(([id, r]) => {
            const cr = r as unknown as Record<string, unknown>;
            lines.push(`### ${id}`, `- Status: \`${cr.status}\``, `- Completed: ${cr.completedAt ? new Date(cr.completedAt as number).toISOString() : "—"}`);
            const u = cr.usage as Record<string, number> | null;
            if (u) lines.push(`- Tokens: ${u.totalTokens ?? "—"} (prompt: ${u.promptTokens ?? "—"}, comp: ${u.completionTokens ?? "—"})`);
            if (cr.output) lines.push(``, `> ${(cr.output as string).slice(0, 300)}${(cr.output as string).length > 300 ? "..." : ""}`);
            lines.push(``);
          });
          lines.push(`## Errors`, ``);
          errors.forEach((e, i) => lines.push(`${i + 1}. ${e.message}`));
          lines.push(``, `## Handoffs`, ``);
          (handoffs as unknown as Array<Record<string, unknown>>).forEach((h) => lines.push(`- ${String(h.fromAgent ?? "")} → ${String(h.toAgent ?? "")} (${String(h.status ?? "")})`));
          lines.push(``, `## Delegates`, ``);
          (delegates as unknown as Array<Record<string, unknown>>).forEach((d) => lines.push(`- ${String(d.parentAgent ?? "")} → ${String(d.childAgent ?? "")} depth=${String(d.depth ?? "")} (${String(d.status ?? "")})`));
          blob = new Blob([lines.join("\n")], { type: "text/markdown" });
          filename = `aiyu-report-${ts}.md`;
        } else if (format === "runs") {
          const data = { timestamp: new Date().toISOString(), runs, completedRuns: safeCompleted };
          const seen = new WeakSet();
          const safeJson = JSON.stringify(data, (key, value) => {
            if (typeof value === "object" && value !== null) {
              if (seen.has(value)) return "[Circular]";
              seen.add(value);
            }
            return safeReplacer(key, value);
          }, 2);
          blob = new Blob([safeJson], { type: "application/json" });
          filename = `aiyu-runs-${ts}.json`;
        } else {
          return;
        }

        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        showToast(`Exported ${filename}`);
        setShowExportMenu(false);
      } catch {
        showToast("Export failed — check browser console");
      }
    },
    [completedRuns, agentStatuses, runs, chatSessions, chatSteps, chatCompletions, handoffs, delegates, errors, showToast]
  );

  return (
    <header className="sticky top-0 z-50 border-b bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl" style={{ borderColor: "var(--border-color)" }}>
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-2 sm:py-3 flex items-center justify-between">
        <div ref={appRef} className="flex items-center gap-3 relative">
          <button
            type="button"
            onClick={() => setShowAppInfo(!showAppInfo)}
            className="flex items-center gap-3 cursor-pointer group"
            aria-label="App info"
          >
            <div className="relative">
              <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div className="absolute inset-0 blur-md bg-blue-600/40 dark:bg-blue-400/40" />
            </div>
            <h1 className="text-sm sm:text-base font-bold tracking-tight gradient-text group-hover:opacity-80 transition-opacity">
              Aiyu MultiAgent
            </h1>
            <span className="hidden sm:inline-flex text-[10px] text-gray-500 dark:text-zinc-600 border border-gray-300 dark:border-zinc-800 rounded-full px-2 py-0.5">
              v{version}
            </span>
            <ChevronDown
              className={`h-3 w-3 text-gray-400 dark:text-zinc-600 transition-transform duration-200 ${showAppInfo ? "rotate-180" : ""}`}
            />
          </button>
          {showAppInfo && (
            <div className="absolute left-0 top-full mt-2 w-72 dropdown-panel overflow-hidden animate-slide-in z-50">
              <div className="p-3 border-b border-gray-200 dark:border-zinc-700">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-bold gradient-text">Aiyu MultiAgent</span>
                  <span className="text-[10px] text-gray-500 dark:text-zinc-600 border border-gray-300 dark:border-zinc-800 rounded-full px-2 py-0.5">
                    v{version}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-zinc-500 mt-1">
                  Open-source AI Agent Platform — multi-provider, multi-agent orchestration
                </p>
              </div>
              <div className="p-3 space-y-2 text-[11px]">
                <InfoRow label="npm" value="aiyu-multi-agent" />
                <InfoRow label="CLI" value={'aiyu-multi-agent run "<task>"'} />
                <InfoRow label="Node" value={connDisplayValues?.nodeVersion || "—"} />
                <InfoRow label="Platform" value={connInfo ? (connInfo as Record<string, string>).platform : "—"} />
                {/* PID intentionally hidden — info disclosure risk */}
                <div className="pt-2 mt-2 border-t border-gray-200 dark:border-zinc-700 space-y-1.5">
                  <a
                    href="https://github.com/teeprakorn1/aiyu-multi-agent"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <span>GitHub Repository</span>
                    <span className="text-[9px] opacity-60">↗</span>
                  </a>
                  <a
                    href="https://www.npmjs.com/package/aiyu-multi-agent"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <span>npm Package</span>
                    <span className="text-[9px] opacity-60">↗</span>
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div ref={exportRef} className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="btn-ghost flex items-center gap-1.5"
              aria-label="Export data"
              aria-expanded={showExportMenu}
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
              <ChevronDown className={`h-2.5 w-2.5 transition-transform ${showExportMenu ? "rotate-180" : ""}`} />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 z-50 mt-1 w-72 dropdown-panel overflow-hidden animate-slide-in">
                <div className="px-3 py-2 border-b border-gray-200 dark:border-zinc-700/60">
                  <p className="text-[10px] text-gray-500 dark:text-zinc-500 uppercase tracking-wider font-bold">Export Format</p>
                </div>
                <ul className="py-1">
                  <li>
                    <button
                      type="button"
                      onClick={() => doExport("json")}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/10 rounded px-1.5 py-0.5">JSON</span>
                        <span className="text-xs font-semibold text-gray-900 dark:text-zinc-100">Full Trace</span>
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-zinc-500 mt-0.5 ml-7">runs, completedRuns, agentStatuses, chatSessions, chatSteps, chatCompletions, handoffs, delegates</p>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => doExport("runs")}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 rounded px-1.5 py-0.5">JSON</span>
                        <span className="text-xs font-semibold text-gray-900 dark:text-zinc-100">Runs Only</span>
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-zinc-500 mt-0.5 ml-7">runs + completedRuns (lighter, no statuses/handoffs)</p>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => doExport("csv")}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/10 rounded px-1.5 py-0.5">CSV</span>
                        <span className="text-xs font-semibold text-gray-900 dark:text-zinc-100">Run Summary</span>
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-zinc-500 mt-0.5 ml-7">runId, status, completedAt, promptTokens, completionTokens, totalTokens</p>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => doExport("md")}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-cyan-700 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-500/10 rounded px-1.5 py-0.5">MD</span>
                        <span className="text-xs font-semibold text-gray-900 dark:text-zinc-100">Markdown Report</span>
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-zinc-500 mt-0.5 ml-7">statuses, completed runs, errors, handoffs, delegates</p>
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
          <button onClick={onReset} className="btn-ghost" aria-label="Reset dashboard">
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
          <ThemeToggle />
          <div ref={connRef} className="relative">
            <button
              type="button"
              onClick={() => setShowConnInfo(!showConnInfo)}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition-all duration-300 cursor-pointer
                ${connected
                  ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400 border border-green-200 dark:border-green-500/20 hover:bg-green-200 dark:hover:bg-green-500/20"
                  : "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/20"}`}
              aria-label="Connection info"
            >
              {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              <span className="hidden sm:inline">{connected ? "Live" : "Offline"}</span>
              {connected && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
                </span>
              )}
            </button>
            {showConnInfo && (
              <div className="absolute right-0 top-full mt-2 w-72 dropdown-panel overflow-hidden animate-slide-in z-50">
                <div className="p-3 border-b border-gray-200 dark:border-zinc-700">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
                    <span className="text-xs font-semibold text-gray-900 dark:text-zinc-100">{connected ? "Connected" : "Disconnected"}</span>
                  </div>
                </div>
                <div className="p-3 space-y-2 text-[11px]">
                  <InfoRow label="API URL" value={process.env.NEXT_PUBLIC_API_URL || "localhost:3000"} />
                  <InfoRow label="WS URL" value={process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3000/ws"} />
                  <InfoRow label="API Key" value={process.env.NEXT_PUBLIC_API_KEY ? "Configured" : "Not set"} />
                  <InfoRow label="Version" value={connDisplayValues?.version || "—"} />
                  <InfoRow label="Node" value={connDisplayValues?.nodeVersion || "—"} />
                  <InfoRow label="Uptime" value={connDisplayValues ? formatUptime(connDisplayValues.uptimeMs) : "—"} />
                  {connDisplayValues?.llmProviders.map(([k, v]) => (
                    <InfoRow key={k} label={`LLM: ${k}`} value={v} />
                  ))}
                  {connDisplayValues?.heap && <InfoRow label="Heap" value={connDisplayValues.heap} />}
                  {connDisplayValues?.cpuRam && <InfoRow label="CPU / RAM" value={connDisplayValues.cpuRam} />}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
