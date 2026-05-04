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
const config = require("./config");
const logger = require("./logger");

let _startTime = Date.now();
let _initialized = false;

function markInitialized() {
  _initialized = true;
  _startTime = Date.now();
}

function checkLiveness() {
  return { status: "alive", uptimeMs: Date.now() - _startTime, pid: process.pid };
}

function checkReadiness(projectDir) {
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
    checks.queue = queue.getHealth();
  } catch {
    checks.queue = { status: "not_available" };
  }

  // Circuit breakers
  try {
    const { getAllBreakerStatuses } = require("./circuit-breaker");
    const breakers = getAllBreakerStatuses();
    const openBreakers = breakers.filter(b => b.state === "open");
    checks.circuitBreakers = openBreakers.length === 0
      ? { status: "ok", count: breakers.length }
      : { status: "degraded", message: `${openBreakers.length} breaker(s) open`, openBreakers: openBreakers.map(b => b.name) };
  } catch {
    checks.circuitBreakers = { status: "not_available" };
  }

  // LLM providers (check if API keys are set)
  checks.llmProviders = {
    openai: process.env.OPENAI_API_KEY ? "configured" : "not_configured",
    claude: process.env.ANTHROPIC_API_KEY ? "configured" : "not_configured",
    ollama: "local",
    mock: "available",
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

function getFullHealthReport(projectDir) {
  const liveness = checkLiveness();
  const readiness = checkReadiness(projectDir);

  return {
    timestamp: new Date().toISOString(),
    version: require("../../package.json").version,
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
