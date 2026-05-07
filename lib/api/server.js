/**
 * API Server — Express app with routes
 */

const express = require("express");
const cors = require("cors");
const apiConfig = require("./config");
const { apiKeyAuth, wsApiKeyAuth, requestIdMiddleware, requestLogger, shutdownGuard, errorHandler, notFoundHandler } = require("./middleware");
const healthCheck = require("../core/health-check");
const usage = require("../core/usage");
const tracing = require("../core/tracing");
const { mountJobRoutes } = require("./jobs");
const { mountHandoffRoutes } = require("./handoff");
const { rateLimitMiddleware } = require("./rate-limit");

// HTTP-specific metrics
let httpRequestsTotal = 0;
let httpRequestDurationMs = [];

// Sensitive route auth: requires API key OR localhost access
// Prevents exposing tool outputs, system prompts, and metrics to untrusted networks
function sensitiveRouteAuth(req, res, next) {
  const API_KEY = process.env.AIYU_API_KEY;
  // If API key is configured, require it for sensitive routes
  if (API_KEY) {
    return apiKeyAuth(req, res, next);
  }
  // No API key configured — only allow localhost (loopback) access
  const remoteIp = req.ip || req.connection.remoteAddress || "";
  const isLocal = remoteIp === "127.0.0.1" || remoteIp === "::1" || remoteIp === "::ffff:127.0.0.1" || remoteIp === "localhost";
  if (!isLocal) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Sensitive route requires API key or localhost access. Set AIYU_API_KEY env var." } });
  }
  next();
}

function createApp() {
  const app = express();

  // Trust proxy when explicitly enabled — required for correct req.ip behind reverse proxy
  if (process.env.AIYU_TRUST_PROXY === "true") {
    app.set("trust proxy", 1);
  }

  // Security headers
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (req.protocol === "https") {
      res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
    }
    next();
  });

  // Global middleware
  const corsOrigin = process.env.AIYU_CORS_ORIGIN || undefined;
  app.use(cors({ origin: corsOrigin, maxAge: 86400 })); // 24h preflight cache
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  app.use(requestIdMiddleware); // X-Request-Id propagation
  app.use(requestLogger);
  app.use(shutdownGuard);
  app.use(rateLimitMiddleware);
  // Skip apiKeyAuth for /health — K8s probes and load balancers need unauthenticated access
  app.use((req, res, next) => {
    if (req.path === "/health") return next();
    return apiKeyAuth(req, res, next);
  });

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

  // ── Metrics (Prometheus format) — requires API key or localhost ────
  app.get("/metrics", sensitiveRouteAuth, (req, res) => {
    res.type("text/plain");
    let output = usage.formatPrometheusMetrics(process.cwd());

    // HTTP-specific metrics
    output += `# HELP aiyu_http_requests_total Total HTTP requests\n`;
    output += `# TYPE aiyu_http_requests_total counter\n`;
    output += `aiyu_http_requests_total ${httpRequestsTotal}\n\n`;

    if (httpRequestDurationMs.length > 0) {
      const sorted = [...httpRequestDurationMs].sort((a, b) => a - b);
      const p50 = sorted[Math.floor((sorted.length - 1) * 0.5)];
      const p95 = sorted[Math.floor((sorted.length - 1) * 0.95)];
      const p99 = sorted[Math.floor((sorted.length - 1) * 0.99)];
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

  // ── Traces — requires API key or localhost ────────────────
  app.get("/traces", sensitiveRouteAuth, (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 20;
    const traces = tracing.getRecentTraces(limit);
    res.json({ traces });
  });

  app.get("/traces/:id", sensitiveRouteAuth, (req, res) => {
    const trace = tracing.getTrace(req.params.id);
    if (!trace) {
      const err = new Error("Trace not found");
      err.code = "NOT_FOUND";
      return res.status(404).json({ error: { code: "NOT_FOUND", message: `Trace ${req.params.id} not found` } });
    }
    res.json(trace);
  });

  // ── Agent Statuses ──────────────────────────────────
  app.get("/agents/statuses", sensitiveRouteAuth, (req, res) => {
    try {
      const { getAgentStatuses } = require("./ws");
      res.json(getAgentStatuses());
    } catch {
      res.status(503).json({ error: { code: "WS_NOT_AVAILABLE", message: "WebSocket module not loaded — agent statuses unavailable" } });
    }
  });

  // ── Agent List (for dashboard dropdown) ─────────────
  app.get("/agents/list", sensitiveRouteAuth, (req, res) => {
    try {
      const { listAvailableAgents } = require("../core/agent-loader");
      res.json(listAvailableAgents(process.cwd()));
    } catch (err) {
      res.status(500).json({ error: { code: "AGENT_LIST_ERROR", message: err.message } });
    }
  });

  // ── Jobs (async agent execution) ───────────────────────
  mountJobRoutes(app);

  // ── Handoff & Intervene ────────────────────────────────
  mountHandoffRoutes(app);

  // ── Catch-all ──────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
