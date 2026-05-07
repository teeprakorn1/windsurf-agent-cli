/**
 * Tracing — Distributed tracing for agent execution
 *
 * Provides:
 * - Request-level trace IDs
 * - Span tracking for each step/tool call
 * - Structured trace output (compatible with OpenTelemetry format)
 * - Trace storage and retrieval for debugging
 */

const logger = require("./logger");
const crypto = require("crypto");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

const traces = new Map();
const MAX_TRACES = 500;
const TRACE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Periodic cleanup timer — removes stale traces even when no new traces are created
let _cleanupTimer = null;
function _startCleanupTimer() {
  if (_cleanupTimer) return;
  _cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, t] of traces) {
      if (t.endTime && now - t.endTime > TRACE_TTL_MS) {
        traces.delete(id);
      }
    }
  }, TRACE_TTL_MS);
  _cleanupTimer.unref(); // don't keep process alive
}
_startCleanupTimer();

// Persistent trace storage
let _traceDir = null;
const TRACE_FILE_MAX_BYTES = 10 * 1024 * 1024; // 10MB rotation

function enablePersistentTraces(dir) {
  _traceDir = dir;
  try {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`Persistent traces enabled: ${dir}`);
  } catch (err) {
    logger.warn(`Failed to create trace dir: ${err.message}`);
    _traceDir = null;
  }
}

// Async write queue — batches trace writes to avoid blocking the event loop
const _writeQueue = [];
let _writeInProgress = false;

async function _flushWriteQueue() {
  if (_writeInProgress || _writeQueue.length === 0) return;
  _writeInProgress = true;
  const batch = _writeQueue.splice(0, _writeQueue.length);
  try {
    const filePath = path.join(_traceDir, "traces.jsonl");
    // Rotate if file too large
    try {
      const stat = await fsp.stat(filePath);
      if (stat.size > TRACE_FILE_MAX_BYTES) {
        const backup = path.join(_traceDir, `traces-${crypto.randomUUID()}.jsonl`);
        await fsp.rename(filePath, backup);
      }
    } catch { /* file doesn't exist yet — ok */ }
    const lines = batch.map(t => JSON.stringify(t) + "\n").join("");
    await fsp.appendFile(filePath, lines);
  } catch (err) {
    logger.debug(`Trace file write failed: ${err.message}`);
  } finally {
    _writeInProgress = false;
    // If more items queued while we were writing, schedule next flush via setImmediate (prevents unbounded recursion)
    if (_writeQueue.length > 0) setImmediate(_flushWriteQueue);
  }
}

function _appendTraceToFile(trace) {
  if (!_traceDir) return;
  _writeQueue.push(trace);
  _flushWriteQueue(); // fire-and-forget async
}

function generateTraceId() {
  return crypto.randomBytes(16).toString("hex"); // 32 hex chars per OTel spec
}

function generateSpanId() {
  return crypto.randomBytes(8).toString("hex"); // 16 hex chars per OTel spec
}

function startTrace(operationName, meta = {}) {
  const traceId = generateTraceId();
  const trace = {
    traceId,
    operationName,
    startTime: Date.now(),
    endTime: null,
    durationMs: null,
    status: "running",
    meta,
    spans: [],
    attributes: {},
  };
  traces.set(traceId, trace);

  // Cleanup old traces — FIFO eviction (Map preserves insertion order)
  if (traces.size > MAX_TRACES) {
    const now = Date.now();
    for (const [id, t] of traces) {
      if (traces.size <= MAX_TRACES) break;
      if (now - t.startTime > TRACE_TTL_MS) {
        traces.delete(id);
      }
    }
    // If still over limit after TTL eviction, remove oldest until within limit
    while (traces.size > MAX_TRACES) {
      const firstKey = traces.keys().next().value;
      traces.delete(firstKey);
    }
  }

  logger.debug(`Trace [${traceId}] started: ${operationName}`);
  return traceId;
}

function startSpan(traceId, operationName, attributes = {}) {
  const trace = traces.get(traceId);
  if (!trace) return null;

  const spanId = generateSpanId();
  const span = {
    traceId,
    spanId,
    operationName,
    startTime: Date.now(),
    endTime: null,
    durationMs: null,
    status: "ok",
    attributes,
    events: [],
  };

  trace.spans.push(span);
  logger.debug(`Trace [${traceId}] span [${spanId}]: ${operationName}`);
  return spanId;
}

