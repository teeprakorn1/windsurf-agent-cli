/**
 * Unit tests for production-grade modules — circuit-breaker, request-queue, tracing, health-check
 */

const assert = require("assert");
const circuitBreaker = require("../../core/circuit-breaker");
const { RequestQueue } = require("../../core/request-queue");
const tracing = require("../../core/tracing");
const healthCheck = require("../../core/health-check");

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
    failed++;
  }
}

async function runAll() {
  console.log("\n🧪 Production Module Unit Tests\n");

  // ── Circuit Breaker ──────────────────────────────────────────────────

  await test("createBreaker initializes with CLOSED state", () => {
    const b = circuitBreaker.createBreaker("test-cb-1", { failureThreshold: 3, resetTimeoutMs: 5000 });
    assert.strictEqual(b.state, circuitBreaker.STATE.CLOSED);
    assert.strictEqual(b.failureCount, 0);
  });

  await test("canExecute returns true when CLOSED", () => {
    circuitBreaker.createBreaker("test-cb-2", { failureThreshold: 3 });
    assert.strictEqual(circuitBreaker.canExecute("test-cb-2"), true);
  });

  await test("recordFailure increments failure count", () => {
    circuitBreaker.createBreaker("test-cb-3", { failureThreshold: 3 });
    circuitBreaker.recordFailure("test-cb-3", new Error("test"));
    circuitBreaker.recordFailure("test-cb-3", new Error("test"));
    const status = circuitBreaker.getBreakerStatus("test-cb-3");
    assert.strictEqual(status.failureCount, 2);
    assert.strictEqual(status.state, circuitBreaker.STATE.CLOSED);
  });

  await test("breaker opens after exceeding failureThreshold", () => {
    circuitBreaker.createBreaker("test-cb-4", { failureThreshold: 2, resetTimeoutMs: 60000 });
    circuitBreaker.recordFailure("test-cb-4", new Error("fail1"));
    circuitBreaker.recordFailure("test-cb-4", new Error("fail2"));
    const status = circuitBreaker.getBreakerStatus("test-cb-4");
    assert.strictEqual(status.state, circuitBreaker.STATE.OPEN);
  });

  await test("canExecute returns false when OPEN", () => {
    // test-cb-4 is already OPEN from previous test
    assert.strictEqual(circuitBreaker.canExecute("test-cb-4"), false);
    // Cleanup for next test
    circuitBreaker.resetBreaker("test-cb-4");
  });

  await test("recordSuccess resets failure count and closes breaker", () => {
    circuitBreaker.createBreaker("test-cb-5", { failureThreshold: 2 });
    circuitBreaker.recordFailure("test-cb-5", new Error("fail"));
    circuitBreaker.recordSuccess("test-cb-5");
    const status = circuitBreaker.getBreakerStatus("test-cb-5");
    assert.strictEqual(status.failureCount, 0);
    assert.strictEqual(status.state, circuitBreaker.STATE.CLOSED);
  });

  await test("resetBreaker forces CLOSED state", () => {
    circuitBreaker.createBreaker("test-cb-6", { failureThreshold: 1, resetTimeoutMs: 60000 });
    circuitBreaker.recordFailure("test-cb-6", new Error("fail"));
    circuitBreaker.resetBreaker("test-cb-6");
    const status = circuitBreaker.getBreakerStatus("test-cb-6");
    assert.strictEqual(status.state, circuitBreaker.STATE.CLOSED);
    assert.strictEqual(status.failureCount, 0);
  });

  await test("getAllBreakerStatuses returns all breakers", () => {
    const statuses = circuitBreaker.getAllBreakerStatuses();
    assert.ok(statuses.length >= 6); // at least the 6 we created
    assert.ok(statuses.every(s => s.name && s.state));
  });

  // ── Request Queue ─────────────────────────────────────────────────────

  await test("RequestQueue enqueues and executes job", async () => {
    const q = new RequestQueue({ concurrency: 2, jobTimeoutMs: 1000 });
    const id = q.enqueue(() => Promise.resolve("done"));
    const result = await q.waitFor(id);
    assert.strictEqual(result, "done");
    q.destroy();
  });

  await test("RequestQueue tracks metrics", async () => {
    const q = new RequestQueue({ concurrency: 2, jobTimeoutMs: 1000 });
    const id1 = q.enqueue(() => Promise.resolve("a"));
    const id2 = q.enqueue(() => Promise.resolve("b"));
    await q.waitFor(id1);
    await q.waitFor(id2);
    const m = q.getMetrics();
    assert.strictEqual(m.totalEnqueued, 2);
    assert.strictEqual(m.totalCompleted, 2);
    q.destroy();
  });

  await test("RequestQueue rejects when full", async () => {
    const q = new RequestQueue({ concurrency: 1, maxQueueSize: 1, jobTimeoutMs: 1000 });
    // Fill the running slot + queue slot
    q.enqueue(() => new Promise(r => setTimeout(r, 50))); // fills running
    q.enqueue(() => new Promise(r => setTimeout(r, 50))); // fills queue
    // Wait briefly for the first job to start running
    await new Promise(r => setTimeout(r, 5));
    // This should throw since running=1 + queued=1 >= concurrency(1) + maxQueue(1)
    try {
      q.enqueue(() => Promise.resolve("overflow"));
      assert.fail("Should have thrown QUEUE_FULL");
    } catch (err) {
      assert.strictEqual(err.code, "QUEUE_FULL");
    }
    q.destroy();
  });

  await test("RequestQueue reports health", async () => {
    const q = new RequestQueue({ concurrency: 5, jobTimeoutMs: 1000 });
    const health = q.getHealth();
    assert.ok(["healthy", "degraded", "unhealthy"].includes(health.status));
    assert.strictEqual(typeof health.running, "number");
    assert.strictEqual(typeof health.queued, "number");
    q.destroy();
  });

  await test("RequestQueue handles job failure", async () => {
    const q = new RequestQueue({ concurrency: 2, jobTimeoutMs: 1000 });
    const id = q.enqueue(() => Promise.reject(new Error("job failed")));
    try {
      await q.waitFor(id);
      assert.fail("Should have thrown");
    } catch (err) {
      assert.ok(err.message.includes("job failed"));
    }
    const m = q.getMetrics();
    assert.strictEqual(m.totalFailed, 1);
    q.destroy();
  });

  await test("RequestQueue respects priority ordering", async () => {
    const q = new RequestQueue({ concurrency: 1, jobTimeoutMs: 1000 });
    const order = [];
    // Block the worker
    const blocker = q.enqueue(() => new Promise(r => setTimeout(r, 20)));
    // Enqueue with different priorities (higher = first)
    q.enqueue(() => { order.push("low"); return Promise.resolve(); }, { priority: 0 });
    q.enqueue(() => { order.push("high"); return Promise.resolve(); }, { priority: 10 });
    q.enqueue(() => { order.push("mid"); return Promise.resolve(); }, { priority: 5 });
    await q.waitFor(blocker);
    await new Promise(r => setTimeout(r, 50));
    assert.strictEqual(order[0], "high");
    assert.strictEqual(order[1], "mid");
    assert.strictEqual(order[2], "low");
    q.destroy();
  });

  // ── Tracing ───────────────────────────────────────────────────────────

  await test("startTrace creates trace with ID", () => {
    const traceId = tracing.startTrace("test.operation");
    assert.ok(traceId);
    assert.strictEqual(traceId.length, 32); // 16 bytes hex per OTel spec
  });

  await test("startSpan creates span within trace", () => {
    const traceId = tracing.startTrace("test.spans");
    const spanId = tracing.startSpan(traceId, "test.span1");
    assert.ok(spanId);
    assert.strictEqual(spanId.length, 16); // 8 bytes hex per OTel spec
  });

  await test("endSpan records duration", () => {
    const traceId = tracing.startTrace("test.duration");
    const spanId = tracing.startSpan(traceId, "test.span");
    tracing.endSpan(traceId, spanId, { result: "ok" });
    const trace = tracing.getTrace(traceId);
    const span = trace.spans.find(s => s.spanId === spanId);
    assert.ok(span.durationMs !== null);
    assert.strictEqual(span.status, "ok");
  });

  await test("endTrace records final status", () => {
    const traceId = tracing.startTrace("test.end");
    tracing.endTrace(traceId, "ok", { key: "value" });
    const trace = tracing.getTrace(traceId);
    assert.strictEqual(trace.status, "ok");
    assert.strictEqual(trace.attributes.key, "value");
    assert.ok(trace.durationMs !== null);
  });

  await test("getRecentTraces returns sorted list", () => {
    const id1 = tracing.startTrace("test.recent1");
    tracing.endTrace(id1, "ok");
    const id2 = tracing.startTrace("test.recent2");
    tracing.endTrace(id2, "error");
    const recent = tracing.getRecentTraces(5);
    assert.ok(recent.length >= 2);
    assert.ok(recent[0].startTime >= recent[1].startTime);
  });

  await test("getTraceMetrics returns summary", () => {
    const metrics = tracing.getTraceMetrics();
    assert.strictEqual(typeof metrics.total, "number");
    assert.strictEqual(typeof metrics.completed, "number");
    assert.strictEqual(typeof metrics.failed, "number");
    assert.strictEqual(typeof metrics.avgDurationMs, "number");
  });

  await test("exportOpenTelemetry produces valid structure", () => {
    const traceId = tracing.startTrace("test.otel");
    const spanId = tracing.startSpan(traceId, "test.otel.span");
    tracing.endSpan(traceId, spanId, { result: "ok" });
    tracing.endTrace(traceId, "ok");
    const otel = tracing.exportOpenTelemetry(traceId);
    assert.ok(otel.resourceSpans);
    assert.ok(otel.resourceSpans[0].scopeSpans);
    assert.ok(otel.resourceSpans[0].scopeSpans[0].spans.length > 0);
  });

  await test("addSpanEvent records event on span", () => {
    const traceId = tracing.startTrace("test.events");
    const spanId = tracing.startSpan(traceId, "test.span.events");
    tracing.addSpanEvent(traceId, spanId, "cache_hit", { key: "test" });
    tracing.endSpan(traceId, spanId);
    const trace = tracing.getTrace(traceId);
    const span = trace.spans.find(s => s.spanId === spanId);
    assert.strictEqual(span.events.length, 1);
    assert.strictEqual(span.events[0].name, "cache_hit");
  });

  // ── Health Check ─────────────────────────────────────────────────────

  await test("checkLiveness returns alive status", () => {
    const liveness = healthCheck.checkLiveness();
    assert.strictEqual(liveness.status, "alive");
    assert.strictEqual(typeof liveness.uptimeMs, "number");
    assert.strictEqual(liveness.pid, process.pid);
  });

  await test("checkReadiness returns component checks", async () => {
    const readiness = await healthCheck.checkReadiness(process.cwd());
    assert.ok(readiness.checks);
    assert.ok(readiness.checks.memory);
    assert.ok(readiness.checks.llmProviders);
    assert.strictEqual(readiness.checks.llmProviders.mock, "available");
  });

  await test("getFullHealthReport includes system info", async () => {
    const report = await healthCheck.getFullHealthReport(process.cwd());
    assert.ok(report.timestamp);
    assert.ok(report.version);
    assert.ok(report.nodeVersion);
    assert.ok(report.system);
    assert.ok(report.system.cpuCount);
    assert.ok(report.system.totalMemoryMB);
  });

  // ── Summary ───────────────────────────────────────────────────────────

  console.log(`\n  Results: ${passed} passed, ${failed} failed, ${passed + failed} total\n`);
  if (failed > 0) {
    console.log("  ❌ Some tests FAILED\n");
    process.exit(1);
  } else {
    console.log("  ✅ All tests passed\n");
    process.exit(0);
  }
}

runAll().catch(err => {
  console.error(err);
  process.exit(1);
});
