/**
 * API Server — Express app with routes
 */

const express = require("express");
const cors = require("cors");
const apiConfig = require("./config");
const { requestLogger, shutdownGuard, errorHandler, notFoundHandler } = require("./middleware");
const healthCheck = require("../core/health-check");
const usage = require("../core/usage");
const tracing = require("../core/tracing");
const { mountJobRoutes } = require("./jobs");
const { rateLimitMiddleware } = require("./rate-limit");

// HTTP-specific metrics
let httpRequestsTotal = 0;
let httpRequestDurationMs = [];

function createApp() {
  const app = express();

  // Global middleware
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  app.use(requestLogger);
  app.use(shutdownGuard);
  app.use(rateLimitMiddleware);

  // HTTP metrics middleware
  app.use((req, res, next) => {
    httpRequestsTotal++;
    const start = Date.now();
    res.on("finish", () => {
      httpRequestDurationMs.push(Date.now() - start);
      if (httpRequestDurationMs.length > 1000) httpRequestDurationMs.shift();
    });
    next();
  });

  // ── Health ────────────────────────────────────────────
  app.get("/health", async (req, res) => {
    const report = await healthCheck.getFullHealthReport(process.cwd());
    const status = report.readiness === "ready" ? 200 : report.readiness === "degraded" || report.readiness === "limited" ? 200 : 503;
    res.status(status).json(report);
  });

  // ── Metrics (Prometheus format) ────────────────────────
  app.get("/metrics", (req, res) => {
    res.type("text/plain");
    let output = usage.formatPrometheusMetrics(process.cwd());

    // HTTP-specific metrics
    output += `# HELP aiyu_http_requests_total Total HTTP requests\n`;
    output += `# TYPE aiyu_http_requests_total counter\n`;
    output += `aiyu_http_requests_total ${httpRequestsTotal}\n\n`;

    if (httpRequestDurationMs.length > 0) {
      const sorted = [...httpRequestDurationMs].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      const avg = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
      output += `# HELP aiyu_http_request_duration_seconds HTTP request duration\n`;
      output += `# TYPE aiyu_http_request_duration_seconds summary\n`;
      output += `aiyu_http_request_duration_seconds{quantile="0.5"} ${(p50 / 1000).toFixed(3)}\n`;
      output += `aiyu_http_request_duration_seconds{quantile="0.95"} ${(p95 / 1000).toFixed(3)}\n`;
      output += `aiyu_http_request_duration_seconds{quantile="0.99"} ${(p99 / 1000).toFixed(3)}\n`;
      output += `aiyu_http_request_duration_seconds_sum ${(sorted.reduce((a, b) => a + b, 0) / 1000).toFixed(3)}\n`;
      output += `aiyu_http_request_duration_seconds_count ${sorted.length}\n\n`;
    }

    // Queue metrics
    try {
      const { getDefaultQueue } = require("../core/request-queue");
      const queue = getDefaultQueue();
      const qm = queue.getMetrics();
      output += `# HELP aiyu_queue_size Current queue size\n`;
      output += `# TYPE aiyu_queue_size gauge\n`;
      output += `aiyu_queue_size{type="running"} ${qm.running}\n`;
      output += `aiyu_queue_size{type="queued"} ${qm.queued}\n\n`;
    } catch { /* queue not initialized */ }

    res.send(output);
  });

  // ── Traces ─────────────────────────────────────────────
  app.get("/traces", (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 20;
    const traces = tracing.getRecentTraces(limit);
    res.json({ traces });
  });

  app.get("/traces/:id", (req, res) => {
    const trace = tracing.getTrace(req.params.id);
    if (!trace) {
      const err = new Error("Trace not found");
      err.code = "NOT_FOUND";
      return res.status(404).json({ error: { code: "NOT_FOUND", message: `Trace ${req.params.id} not found` } });
    }
    res.json(trace);
  });

  // ── Jobs (async agent execution) ───────────────────────
  mountJobRoutes(app);

  // ── Catch-all ──────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