function endSpan(traceId, spanId, result = {}) {
  const trace = traces.get(traceId);
  if (!trace) return;

  const span = trace.spans.find(s => s.spanId === spanId);
  if (!span) return;

  span.endTime = Date.now();
  span.durationMs = span.endTime - span.startTime;
  span.status = result.error ? "error" : "ok";

  if (result.error) {
    span.attributes["error.message"] = result.error;
    span.attributes["error.type"] = result.errorType || "runtime";
  }
  if (result.result) {
    span.attributes["result.summary"] = typeof result.result === "string"
      ? result.result.slice(0, 200)
      : JSON.stringify(result.result).slice(0, 200);
  }
}

function addSpanEvent(traceId, spanId, name, attributes = {}) {
  const trace = traces.get(traceId);
  if (!trace) return;
  const span = trace.spans.find(s => s.spanId === spanId);
  if (!span) return;
  span.events.push({ name, timestamp: Date.now(), attributes });
}

function endTrace(traceId, status = "ok", attributes = {}) {
  const trace = traces.get(traceId);
  if (!trace) return;

  trace.endTime = Date.now();
  trace.durationMs = trace.endTime - trace.startTime;
  trace.status = status;
  Object.assign(trace.attributes, attributes);

  logger.debug(`Trace [${traceId}] ended: ${trace.operationName} (${trace.durationMs}ms, status=${status})`);
  _appendTraceToFile(trace);
  return trace;
}

function getTrace(traceId) {
  const trace = traces.get(traceId);
  if (!trace) return null;

  return {
    traceId: trace.traceId,
    operationName: trace.operationName,
    startTime: trace.startTime,
    endTime: trace.endTime,
    durationMs: trace.durationMs,
    status: trace.status,
    meta: trace.meta,
    attributes: trace.attributes,
    spans: trace.spans.map(s => ({
      spanId: s.spanId,
      operationName: s.operationName,
      startTime: s.startTime,
      endTime: s.endTime,
      durationMs: s.durationMs,
      status: s.status,
      attributes: s.attributes,
      events: s.events,
    })),
  };
}

function getRecentTraces(limit = 20) {
  const all = [...traces.values()]
    .sort((a, b) => b.startTime - a.startTime)
    .slice(0, limit)
    .map(t => ({
      traceId: t.traceId,
      operationName: t.operationName,
      status: t.status,
      durationMs: t.durationMs,
      spanCount: t.spans.length,
      startTime: t.startTime,
    }));
  return all;
}

function getTraceMetrics() {
  const all = [...traces.values()].filter(t => t.endTime);
  const completed = all.filter(t => t.status === "ok");
  const failed = all.filter(t => t.status === "error");

  return {
    total: all.length,
    completed: completed.length,
    failed: failed.length,
    avgDurationMs: completed.length > 0
      ? Math.round(completed.reduce((s, t) => s + (t.durationMs || 0), 0) / completed.length)
      : 0,
    p95DurationMs: completed.length > 0
      ? completed.map(t => t.durationMs || 0).sort((a, b) => a - b)[Math.min(Math.round((completed.length - 1) * 0.95), completed.length - 1)] || 0
      : 0,
    totalSpans: all.reduce((s, t) => s + t.spans.length, 0),
  };
}

function exportOpenTelemetry(traceId) {
  const trace = traces.get(traceId);
  if (!trace) return null;

  return {
    resourceSpans: [{
      scopeSpans: [{
        spans: trace.spans.map(s => ({
          traceId: s.traceId,
          spanId: s.spanId,
          name: s.operationName,
          kind: 1,
          startTimeUnixNano: s.startTime * 1000000,
          endTimeUnixNano: s.endTime ? s.endTime * 1000000 : undefined,
          status: { code: s.status === "ok" ? 1 : 2 },
          attributes: Object.entries(s.attributes).map(([k, v]) => ({ key: k, value: { stringValue: String(v) } })),
        })),
      }],
    }],
  };
}

module.exports = {
  startTrace,
  endTrace,
  startSpan,
  endSpan,
  addSpanEvent,
  getTrace,
  getRecentTraces,
  getTraceMetrics,
  exportOpenTelemetry,
  enablePersistentTraces,
};
