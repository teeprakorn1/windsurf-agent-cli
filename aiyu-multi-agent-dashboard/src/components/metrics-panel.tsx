"use client";

import { memo, useEffect, useState } from "react";
import { BarChart3, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricStat {
  label: string;
  value: string;
  trend: "up" | "down" | "flat";
  color: string;
  icon: typeof BarChart3;
}

export const MetricsPanel = memo(function MetricsPanel() {
  const [stats, setStats] = useState<MetricStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const poll = async () => {
      try {
        const res = await fetch("/api/metrics", { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to fetch");
        const text = await res.text();
        setStats(parsePrometheusMetrics(text));
        setOffline(false);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setOffline(true);
        setStats([
          { label: "HTTP Requests", value: "—", trend: "flat", color: "text-blue-400", icon: BarChart3 },
          { label: "Avg Duration", value: "—", trend: "flat", color: "text-emerald-400", icon: TrendingDown },
          { label: "Token Usage", value: "—", trend: "flat", color: "text-cyan-400", icon: TrendingUp },
          { label: "Queue Size", value: "—", trend: "flat", color: "text-amber-400", icon: Minus },
        ]);
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

  if (loading) {
    return (
      <div className="glass-card p-4">
        <h2 className="section-title">Metrics</h2>
        <div className="flex items-center justify-center py-4">
          <div className="h-4 w-4 border-2 border-blue-500/30 dark:border-blue-400/30 border-t-blue-500 dark:border-t-blue-400 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="section-title mb-0">Metrics</h2>
        {offline && <span className="text-[9px] text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-full px-2 py-0.5">Offline</span>}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-lg bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800/40 p-3 transition-all duration-200 hover:border-gray-300 dark:hover:border-zinc-700/50">
              <div className="flex items-center justify-between mb-1">
                <Icon className="h-3 w-3 text-gray-500 dark:text-zinc-600" />
                <span className={`text-[9px] font-medium ${stat.color}`}>
                  {stat.trend === "up" ? "↑" : stat.trend === "down" ? "↓" : "→"}
                </span>
              </div>
              <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-[9px] text-gray-500 dark:text-zinc-600 uppercase tracking-wider">{stat.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
});

function parsePrometheusMetrics(text: string): MetricStat[] {
  const stats: MetricStat[] = [];

  // Only match lines that start with the metric name (not # HELP / # TYPE comments)
  const lines = text.split("\n");
  const findMetric = (name: string) => lines.find(l => l.startsWith(name))?.match(/\s+(\d+(?:\.\d+)?)$/)?.[1];

  const requests = findMetric("aiyu_http_requests_total");
  if (requests) {
    stats.push({ label: "HTTP Requests", value: parseInt(requests).toLocaleString(), trend: "up", color: "text-blue-400", icon: BarChart3 });
  }

  const durationSum = findMetric("aiyu_http_request_duration_seconds_sum");
  const durationCount = findMetric("aiyu_http_request_duration_seconds_count");
  if (durationSum && durationCount) {
    const avg = parseFloat(durationSum) / parseInt(durationCount);
    const avgMs = Math.round(avg * 1000);
    stats.push({ label: "Avg Response", value: avgMs < 1000 ? `${avgMs}ms` : `${(avgMs / 1000).toFixed(1)}s`, trend: "flat", color: "text-emerald-400", icon: TrendingDown });
  }

  const agentRuns = findMetric("aiyu_agent_runs");
  if (agentRuns) {
    stats.push({ label: "Agent Runs", value: agentRuns, trend: agentRuns === "0" ? "flat" : "up", color: "text-cyan-400", icon: TrendingUp });
  }

  const commands = findMetric("aiyu_total_commands");
  if (commands) {
    stats.push({ label: "Commands", value: commands, trend: "up", color: "text-amber-400", icon: Minus });
  }

  const queueRunning = lines.find(l => l.includes('aiyu_queue_size{type="running"}'))?.match(/\s+(\d+)$/)?.[1];
  const queueQueued = lines.find(l => l.includes('aiyu_queue_size{type="queued"}'))?.match(/\s+(\d+)$/)?.[1];
  if (queueRunning && queueQueued) {
    const totalQueue = parseInt(queueRunning) + parseInt(queueQueued);
    stats.push({ label: "Queue", value: String(totalQueue), trend: totalQueue === 0 ? "flat" : "up", color: "text-rose-400", icon: Minus });
  }

  const errorRate = findMetric("aiyu_error_rate");
  if (errorRate) {
    const rate = parseFloat(errorRate);
    stats.push({ label: "Error Rate", value: `${(rate * 100).toFixed(1)}%`, trend: rate > 0 ? "down" : "flat", color: rate > 0 ? "text-red-400" : "text-emerald-400", icon: TrendingDown });
  }

  if (stats.length === 0) {
    return [
      { label: "HTTP Requests", value: "—", trend: "flat", color: "text-blue-400", icon: BarChart3 },
      { label: "Avg Response", value: "—", trend: "flat", color: "text-emerald-400", icon: TrendingDown },
      { label: "Agent Runs", value: "—", trend: "flat", color: "text-cyan-400", icon: TrendingUp },
      { label: "Error Rate", value: "—", trend: "flat", color: "text-amber-400", icon: Minus },
    ];
  }
  return stats;
}
