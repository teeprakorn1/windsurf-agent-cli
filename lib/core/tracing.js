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

const traces = new Map();
const MAX_TRACES = 500;
const TRACE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function generateTraceId() {
  return crypto.randomBytes(8).toString("hex");
}

function generateSpanId() {
  return crypto.randomBytes(4).toString("hex");
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
      if (now - t.startTime > TRACE_TTL_MS || traces.size > MAX_TRACES) {
        traces.delete(id);
      }
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
      ? completed.map(t => t.durationMs || 0).sort((a, b) => a - b)[Math.floor(completed.length * 0.95)] || 0
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
};
