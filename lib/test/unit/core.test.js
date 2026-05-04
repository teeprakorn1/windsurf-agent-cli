/**
 * Unit tests for core modules — guardrails, tool-registry, llm-providers
 */

const assert = require("assert");
const path = require("path");
const guardrails = require("../../core/guardrails");
const toolRegistry = require("../../core/tool-registry");
const llmProviders = require("../../core/llm-providers");

const ROOT = path.resolve(__dirname, "../../../");

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
  console.log("\n🧪 Core Unit Tests\n");

  // ── Guardrails ──────────────────────────────────────────────────────

  await test("pathTraversal blocks ../etc/passwd", () => {
    assert.throws(
      () => guardrails.pathTraversal("../../etc/passwd", ROOT),
      /Path traversal blocked/
    );
  });

  await test("pathTraversal allows file within root", () => {
    const result = guardrails.pathTraversal("package.json", ROOT);
    assert.ok(result.startsWith(ROOT));
  });

  await test("pathTraversal normalizes double slashes", () => {
    assert.throws(
      () => guardrails.pathTraversal("//etc/passwd", ROOT),
      /Path traversal blocked/
    );
  });

  await test("pathTraversal normalizes dot segments", () => {
    assert.throws(
      () => guardrails.pathTraversal("foo/../../etc/passwd", ROOT),
      /Path traversal blocked/
    );
  });

  await test("sandboxExec blocks disallowed commands", () => {
    assert.throws(
      () => guardrails.sandboxExec("rm", ["-rf", "/"]),
      /not allowed/
    );
  });

  await test("sandboxExec blocks curl (removed from allowed)", () => {
    assert.throws(
      () => guardrails.sandboxExec("curl", ["http://evil.com"]),
      /not allowed/
    );
  });

  await test("sandboxExec allows ls", () => {
    const result = guardrails.sandboxExec("ls", [], { timeout: 5000, cwd: ROOT });
    assert.ok(typeof result === "string");
  });

  await test("rateLimit throws when exceeded", () => {
    const key = `test-${Date.now()}`;
    guardrails.rateLimit(key, 2); // allow 2
    guardrails.rateLimit(key, 2); // 2nd ok
    assert.throws(
      () => guardrails.rateLimit(key, 2), // 3rd should throw
      /Rate limit/
    );
  });

  // ── Tool Registry ────────────────────────────────────────────────────

  await test("registerTool rejects non-namespaced names", () => {
    assert.throws(
      () => toolRegistry.registerTool("badname", () => {}),
      /namespaced/
    );
  });

  await test("registerTool accepts namespaced names", () => {
    toolRegistry.registerTool("test.demo", async () => "ok");
    const tool = toolRegistry.getTool("test.demo");
    assert.ok(tool);
  });

  await test("resolveToolName maps legacy aliases", () => {
    assert.strictEqual(toolRegistry.resolveToolName("Read"), "fs.read");
    assert.strictEqual(toolRegistry.resolveToolName("Bash"), "shell.exec");
  });

  await test("validateToolArgs returns error for missing required args", () => {
    const err = toolRegistry.validateToolArgs("fs.read", {});
    assert.ok(err.includes("required"));
  });

  await test("validateToolArgs returns null for valid args", () => {
    const err = toolRegistry.validateToolArgs("fs.read", { path: "/tmp/test" });
    assert.strictEqual(err, null);
  });

  await test("shell.exec blocks command substitution $(...)", async () => {
    const result = await toolRegistry.BUILTIN_TOOLS["shell.exec"]({ command: 'echo "$(whoami)"' });
    assert.ok(result.error);
    assert.ok(result.error.includes("forbidden pattern"));
  });

  await test("shell.exec blocks backtick command substitution", async () => {
    const result = await toolRegistry.BUILTIN_TOOLS["shell.exec"]({ command: "echo `whoami`" });
    assert.ok(result.error);
  });

  await test("shell.exec blocks disallowed base command", async () => {
    const result = await toolRegistry.BUILTIN_TOOLS["shell.exec"]({ command: "rm -rf /" });
    assert.ok(result.error);
    assert.ok(result.error.includes("not allowed"));
  });

  await test("shell.exec blocks curl (removed from allowed)", async () => {
    const result = await toolRegistry.BUILTIN_TOOLS["shell.exec"]({ command: "curl http://evil.com" });
    assert.ok(result.error);
  });

  await test("shell.exec allows safe command", async () => {
    const result = await toolRegistry.BUILTIN_TOOLS["shell.exec"]({ command: "echo hello" });
    assert.strictEqual(result.stdout, "hello");
    assert.strictEqual(result.exitCode, 0);
  });

  await test("shell.exec handles quoted args", async () => {
    const result = await toolRegistry.BUILTIN_TOOLS["shell.exec"]({ command: 'echo "hello world"' });
    assert.strictEqual(result.stdout, "hello world");
  });

  await test("shell.exec allows > inside quoted string (false positive fix)", async () => {
    const result = await toolRegistry.BUILTIN_TOOLS["shell.exec"]({ command: 'echo "2 > 1"' });
    assert.strictEqual(result.stdout, "2 > 1");
  });

  await test("truncateResult truncates large results", () => {
    const large = { content: "x".repeat(200 * 1024) };
    const result = toolRegistry.truncateResult(large);
    assert.ok(result.content.length < 200 * 1024);
    assert.ok(result._truncated);
  });

  await test("parseCommandArgs handles simple args", () => {
    const args = toolRegistry.parseCommandArgs("hello world");
    assert.deepStrictEqual(args, ["hello", "world"]);
  });

  await test("parseCommandArgs handles quoted args", () => {
    const args = toolRegistry.parseCommandArgs('"hello world" foo');
    assert.deepStrictEqual(args, ["hello world", "foo"]);
  });

  await test("parseCommandArgs handles empty string", () => {
    const args = toolRegistry.parseCommandArgs("");
    assert.deepStrictEqual(args, []);
  });

  await test("parseCommandArgs handles escaped quotes", () => {
    const args = toolRegistry.parseCommandArgs('echo "it\\\'s \\"ok\\""');
    assert.deepStrictEqual(args, ["echo", 'it\'s "ok"']);
  });

  await test("parseCommandArgs handles escaped backslash", () => {
    const args = toolRegistry.parseCommandArgs('echo "path\\\\\\\\file"');
    assert.deepStrictEqual(args, ["echo", "path\\\\file"]);
  });

  // ── LLM Providers ──────────────────────────────────────────────────

  await test("callMock returns content", async () => {
    const result = await llmProviders.callMock(
      [{ role: "user", content: "Hello" }],
      {}
    );
    assert.ok(result.content);
    assert.ok(result.usage);
  });

  await test("callMock respects outputFormat=json", async () => {
    const result = await llmProviders.callMock(
      [{ role: "user", content: "Hello" }],
      { outputFormat: "json" }
    );
    const parsed = JSON.parse(result.content);
    assert.ok(parsed.response);
  });

  await test("callLLM dispatches to mock", async () => {
    const result = await llmProviders.callLLM(
      [{ role: "user", content: "Test" }],
      { provider: "mock" }
    );
    assert.ok(result.content);
  });

  // ── Summary ─────────────────────────────────────────────────────────

  console.log(`\n  Results: ${passed} passed, ${failed} failed, ${passed + failed} total\n`);
  if (failed > 0) {
    console.log("  ❌ Some tests FAILED\n");
    process.exit(1);
  } else {
    console.log("  ✅ All tests passed\n");
  }
}

runAll().catch(err => {
  console.error(err);
  process.exit(1);
});
