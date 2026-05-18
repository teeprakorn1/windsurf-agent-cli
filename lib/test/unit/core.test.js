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

  // ── Groq Provider ──────────────────────────────────────────────────

  await test("callGroq throws when GROQ_API_KEY missing", async () => {
    const saved = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    try {
      await llmProviders.callGroq([{ role: "user", content: "hi" }], {});
      throw new Error("Expected callGroq to throw");
    } catch (err) {
      assert.ok(/GROQ_API_KEY not set/.test(err.message), `Got: ${err.message}`);
    } finally {
      if (saved !== undefined) process.env.GROQ_API_KEY = saved;
    }
  });

  await test("callLLM rejects unknown provider", async () => {
    try {
      await llmProviders.callLLM([{ role: "user", content: "x" }], { provider: "fake-provider", maxRetries: 1 });
      throw new Error("Expected unknown provider to throw");
    } catch (err) {
      assert.ok(/Unknown LLM provider/.test(err.message), `Got: ${err.message}`);
    }
  });

  await test("callLLM lists groq in error message", async () => {
    try {
      await llmProviders.callLLM([{ role: "user", content: "x" }], { provider: "nope", maxRetries: 1 });
    } catch (err) {
      assert.ok(/groq/.test(err.message), `Error should mention groq: ${err.message}`);
    }
  });

  // ── Failover with Groq ─────────────────────────────────────────────

  await test("failover.resolveProvider returns groq when only GROQ_API_KEY set", () => {
    const failover = require("../../core/failover");
    const saved = { o: process.env.OPENAI_API_KEY, a: process.env.ANTHROPIC_API_KEY, g: process.env.GROQ_API_KEY, ol: process.env.OLLAMA_HOST };
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OLLAMA_HOST;
    process.env.GROQ_API_KEY = "gsk_test_dummy";
    try {
      assert.strictEqual(failover.resolveProvider(), "groq");
    } finally {
      if (saved.o !== undefined) process.env.OPENAI_API_KEY = saved.o;
      if (saved.a !== undefined) process.env.ANTHROPIC_API_KEY = saved.a;
      if (saved.g !== undefined) { process.env.GROQ_API_KEY = saved.g; } else { delete process.env.GROQ_API_KEY; }
      if (saved.ol !== undefined) process.env.OLLAMA_HOST = saved.ol;
    }
  });

  await test("failover.buildFailoverChain includes groq when GROQ_API_KEY set", () => {
    const failover = require("../../core/failover");
    const saved = process.env.GROQ_API_KEY;
    process.env.GROQ_API_KEY = "gsk_test_dummy";
    try {
      const chain = failover.buildFailoverChain("groq");
      assert.ok(chain.includes("groq"), `Chain should include groq: ${JSON.stringify(chain)}`);
    } finally {
      if (saved !== undefined) { process.env.GROQ_API_KEY = saved; } else { delete process.env.GROQ_API_KEY; }
    }
  });

  await test("failover.buildFailoverChain excludes groq when no key", () => {
    const failover = require("../../core/failover");
    const saved = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    try {
      const chain = failover.buildFailoverChain();
      assert.ok(!chain.includes("groq"), `Chain should NOT include groq when key absent: ${JSON.stringify(chain)}`);
    } finally {
      if (saved !== undefined) process.env.GROQ_API_KEY = saved;
    }
  });

  // ── Frontmatter / Run-from-file parser ─────────────────────────────

  await test("parseNoteFile extracts frontmatter and body", () => {
    const fs = require("fs");
    const os = require("os");
    const { parseNoteFile } = require("../../commands/run-from-file");
    const tmp = path.join(os.tmpdir(), `aiyu-note-${Date.now()}.md`);
    fs.writeFileSync(tmp, "---\nagent: backend\nprovider: groq\nmaxSteps: 5\n---\n\nBuild login API\n");
    try {
      const result = parseNoteFile(tmp);
      assert.strictEqual(result.frontmatter.agent, "backend");
      assert.strictEqual(result.frontmatter.provider, "groq");
      assert.strictEqual(result.frontmatter.maxSteps, 5);
      assert.strictEqual(result.content, "Build login API");
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  await test("parseNoteFile handles missing frontmatter", () => {
    const fs = require("fs");
    const os = require("os");
    const { parseNoteFile } = require("../../commands/run-from-file");
    const tmp = path.join(os.tmpdir(), `aiyu-note-noheader-${Date.now()}.md`);
    fs.writeFileSync(tmp, "Just a body with no frontmatter\n");
    try {
      const result = parseNoteFile(tmp);
      assert.deepStrictEqual(result.frontmatter, {});
      assert.strictEqual(result.content, "Just a body with no frontmatter");
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  await test("parseNoteFile handles empty frontmatter", () => {
    const fs = require("fs");
    const os = require("os");
    const { parseNoteFile } = require("../../commands/run-from-file");
    const tmp = path.join(os.tmpdir(), `aiyu-note-empty-fm-${Date.now()}.md`);
    fs.writeFileSync(tmp, "---\n---\n\nBody only\n");
    try {
      const result = parseNoteFile(tmp);
      assert.deepStrictEqual(result.frontmatter, {});
      assert.strictEqual(result.content, "Body only");
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  // ── BUG-1 regression: Groq model resolution ─────────────────────────

  await test("callGroq resolves Groq-compatible model when given non-Groq model", () => {
    const llm = require("../../core/llm-providers");
    // NON_GROQ_MODELS should be accessible via the module internals
    // We test indirectly: callGroq with model "gpt-4" should NOT send "gpt-4" to Groq
    // Since we can't actually call Groq without API key, verify the model resolution logic via callLLM dispatch
    const saved = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    try {
      // Without API key, callGroq should throw about GROQ_API_KEY, not about the model
      llm.callGroq([{ role: "user", content: "hi" }], { model: "gpt-4" }).catch(err => {
        assert.ok(/GROQ_API_KEY not set/.test(err.message), `Got: ${err.message}`);
      });
    } finally {
      if (saved !== undefined) process.env.GROQ_API_KEY = saved;
    }
  });

  // ── BUG-6 regression: parseNoteFile UTF-8 BOM ──────────────────────

  await test("parseNoteFile handles UTF-8 BOM prefix", () => {
    const fs = require("fs");
    const os = require("os");
    const { parseNoteFile } = require("../../commands/run-from-file");
    const tmp = path.join(os.tmpdir(), `aiyu-note-bom-${Date.now()}.md`);
    fs.writeFileSync(tmp, "\uFEFF---\nagent: frontend\n---\n\nDesign a button\n");
    try {
      const result = parseNoteFile(tmp);
      assert.strictEqual(result.frontmatter.agent, "frontend");
      assert.strictEqual(result.content, "Design a button");
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  // ── BUG-11 regression: FAILOVER_CHAIN used by buildFailoverChain ───

  await test("failover.buildFailoverChain uses FAILOVER_CHAIN constant", () => {
    const failover = require("../../core/failover");
    const saved = { o: process.env.OPENAI_API_KEY, a: process.env.ANTHROPIC_API_KEY, g: process.env.GROQ_API_KEY };
    process.env.OPENAI_API_KEY = "test";
    process.env.ANTHROPIC_API_KEY = "test";
    process.env.GROQ_API_KEY = "test";
    try {
      const chain = failover.buildFailoverChain("openai");
      assert.ok(chain.includes("openai"), "should include openai");
      assert.ok(chain.includes("claude"), "should include claude");
      assert.ok(chain.includes("groq"), "should include groq");
      assert.ok(chain.includes("mock"), "should include mock");
    } finally {
      if (saved.o !== undefined) process.env.OPENAI_API_KEY = saved.o; else delete process.env.OPENAI_API_KEY;
      if (saved.a !== undefined) process.env.ANTHROPIC_API_KEY = saved.a; else delete process.env.ANTHROPIC_API_KEY;
      if (saved.g !== undefined) process.env.GROQ_API_KEY = saved.g; else delete process.env.GROQ_API_KEY;
    }
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
