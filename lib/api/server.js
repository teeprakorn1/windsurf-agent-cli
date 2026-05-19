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

  // ── Run from Note (markdown with frontmatter) ──────────
  app.post("/agents/run-from-note", sensitiveRouteAuth, async (req, res, next) => {
    try {
      const path = require("path");
      const fs = require("fs");
      const guardrails = require("../core/guardrails");
      const utils = require("../utils");
      const { parseNoteFile } = require("../commands/run-from-file");
      const { getDefaultQueue } = require("../core/request-queue");
      const agentRuntime = require("../core/agent-runtime");

      const { file, agent_name, provider, model, max_steps, output_format, no_form, no_quality_gate, strict_quality_gate } = req.body || {};

      if (!file || typeof file !== "string") {
        const err = new Error("Missing required field: file (relative path to markdown note)");
        err.code = "VALIDATION_ERROR";
        return next(err);
      }

      // Validate and resolve path against project root (no traversal)
      const projectDir = process.cwd();
      const resolved = path.isAbsolute(file) ? file : path.resolve(projectDir, file);
      try {
        guardrails.pathTraversal(resolved, projectDir);
      } catch (err) {
        err.code = "VALIDATION_ERROR";
        return next(err);
      }

      let stat;
      try { stat = fs.statSync(resolved); } catch { stat = null; }
      if (!stat || !stat.isFile()) {
        const err = new Error(`File not found: ${file}`);
        err.code = "VALIDATION_ERROR";
        return next(err);
      }

      const MAX_FILE_SIZE = 1024 * 1024; // 1MB
      if (stat.size > MAX_FILE_SIZE) {
        const err = new Error(`File too large (>${MAX_FILE_SIZE} bytes)`);
        err.code = "VALIDATION_ERROR";
        return next(err);
      }

      const parsed = parseNoteFile(resolved);
      const fm = parsed.frontmatter || {};
      const input = parsed.content;
      if (!input || input.length === 0) {
        const err = new Error("No task body found in file (after frontmatter)");
        err.code = "VALIDATION_ERROR";
        return next(err);
      }

      // Validate input length (defense-in-depth — reject oversized content before consuming queue slot)
      const { MAX_INPUT_LENGTH } = require("../core/input-sanitizer");
      if (input.length > MAX_INPUT_LENGTH) {
        const err = new Error(`Input too long (${input.length} chars, max ${MAX_INPUT_LENGTH})`);
        err.code = "VALIDATION_ERROR";
        return next(err);
      }

      const resolvedAgent = agent_name || fm.agent || utils.findDefaultAgent(projectDir);
      if (!resolvedAgent) {
        const err = new Error("No agent specified (frontmatter `agent:` or body) and no default agent found");
        err.code = "VALIDATION_ERROR";
        return next(err);
      }
      if (!utils.isValidAgentName(resolvedAgent)) {
        const err = new Error(`Invalid agent name: "${resolvedAgent}"`);
        err.code = "VALIDATION_ERROR";
        return next(err);
      }

      // Resolve max_steps from body or frontmatter (coerce string→number for consistency)
      let resolvedMaxSteps = max_steps !== undefined ? parseInt(max_steps, 10) : undefined;
      if ((resolvedMaxSteps === undefined || !Number.isFinite(resolvedMaxSteps)) && fm.maxSteps !== undefined) {
        const n = parseInt(fm.maxSteps, 10);
        if (!Number.isFinite(n)) {
          const err = new Error(`Invalid maxSteps in frontmatter: ${fm.maxSteps}`);
          err.code = "VALIDATION_ERROR";
          return next(err);
        }
        resolvedMaxSteps = n;
      }
      if (resolvedMaxSteps !== undefined && (!Number.isFinite(resolvedMaxSteps) || resolvedMaxSteps < 1 || resolvedMaxSteps > 50)) {
        const err = new Error("max_steps must be a number between 1 and 50");
        err.code = "VALIDATION_ERROR";
        return next(err);
      }

      const resolvedProvider = provider || fm.provider || apiConfig.LLM_PROVIDER;
      const resolvedModel = model || fm.model || undefined;

      const { isAnyLlmAvailable } = require("../core/agent-runtime");
      if (!isAnyLlmAvailable()) {
        const err = new Error("All LLM circuit breakers open");
        err.code = "CIRCUIT_OPEN";
        return next(err);
      }

      const queue = getDefaultQueue();
      const jobFn = async () => {
        const result = await agentRuntime.runAgent({
          input,
          agentName: resolvedAgent,
          projectDir,
          provider: resolvedProvider,
          model: resolvedModel,
          maxSteps: resolvedMaxSteps ?? apiConfig.MAX_STEPS,
          json: true,
          noCache: true,
          outputFormat: output_format || fm.outputFormat,
          noForm: no_form || fm.noForm,
          noQualityGate: no_quality_gate || fm.noQualityGate,
          strictQualityGate: strict_quality_gate || fm.strictQualityGate,
        });
        usage.trackCommand(projectDir, "run-from-note", { via: "api" });
        return result;
      };

      let jobId;
      try {
        jobId = queue.enqueue(jobFn, { priority: 0, timeout: apiConfig.JOB_TIMEOUT_MS });
      } catch (err) {
        if (err.code === "QUEUE_FULL") return next(err);
        throw err;
      }

      res.status(202).json({ jobId, status: "queued", agent: resolvedAgent, provider: resolvedProvider });
    } catch (err) {
      next(err);
    }
  });

  // ── Jobs (async agent execution) ───────────────────────
  mountJobRoutes(app);

  // ── Artifacts (retrieve from completed job) ──────────────
  app.get("/artifacts/:jobId", sensitiveRouteAuth, (req, res) => {
    const { getDefaultQueue } = require("../core/request-queue");
    const queue = getDefaultQueue();
    const job = queue.getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: { code: "JOB_NOT_FOUND", message: `Job ${req.params.jobId} not found` } });
    }
    if (job.status !== "completed" && job.status !== "done") {
      return res.status(409).json({ error: { code: "JOB_NOT_READY", message: `Job ${req.params.jobId} is not completed (${job.status})` } });
    }
    const artifacts = (job.result && job.result.artifacts) || [];
    res.json({ jobId: req.params.jobId, artifacts });
  });

  // ── Handoff & Intervene ────────────────────────────────
  mountHandoffRoutes(app);

  // ── Catch-all ──────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
