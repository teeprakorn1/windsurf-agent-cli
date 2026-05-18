/**
 * Health Check — System health monitoring endpoint
 *
 * Provides:
 * - Liveness check (is the process alive?)
 * - Readiness check (can it handle requests?)
 * - Component-level health (LLM providers, queue, breakers)
 * - Structured health report
 */

const os = require("os");
const http = require("http");
const https = require("https");
const config = require("./config");
const logger = require("./logger");

let _ollamaAgent = null;
let _ollamaAgentTransport = null;

const PKG = require("../../package.json");

let _startTime = Date.now();
let _initialized = false;

function markInitialized() {
  _initialized = true;
  _startTime = Date.now();
}

function checkLiveness() {
  return { status: "alive", uptimeMs: Date.now() - _startTime, pid: process.pid };
}

async function checkReadiness(projectDir) {
  const checks = {};

  // Config directory
  checks.config = config.configExists(projectDir)
    ? { status: "ok" }
    : { status: "not_configured", message: "Run `aiyu-multi-agent init` first" };

  // Memory usage
  const memUsage = process.memoryUsage();
  const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  checks.memory = memPercent < 90
    ? { status: "ok", heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024), heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024) }
    : { status: "warning", message: `High memory usage: ${Math.round(memPercent)}%`, heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024) };

  // Queue health
  try {
    const { getDefaultQueue } = require("./request-queue");
    const queue = getDefaultQueue();
    const qm = queue.getMetrics();
    checks.queue = { status: "ready", running: qm.running, queued: qm.queued };
  } catch (err) {
    logger.error("Error checking queue health:", err);
    checks.queue = { status: "not_available", message: `Queue health check failed: ${err.message}` };
  }

  // Circuit breakers (per-provider)
  try {
    const { getAllBreakerStatuses } = require("./circuit-breaker");
    const breakers = getAllBreakerStatuses();
    const openBreakers = breakers.filter(b => b.state === "open");
    checks.circuitBreakers = openBreakers.length === 0
      ? { status: "ok", count: breakers.length }
      : { status: "degraded", message: `${openBreakers.length} breaker(s) open`, openBreakers: openBreakers.map(b => b.name) };
  } catch (err) {
    logger.error("Error checking circuit breaker health:", err);
    checks.circuitBreakers = { status: "not_available", message: err.message };
  }

  // LLM providers (check if API keys are set, verify Ollama reachability)
  let ollamaStatus = "not_configured";
  if (process.env.OLLAMA_HOST) {
    const ollamaHost = process.env.OLLAMA_HOST;
    try {
      const ollamaUrl = new URL(ollamaHost);
      const transport = ollamaUrl.protocol === "https:" ? https : http;
      if (!_ollamaAgent || _ollamaAgentTransport !== transport) {
        _ollamaAgent = new transport.Agent({ keepAlive: false, timeout: 3000 });
        _ollamaAgentTransport = transport;
      }
      const checkResult = await new Promise((resolve, reject) => {
        const req = transport.request({ hostname: ollamaUrl.hostname, port: ollamaUrl.port, path: "/api/tags", method: "GET", timeout: 2000, agent: _ollamaAgent }, (res) => {
          res.resume();
          resolve(res.statusCode < 500 ? "available" : "unhealthy");
        });
        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
        req.end();
      });
      ollamaStatus = checkResult;
    } catch {
      if (_ollamaAgent) { _ollamaAgent.destroy(); _ollamaAgent = null; }
      ollamaStatus = "unreachable";
    }
  }

  const hasAnyProvider = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GROQ_API_KEY || process.env.OLLAMA_HOST;
  checks.llmProviders = {
    status: hasAnyProvider ? "ok" : "not_configured",
    message: hasAnyProvider ? undefined : "No LLM provider configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY, or OLLAMA_HOST.",
    openai: process.env.OPENAI_API_KEY ? "configured" : "not_configured",
    claude: process.env.ANTHROPIC_API_KEY ? "configured" : "not_configured",
    groq: process.env.GROQ_API_KEY ? "configured" : "not_configured",
    ollama: ollamaStatus,
    mock: "enabled",
  };

  // Overall status
  const allStatuses = Object.values(checks).map(c => c.status);
  const overall = allStatuses.includes("unhealthy") ? "not_ready"
    : allStatuses.includes("degraded") || allStatuses.includes("warning") ? "degraded"
    : checks.config.status === "not_configured" ? "not_ready"
    : allStatuses.includes("not_configured") ? "limited"
    : "ready";

  return {
    status: overall,
    initialized: _initialized,
    uptimeMs: Date.now() - _startTime,
    checks,
  };
}

async function getFullHealthReport(projectDir) {
  const liveness = checkLiveness();
  const readiness = await checkReadiness(projectDir);

  return {
    timestamp: new Date().toISOString(),
    version: PKG.version,
    nodeVersion: process.version,
    platform: process.platform,
    pid: process.pid,
    uptimeMs: liveness.uptimeMs,
    liveness: liveness.status,
    readiness: readiness.status,
    checks: readiness.checks,
    system: {
      cpuCount: os.cpus().length,
      totalMemoryMB: Math.round(os.totalmem() / 1024 / 1024),
      freeMemoryMB: Math.round(os.freemem() / 1024 / 1024),
      loadAvg: os.loadavg(),
    },
  };
}

module.exports = { checkLiveness, checkReadiness, getFullHealthReport, markInitialized };
