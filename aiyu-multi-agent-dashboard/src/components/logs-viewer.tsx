"use client";

import { memo, useMemo, useState } from "react";
import { useWs } from "@/lib/ws-context";
import { Search, ChevronDown, ChevronLeft, ChevronRight, FileText, Layers, Footprints, CheckCircle, AlertTriangle, ArrowRight, Users, Calendar, ArrowUpDown, Filter, X } from "lucide-react";

interface LogEntry {
  id: string;
  time: number;
  displayTime: string;
  displayDate: string;
  type: "step" | "complete" | "error" | "handoff" | "delegate";
  runId?: string;
  agentName?: string;
  message: string;
  raw: Record<string, unknown>;
}

const TYPE_CHIPS: { value: string; label: string; icon: typeof Layers; dot: string; color: string }[] = [
  { value: "all", label: "All", icon: Layers, dot: "bg-zinc-400", color: "text-gray-500 dark:text-zinc-400" },
  { value: "step", label: "Steps", icon: Footprints, dot: "bg-blue-500", color: "text-blue-600 dark:text-blue-400" },
  { value: "complete", label: "Done", icon: CheckCircle, dot: "bg-emerald-500", color: "text-emerald-600 dark:text-emerald-400" },
  { value: "error", label: "Errors", icon: AlertTriangle, dot: "bg-red-500", color: "text-red-600 dark:text-red-400" },
  { value: "handoff", label: "Handoff", icon: ArrowRight, dot: "bg-cyan-500", color: "text-cyan-600 dark:text-cyan-400" },
  { value: "delegate", label: "Delegate", icon: Users, dot: "bg-amber-500", color: "text-amber-600 dark:text-amber-400" },
];

const typeCfg: Record<string, { icon: typeof Layers; dot: string; bg: string; color: string }> = {
  step:     { icon: Footprints,   dot: "bg-blue-500",    bg: "bg-blue-500/10",    color: "text-blue-600 dark:text-blue-400" },
  complete: { icon: CheckCircle,  dot: "bg-emerald-500", bg: "bg-emerald-500/10", color: "text-emerald-600 dark:text-emerald-400" },
  error:    { icon: AlertTriangle, dot: "bg-red-500",    bg: "bg-red-500/10",     color: "text-red-600 dark:text-red-400" },
  handoff:  { icon: ArrowRight,   dot: "bg-cyan-500",   bg: "bg-cyan-500/10",    color: "text-cyan-600 dark:text-cyan-400" },
  delegate: { icon: Users,        dot: "bg-amber-500",   bg: "bg-amber-500/10",   color: "text-amber-600 dark:text-amber-400" },
};

interface LogsViewerProps {
  onInspectLog?: (log: LogEntry | null) => void;
}

