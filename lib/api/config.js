/**
 * API Config — Environment variables + error codes
 */

module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 3000,
  QUEUE_CONCURRENCY: parseInt(process.env.QUEUE_CONCURRENCY, 10) || 5,
  QUEUE_MAX: parseInt(process.env.QUEUE_MAX, 10) || 100,
  LLM_TIMEOUT_MS: parseInt(process.env.LLM_TIMEOUT_MS, 10) || 30000,
  JOB_TIMEOUT_MS: parseInt(process.env.JOB_TIMEOUT_MS, 10) || 300000,
  LLM_PROVIDER: process.env.LLM_PROVIDER || undefined,
  MAX_STEPS: parseInt(process.env.MAX_STEPS, 10) || 10,
  RATE_LIMIT_PER_SEC: parseInt(process.env.RATE_LIMIT_PER_SEC, 10) || 10,
  SHUTDOWN_TIMEOUT_MS: parseInt(process.env.SHUTDOWN_TIMEOUT_MS, 10) || 10000,
};

const ERROR_CODES = {
  UNAUTHORIZED: { status: 401, message: "Unauthorized — API key required" },
  QUEUE_FULL: { status: 429, message: "Queue full — try again later" },
  CIRCUIT_OPEN: { status: 503, message: "LLM provider circuit breaker open — service unavailable" },
  SHUTTING_DOWN: { status: 503, message: "Server is shutting down" },
  VALIDATION_ERROR: { status: 400, message: "Invalid input" },
  NOT_FOUND: { status: 404, message: "Not found" },
  RATE_LIMITED: { status: 429, message: "Rate limit exceeded" },
  INTERNAL_ERROR: { status: 500, message: "Internal server error" },
  JOB_NOT_FOUND: { status: 404, message: "Job not found" },
};

function errorCodeToHttp(code) {
  const entry = ERROR_CODES[code];
  if (!entry) return { status: 500, message: code };
  return entry;
}

module.exports.ERROR_CODES = ERROR_CODES;
module.exports.errorCodeToHttp = errorCodeToHttp;
