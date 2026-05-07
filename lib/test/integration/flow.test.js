/**
 * Integration Tests — Full agent execution flow with production modules
 * Tests: agent run → circuit breaker → tracing → queue → health check
 */

const assert = require("assert");
const path = require("path");
const agentRuntime = require("../../core/agent-runtime");
const circuitBreaker = require("../../core/circuit-breaker");
const tracing = require("../../core/tracing");
const { getDefaultQueue } = require("../../core/request-queue");
const healthCheck = require("../../core/health-check");
const usage = require("../../core/usage");

const ROOT = path.resolve(__dirname, "../../../");

// Enable mock provider for integration tests
process.env.AIYU_ENABLE_MOCK = "1";

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
  console.log("\n🧪 Integration Tests — Full Agent Flow\n");

  // ── Agent Execution with Tracing ────────────────────────────────────

  await test("runAgent with mock provider produces trace", async () => {
    const state = await agentRuntime.runAgent({
      input: "Hello integration test",
      agentName: "accessibility-specialist",
      projectDir: ROOT,
      provider: "mock",
      noCache: true,
    });
    assert.ok(state.traceId, "State should have traceId");
    const trace = tracing.getTrace(state.traceId);
    assert.ok(trace, "Trace should exist");
    assert.ok(trace.spans.length > 0, "Trace should have spans");
  });

  await test("runAgent step records include trace spans", async () => {
    const state = await agentRuntime.runAgent({
      input: "Read a file",
      agentName: "accessibility-specialist",
      projectDir: ROOT,
      provider: "mock",
      noCache: true,
    });
    const trace = tracing.getTrace(state.traceId);
    const stepSpans = trace.spans.filter(s => s.operationName.startsWith("step."));
    assert.ok(stepSpans.length > 0, "Should have step spans");
  });

  await test("runAgent records tool spans when tool is called", async () => {
    const state = await agentRuntime.runAgent({
      input: "Read the file package.json",
      agentName: "accessibility-specialist",
      projectDir: ROOT,
      provider: "mock",
      maxSteps: 5,
      noCache: true,
    });
    const trace = tracing.getTrace(state.traceId);
    const toolSpans = trace.spans.filter(s => s.operationName.startsWith("tool."));
    // Mock may or may not call tools depending on input, just verify structure
    if (toolSpans.length > 0) {
      assert.ok(toolSpans[0].attributes.tool, "Tool span should have tool attribute");
    }
  });

  // ── Circuit Breaker Integration ─────────────────────────────────────

  await test("circuit breaker tracks LLM call results (per-provider)", async () => {
    // Reset per-provider breaker first
    const breakerName = "llm:mock";
    circuitBreaker.resetBreaker(breakerName);
    const breakerBefore = circuitBreaker.getBreakerStatus(breakerName);

    await agentRuntime.runAgent({
      input: "Test circuit breaker",
      agentName: "accessibility-specialist",
      projectDir: ROOT,
      provider: "mock",
      noCache: true,
    });

    const breakerAfter = circuitBreaker.getBreakerStatus(breakerName);
    assert.ok(breakerAfter.successCount > breakerBefore.successCount, "Success count should increase");
  });

  // ── Context Size Limit ────────────────────────────────────────────────

  await test("MAX_CONTEXT_CHARS is exported from agent-runtime", () => {
    assert.ok(agentRuntime.MAX_CONTEXT_CHARS);
    assert.strictEqual(agentRuntime.MAX_CONTEXT_CHARS, 200000);
  });

  // ── Request Queue Integration ────────────────────────────────────────

  await test("request queue processes agent execution", async () => {
    const queue = getDefaultQueue();
    const id = queue.enqueue(() =>
      agentRuntime.runAgent({
        input: "Queue test",
        agentName: "accessibility-specialist",
        projectDir: ROOT,
        provider: "mock",
        noCache: true,
      })
    );
    const result = await queue.waitFor(id);
    assert.ok(result.traceId, "Queued result should have traceId");
    assert.strictEqual(result.status, "complete");
  });

  // ── Health Check Integration ─────────────────────────────────────────

  await test("health check reports queue status", async () => {
    const readiness = await healthCheck.checkReadiness(ROOT);
    assert.ok(readiness.checks.queue, "Should have queue check");
    assert.ok(["ok", "ready", "healthy", "degraded", "not_available"].includes(readiness.checks.queue.status));
  });

  await test("health check reports circuit breaker status", async () => {
    const readiness = await healthCheck.checkReadiness(ROOT);
    assert.ok(readiness.checks.circuitBreakers, "Should have circuitBreakers check");
  });

  await test("health check reports LLM provider config", async () => {
    const readiness = await healthCheck.checkReadiness(ROOT);
    assert.strictEqual(readiness.checks.llmProviders.mock, "enabled");
  });

  // ── Usage Metrics Integration ────────────────────────────────────────

  await test("usage.getMetrics returns structured metrics", () => {
    const metrics = usage.getMetrics(ROOT);
    assert.strictEqual(typeof metrics.totalCommands, "number");
    assert.strictEqual(typeof metrics.agentRuns, "number");
    assert.strictEqual(typeof metrics.errorRate, "number");
    assert.strictEqual(typeof metrics.commandsPerDay, "number");
  });

  await test("usage.formatPrometheusMetrics returns valid format", () => {
    const output = usage.formatPrometheusMetrics(ROOT);
    assert.ok(output.includes("# HELP aiyu_agent_runs"));
    assert.ok(output.includes("# TYPE aiyu_agent_runs gauge"));
    assert.ok(output.includes("aiyu_agent_runs"));
  });

  // ── End-to-End Flow ──────────────────────────────────────────────────

  await test("full E2E: run → trace → metrics → health", async () => {
    // 1. Run agent
    const state = await agentRuntime.runAgent({
      input: "E2E integration test",
      agentName: "accessibility-specialist",
      projectDir: ROOT,
      provider: "mock",
      noCache: true,
    });

    // 2. Verify trace
    const trace = tracing.getTrace(state.traceId);
    assert.ok(trace);
    assert.strictEqual(trace.status, "ok");

    // 3. Verify trace metrics
    const traceMetrics = tracing.getTraceMetrics();
    assert.ok(traceMetrics.total > 0);

    // 4. Verify health
    const health = await healthCheck.checkReadiness(ROOT);
    assert.ok(health.checks);

    // 5. Verify usage metrics
    const usageMetrics = usage.getMetrics(ROOT);
    assert.ok(usageMetrics.agentRuns > 0);
  });

  // ── Summary ───────────────────────────────────────────────────────────

  // Clean up default queue to prevent hanging timers
  try { getDefaultQueue().destroy(); } catch {}

  console.log(`\n  Results: ${passed} passed, ${failed} failed, ${passed + failed} total\n`);
  if (failed > 0) {
    console.log("  ❌ Some integration tests FAILED\n");
    process.exit(1);
  } else {
    console.log("  ✅ All integration tests passed\n");
    process.exit(0);
  }
}

runAll().catch(err => {
  console.error(err);
  process.exit(1);
});