export const LogsViewer = memo(function LogsViewer({ onInspectLog }: LogsViewerProps) {
  const activities = useWs(s => s.activities);
  const errors = useWs(s => s.errors);
  const handoffs = useWs(s => s.handoffs);
  const delegates = useWs(s => s.delegates);
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });

  const logs = useMemo<LogEntry[]>(() => {
    const list: LogEntry[] = [];
    for (const [activityId, activity] of Object.entries(activities ?? {})) {
      for (const step of activity.steps) {
        list.push({
          id: `step-${activityId}-${step.step}-${step.timestamp}-${Math.random().toString(16).slice(2, 6)}`,
          time: step.timestamp,
          displayTime: new Date(step.timestamp).toLocaleTimeString(),
          displayDate: new Date(step.timestamp).toLocaleDateString(),
          type: "step",
          runId: activityId,
          agentName: activity.agentName || undefined,
          message: step.thought ?? `${activity.mode === "chat" ? "Chat" : "Run"} step ${step.step}`,
          raw: { step: step.step, thought: step.thought, result: step.result, error: step.error, duration_ms: step.duration_ms, toolCalls: step.toolCalls, action: step.action, mode: activity.mode },
        });
      }
      for (const completion of activity.completions) {
        list.push({
          id: `complete-${activityId}-${completion.completedAt}-${Math.random().toString(16).slice(2, 6)}`,
          time: completion.completedAt,
          displayTime: new Date(completion.completedAt).toLocaleTimeString(),
          displayDate: new Date(completion.completedAt).toLocaleDateString(),
          type: "complete",
          runId: activityId,
          agentName: activity.agentName || undefined,
          message: `${activity.mode === "chat" ? "Chat" : "Run"} completed`,
          raw: { status: activity.status, output: completion.content, usage: completion.usage, mode: activity.mode },
        });
      }
    }
    errors.forEach((err, idx) => {
      list.push({ id: `error-${err.time}-${idx}`, time: err.time, displayTime: new Date(err.time).toLocaleTimeString(), displayDate: new Date(err.time).toLocaleDateString(), type: "error", message: err.message, raw: { message: err.message } });
    });
    handoffs.forEach((h) => {
      list.push({ id: `handoff-${h.handoffId}-${h.status}-${h.timestamp}`, time: h.timestamp, displayTime: new Date(h.timestamp).toLocaleTimeString(), displayDate: new Date(h.timestamp).toLocaleDateString(), type: "handoff", agentName: h.fromAgent, message: `Handoff: ${h.fromAgent} → ${h.toAgent} (${h.status})`, raw: { handoffId: h.handoffId, fromAgent: h.fromAgent, toAgent: h.toAgent, status: h.status, artifacts: h.artifacts, pendingTasks: h.pendingTasks } });
    });
    delegates.forEach((d) => {
      list.push({ id: `delegate-${d.runId}-${d.status}-${d.timestamp}`, time: d.timestamp, displayTime: new Date(d.timestamp).toLocaleTimeString(), displayDate: new Date(d.timestamp).toLocaleDateString(), type: "delegate", agentName: d.parentAgent, message: `Delegate: ${d.parentAgent} → ${d.childAgent} depth=${d.depth} (${d.status})`, raw: { runId: d.runId, parentAgent: d.parentAgent, childAgent: d.childAgent, depth: d.depth, status: d.status } });
    });
    list.sort((a, b) => b.time - a.time);
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, errors, handoffs, delegates]);

  const agentNames = useMemo(() => {
    const names = new Set<string>();
    for (const log of logs) { if (log.agentName) names.add(log.agentName); }
    return Array.from(names).sort();
  }, [logs]);

  // Dates that have logs (for calendar highlighting)
  const logDates = useMemo(() => {
    const set = new Set<string>();
    for (const log of logs) set.add(log.displayDate);
    return set;
  }, [logs]);

  // Calendar grid days for current calMonth
  const calDays = useMemo(() => {
    const { year, month } = calMonth;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [calMonth]);

  const filteredLogs = useMemo(() => {
    let result = logs.filter((log) => {
      const matchesText = !filter || log.message.toLowerCase().includes(filter.toLowerCase()) || log.runId?.toLowerCase().includes(filter.toLowerCase());
      const matchesType = typeFilter === "all" || log.type === typeFilter;
      const matchesAgent = agentFilter === "all" || log.agentName === agentFilter;
      const matchesDate = !dateFilter || log.displayDate === new Date(dateFilter).toLocaleDateString();
      return matchesText && matchesType && matchesAgent && matchesDate;
    });
    if (sortOrder === "oldest") result = [...result].reverse();
    return result;
  }, [logs, filter, typeFilter, agentFilter, dateFilter, sortOrder]);

  // Count per type for chips
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: logs.length };
    for (const log of logs) counts[log.type] = (counts[log.type] ?? 0) + 1;
    return counts;
  }, [logs]);

  const hasActiveFilters = typeFilter !== "all" || agentFilter !== "all" || dateFilter !== "";

  return (
    <div className="glass-card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />
          <h2 className="section-title text-[10px] mb-0">Logs</h2>
          <span className="text-[9px] text-gray-400 dark:text-zinc-600">{filteredLogs.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSortOrder(o => o === "newest" ? "oldest" : "newest")}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] text-gray-500 dark:text-zinc-500 border border-gray-200 dark:border-zinc-700/40 hover:border-zinc-400 dark:hover:border-zinc-500/60 transition-all cursor-pointer"
            title={sortOrder === "newest" ? "Newest first" : "Oldest first"}
          >
            <ArrowUpDown className="h-2.5 w-2.5" />
            {sortOrder === "newest" ? "New" : "Old"}
          </button>
          <button
            type="button"
            onClick={() => setShowFilters(f => !f)}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] border transition-all cursor-pointer ${showFilters ? "text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-500/30" : "text-gray-500 dark:text-zinc-500 border-gray-200 dark:border-zinc-700/40 hover:border-zinc-400 dark:hover:border-zinc-500/60"}`}
          >
            <Filter className="h-2.5 w-2.5" />
            Filter
            {hasActiveFilters && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-2">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 dark:text-zinc-600" />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search..."
          aria-label="Search logs"
          className="w-full pl-7 pr-3 py-1.5 text-[10px] bg-gray-50 dark:bg-zinc-800/50 rounded-lg border border-gray-200 dark:border-zinc-700/50 outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-all text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-600"
        />
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="mb-2 p-2 rounded-lg bg-gray-50 dark:bg-zinc-800/30 border border-gray-200 dark:border-zinc-700/40 space-y-2 animate-slide-in">
          {/* Date filter */}
          <div className="flex items-center gap-2 relative">
            <Calendar className="h-3 w-3 text-gray-400 dark:text-zinc-500 shrink-0" />
            <button
              type="button"
              onClick={() => setCalOpen(o => !o)}
              className="flex-1 flex items-center justify-between text-[10px] bg-white dark:bg-zinc-800/50 rounded-md border border-gray-200 dark:border-zinc-700/50 px-2 py-1 outline-none focus:border-blue-400 dark:focus:border-blue-500 text-gray-900 dark:text-zinc-100 cursor-pointer transition-all"
              aria-label="Filter by date"
              aria-expanded={calOpen}
            >
              <span className="truncate">{dateFilter ? new Date(dateFilter + "T00:00").toLocaleDateString() : "All dates"}</span>
              <ChevronDown className={`h-3 w-3 text-gray-400 dark:text-zinc-500 shrink-0 transition-transform ${calOpen ? "rotate-180" : ""}`} />
            </button>
            {dateFilter && (
              <button type="button" onClick={() => setDateFilter("")} className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300">
                <X className="h-3 w-3" />
              </button>
            )}
            {calOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 dropdown-panel overflow-hidden animate-slide-in p-2">
                {/* Month nav */}
                <div className="flex items-center justify-between mb-1.5">
                  <button type="button" onClick={() => setCalMonth(m => ({ year: m.month === 0 ? m.year - 1 : m.year, month: m.month === 0 ? 11 : m.month - 1 }))} className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-500 dark:text-zinc-400">
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                  <span className="text-[10px] font-semibold text-gray-800 dark:text-zinc-200">{calMonth.year} {new Date(calMonth.year, calMonth.month).toLocaleString("default", { month: "short" })}</span>
                  <button type="button" onClick={() => setCalMonth(m => ({ year: m.month === 11 ? m.year + 1 : m.year, month: m.month === 11 ? 0 : m.month + 1 }))} className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-500 dark:text-zinc-400">
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-0.5 mb-0.5">
                  {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => <span key={d} className="text-[8px] text-gray-400 dark:text-zinc-600 text-center font-medium">{d}</span>)}
                </div>
                {/* Day grid */}
                <div className="grid grid-cols-7 gap-0.5">
                  {calDays.map((day, i) => {
                    if (day === null) return <span key={`e-${i}`} />;
                    const dateStr = `${calMonth.year}-${String(calMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const displayDate = new Date(dateStr + "T00:00").toLocaleDateString();
                    const hasLogs = logDates.has(displayDate);
                    const isSelected = dateFilter === dateStr;
                    const isToday = new Date().toLocaleDateString() === displayDate;
                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => { setDateFilter(isSelected ? "" : dateStr); setCalOpen(false); }}
                        className={`h-5 w-full flex items-center justify-center rounded text-[9px] transition-all cursor-pointer
                          ${isSelected ? "bg-blue-500 text-white font-bold" : hasLogs ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 font-medium hover:bg-blue-500/20" : isToday ? "bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300 font-medium" : "text-gray-600 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-700/50"}`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {/* Agent filter */}
          {agentNames.length > 0 && (
            <div className="flex items-center gap-2 relative">
              <Users className="h-3 w-3 text-gray-400 dark:text-zinc-500 shrink-0" />
              <button
                type="button"
                onClick={() => setAgentOpen(o => !o)}
                className="flex-1 flex items-center justify-between text-[10px] bg-white dark:bg-zinc-800/50 rounded-md border border-gray-200 dark:border-zinc-700/50 px-2 py-1 outline-none focus:border-blue-400 dark:focus:border-blue-500 text-gray-900 dark:text-zinc-100 cursor-pointer transition-all"
                aria-label="Filter by agent"
                aria-expanded={agentOpen}
              >
                <span className="truncate">{agentFilter === "all" ? "All agents" : agentFilter}</span>
                <ChevronDown className={`h-3 w-3 text-gray-400 dark:text-zinc-500 shrink-0 transition-transform ${agentOpen ? "rotate-180" : ""}`} />
              </button>
              {agentOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 dropdown-panel overflow-hidden animate-slide-in">
                  <ul className="py-1">
                    <li>
                      <button
                        type="button"
                        onClick={() => { setAgentFilter("all"); setAgentOpen(false); }}
                        className={`w-full text-left px-3 py-1.5 text-[10px] flex items-center gap-2 transition-colors ${agentFilter === "all" ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400" : "hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-900 dark:text-zinc-100"}`}
                      >
                        <Users className="h-3 w-3 shrink-0 text-gray-400 dark:text-zinc-500" />
                        <span className="font-medium">All agents</span>
                        {agentFilter === "all" && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />}
                      </button>
                    </li>
                    {agentNames.map(name => (
                      <li key={name}>
                        <button
                          type="button"
                          onClick={() => { setAgentFilter(name); setAgentOpen(false); }}
                          className={`w-full text-left px-3 py-1.5 text-[10px] flex items-center gap-2 transition-colors ${agentFilter === name ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400" : "hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-900 dark:text-zinc-100"}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span className="font-medium truncate">{name}</span>
                          {agentFilter === name && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {/* Clear all */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => { setTypeFilter("all"); setAgentFilter("all"); setDateFilter(""); }}
              className="w-full text-[9px] text-gray-500 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors py-0.5"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Type filter chips */}
      <div className="flex flex-wrap gap-1 mb-2">
        {TYPE_CHIPS.map(chip => {
          const count = typeCounts[chip.value] ?? 0;
          if (chip.value !== "all" && count === 0) return null;
          const isActive = typeFilter === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => setTypeFilter(chip.value)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-medium transition-all cursor-pointer border ${isActive ? `${chip.color} bg-opacity-10 border-current` : "text-gray-500 dark:text-zinc-500 border-gray-200 dark:border-zinc-700/40 hover:border-zinc-400 dark:hover:border-zinc-500/60"}`}
              style={isActive ? { backgroundColor: "var(--tw-bg-opacity, 0.1)" } : undefined}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} />
              {chip.label}
              {count > 0 && <span className="opacity-60">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Log entries */}
      <div className="max-h-52 overflow-y-auto space-y-1">
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center py-3 text-gray-500 dark:text-zinc-600">
            <FileText className="h-5 w-5 mb-1 opacity-30" />
            <p className="text-[10px]">No logs match</p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const cfg = typeCfg[log.type] || typeCfg.step;
            const Icon = cfg.icon;
            return (
              <button
                key={log.id}
                type="button"
                onClick={() => onInspectLog?.(log)}
                className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 border border-gray-200 dark:border-zinc-700/40 transition-all duration-200 cursor-pointer text-left hover:border-zinc-400 dark:hover:border-zinc-500/60"
              >
                <div className={`flex h-5 w-5 items-center justify-center rounded-md ${cfg.bg} shrink-0`}>
                  <Icon className={`h-2.5 w-2.5 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-gray-900 dark:text-zinc-200 truncate leading-tight">{log.message}</p>
                  <div className="flex items-center gap-1.5 text-[8px]">
                    <span className="text-gray-400 dark:text-zinc-600">{log.displayDate} {log.displayTime}</span>
                    {log.agentName && <span className="text-gray-400 dark:text-zinc-600">· {log.agentName}</span>}
                  </div>
                </div>
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                <ChevronDown className="h-3 w-3 text-gray-400 dark:text-zinc-600 shrink-0" />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
})
