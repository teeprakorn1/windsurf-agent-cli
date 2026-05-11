"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { useWs } from "@/lib/ws-context";
import { BarChart3, TrendingUp, Minus, Zap, Clock, Hash, AlertTriangle, Activity, Cpu, Gauge } from "lucide-react";

interface MetricStat {
  label: string;
  value: string;
  trend: "up" | "down" | "flat";
  color: string;
  icon: typeof BarChart3;
}

export const MetricsPanel = memo(function MetricsPanel() {
  const activities = useWs(s => s.activities);
  const [serverStats, setServerStats] = useState<MetricStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const poll = async () => {
      try {
        const res = await fetch("/api/metrics", { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to fetch");
        const text = await res.text();
        setServerStats(parsePrometheusMetrics(text));
        setOffline(false);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setOffline(true);
        setServerStats([]);
      } finally {
        setLoading(false);
      }
    };

    poll();
    const interval = setInterval(poll, 30000);
    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, []);

  // Compute token usage from unified activities (both Run and Chat)
  const tokenUsage = useMemo(() => {
    let prompt = 0, completion = 0, total = 0;
    for (const activity of Object.values(activities ?? {})) {
      if (activity.usage) {
        prompt += activity.usage.promptTokens ?? 0;
        completion += activity.usage.completionTokens ?? 0;
        total += activity.usage.totalTokens ?? 0;
      }
    }
    return { prompt, completion, total };
  }, [activities]);

  // Merge server stats + WS-derived stats
  const stats = useMemo(() => {
    const result = [...serverStats];
    // Add token usage if there's data
    if (tokenUsage.total > 0) {
      result.push({ label: "Tokens", value: tokenUsage.total.toLocaleString(), trend: "up", color: "text-violet-400", icon: Zap });
      result.push({ label: "Prompt", value: tokenUsage.prompt.toLocaleString(), trend: "flat", color: "text-indigo-400", icon: Hash });
      result.push({ label: "Completion", value: tokenUsage.completion.toLocaleString(), trend: "flat", color: "text-fuchsia-400", icon: Gauge });
    }
    if (result.length === 0) {
      return [
        { label: "HTTP Requests", value: offline ? "—" : "0", trend: "flat" as const, color: "text-blue-400", icon: BarChart3 },
        { label: "Avg Response", value: "—", trend: "flat" as const, color: "text-emerald-400", icon: Clock },
        { label: "Agent Runs", value: "—", trend: "flat" as const, color: "text-cyan-400", icon: Activity },
        { label: "Error Rate", value: "—", trend: "flat" as const, color: "text-amber-400", icon: AlertTriangle },
      ];
    }
    return result;
  }, [serverStats, tokenUsage, offline]);

  if (loading) {
    return (
      <div className="glass-card p-3">
        <h2 className="section-title text-[10px]">Metrics</h2>
        <div className="flex items-center justify-center py-3">
          <div className="h-3 w-3 border-2 border-blue-500/30 dark:border-blue-400/30 border-t-blue-500 dark:border-t-blue-400 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="section-title mb-0 text-[10px]">Metrics</h2>
        {offline && <span className="text-[8px] text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-full px-1.5 py-0">Offline</span>}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="flex items-center gap-2 rounded-lg px-2.5 py-2 border border-gray-200 dark:border-zinc-700/40 transition-all duration-200 hover:border-zinc-400 dark:hover:border-zinc-500/60 hover:shadow-sm">
              <div className={`flex h-6 w-6 items-center justify-center rounded-lg shrink-0 bg-gray-100 dark:bg-zinc-800/60`}>
                <Icon className={`h-3 w-3 ${stat.color}`} />
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-[8px] text-gray-500 dark:text-zinc-600 uppercase tracking-wider truncate">{stat.label}</p>
              </div>
              <span className={`text-[8px] font-medium ${stat.color} ml-auto shrink-0`}>
                {stat.trend === "up" ? "↑" : stat.trend === "down" ? "↓" : "→"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

function parsePrometheusMetrics(text: string): MetricStat[] {
  const stats: MetricStat[] = [];
  const lines = text.split("\n").filter(l => l && !l.startsWith("#"));

  // Find exact metric value (handles both `metric value` and `metric{label="x"} value`)
  const findExact = (name: string): string | null => {
    for (const l of lines) {
      if (l.startsWith(name + " ") || l.startsWith(name + "{")) {
        const m = l.match(/\s+(\d+(?:\.\d+)?)$/);
        if (m) return m[1];
      }
    }
    return null;
  };

  // Find labeled metric value
  const findLabeled = (name: string, labelMatch: string): string | null => {
    for (const l of lines) {
      if (l.includes(name + "{") && l.includes(labelMatch)) {
        const m = l.match(/\s+(\d+(?:\.\d+)?)$/);
        if (m) return m[1];
      }
    }
    return null;
  };

  // HTTP Requests
  const requests = findExact("aiyu_http_requests_total");
  if (requests) {
    stats.push({ label: "HTTP Requests", value: parseInt(requests).toLocaleString(), trend: "up", color: "text-blue-400", icon: BarChart3 });
  }

  // Avg Response Duration (from summary)
  const durationSum = findExact("aiyu_http_request_duration_seconds_sum");
  const durationCount = findExact("aiyu_http_request_duration_seconds_count");
  if (durationSum && durationCount) {
    const avg = parseFloat(durationSum) / parseInt(durationCount);
    const avgMs = Math.round(avg * 1000);
    stats.push({ label: "Avg Response", value: avgMs < 1000 ? `${avgMs}ms` : `${(avgMs / 1000).toFixed(1)}s`, trend: "flat", color: "text-emerald-400", icon: Clock });
  }

  // P95 latency
  const p95 = findLabeled("aiyu_http_request_duration_seconds", 'quantile="0.95"');
  if (p95) {
    const p95Ms = Math.round(parseFloat(p95) * 1000);
    stats.push({ label: "P95 Latency", value: p95Ms < 1000 ? `${p95Ms}ms` : `${(p95Ms / 1000).toFixed(1)}s`, trend: "flat", color: "text-teal-400", icon: Gauge });
  }

  // Agent Runs
  const agentRuns = findExact("aiyu_agent_runs");
  if (agentRuns) {
    stats.push({ label: "Agent Runs", value: parseInt(agentRuns).toLocaleString(), trend: parseInt(agentRuns) > 0 ? "up" : "flat", color: "text-cyan-400", icon: Activity });
  }

  // Commands
  const commands = findExact("aiyu_total_commands");
  if (commands) {
    stats.push({ label: "Commands", value: parseInt(commands).toLocaleString(), trend: "up", color: "text-amber-400", icon: Hash });
  }

  // Queue
  const queueRunning = findLabeled("aiyu_queue_size", 'type="running"');
  const queueQueued = findLabeled("aiyu_queue_size", 'type="queued"');
  if (queueRunning != null && queueQueued != null) {
    const totalQueue = parseInt(queueRunning) + parseInt(queueQueued);
    stats.push({ label: "Queue", value: String(totalQueue), trend: totalQueue > 0 ? "up" : "flat", color: "text-rose-400", icon: Cpu });
  }

  // Error Rate
  const errorRate = findExact("aiyu_error_rate");
  if (errorRate) {
    const rate = parseFloat(errorRate);
    stats.push({ label: "Error Rate", value: `${(rate * 100).toFixed(1)}%`, trend: rate > 0 ? "down" : "flat", color: rate > 0.05 ? "text-red-400" : "text-emerald-400", icon: AlertTriangle });
  }

  // Days Active
  const daysActive = findExact("aiyu_days_active");
  if (daysActive) {
    stats.push({ label: "Days Active", value: daysActive, trend: "flat", color: "text-zinc-400", icon: Minus });
  }

  // Test Runs
  const testRuns = findExact("aiyu_test_runs");
  if (testRuns && parseInt(testRuns) > 0) {
    stats.push({ label: "Test Runs", value: testRuns, trend: "flat", color: "text-lime-400", icon: TrendingUp });
  }

  return stats;
}
