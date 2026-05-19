const assert = require("assert");
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

const cliScanner = require("../../core/cli-scanner");
const genericAdapter = require("../../core/cli-adapters/generic-adapter");
const claudeAdapter = require("../../core/cli-adapters/claude-adapter");
const codexAdapter = require("../../core/cli-adapters/codex-adapter");
const questionForm = require("../../core/question-form");
const qualityGate = require("../../core/quality-gate");
const artifactParser = require("../../core/artifact-parser");
const llmProviders = require("../../core/llm-providers");
const failover = require("../../core/failover");
const healthCheck = require("../../core/health-check");

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
  console.log("\n🧪 V2.7.9 Feature Unit Tests\n");

  // ── CLI Scanner ─────────────────────────────────────────────────────
  await test("cliScanner.scanPath detects missing binary", () => {
    const registry = cliScanner.scanPath({ names: ["nonexistent-cli-12345"], pathValue: "/usr/local/bin" });
    assert.strictEqual(registry["nonexistent-cli-12345"].available, false);
  });

  await test("cliScanner.getEngine returns null for unknown", () => {
    const engine = cliScanner.getEngine("nonexistent");
    assert.strictEqual(engine, null);
  });

  await test("cliScanner.detectVersion returns null for missing binary", () => {
    const version = cliScanner.detectVersion(null);
    assert.strictEqual(version, null);
  });

  await test("cliScanner.buildCliRegistry caches results", () => {
    cliScanner.clearCache();
    const r1 = cliScanner.buildCliRegistry({ names: ["node"] });
    const r2 = cliScanner.buildCliRegistry({ names: ["node"] });
    assert.strictEqual(r1, r2);
  });

  await test("genericAdapter.messagesToPrompt formats messages", () => {
    const prompt = genericAdapter.messagesToPrompt([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" },
    ]);
    assert.ok(prompt.includes("USER: Hello"));
    assert.ok(prompt.includes("ASSISTANT: Hi"));
  });

  await test("claudeAdapter.buildEngine sets default args", () => {
    const engine = claudeAdapter.buildEngine({ name: "claude", path: "/usr/bin/claude" });
    assert.deepStrictEqual(engine.args, ["--print", "{prompt}"]);
  });

  await test("codexAdapter.buildEngine sets default args", () => {
    const engine = codexAdapter.buildEngine({ name: "codex", path: "/usr/bin/codex" });
    assert.deepStrictEqual(engine.args, ["--quiet", "-a", "{prompt}"]);
  });

  await test("llmProviders.callLLM rejects unknown cli engine", async () => {
    await assert.rejects(
      llmProviders.callLLM([{ role: "user", content: "hi" }], { provider: "cli:nonexistent" }),
      /CLI engine not available/
    );
  });

  await test("failover.buildFailoverChain includes cli engines when available", () => {
    const original = process.env.PATH;
    try {
      process.env.PATH = "/usr/local/bin";
      cliScanner.clearCache();
      const chain = failover.buildFailoverChain("openai");
      assert.ok(chain.includes("mock"));
    } finally {
      process.env.PATH = original;
      cliScanner.clearCache();
    }
  });

  await test("healthCheck.checkReadiness includes cli report", async () => {
    const report = await healthCheck.checkReadiness(ROOT);
    assert.ok(report.checks.llmProviders.cli);
    assert.ok(typeof report.checks.llmProviders.cli === "object");
  });

  // ── Question Form ─────────────────────────────────────────────────────
  await test("questionForm.shouldInject on build request turn 1", () => {
    assert.strictEqual(questionForm.shouldInjectQuestionForm("build a dashboard", { turn: 1 }), true);
  });

  await test("questionForm.shouldInject skips on turn 2", () => {
    assert.strictEqual(questionForm.shouldInjectQuestionForm("build a dashboard", { turn: 2 }), false);
  });

  await test("questionForm.shouldInject respects noForm", () => {
    assert.strictEqual(questionForm.shouldInjectQuestionForm("build a dashboard", { turn: 1, noForm: true }), false);
  });

  await test("questionForm.shouldInject ignores non-matching input", () => {
    assert.strictEqual(questionForm.shouldInjectQuestionForm("what is 2+2", { turn: 1 }), false);
  });

  await test("questionForm.maybeInject adds system message", () => {
    const messages = [{ role: "system", content: "base" }, { role: "user", content: "create app" }];
    const injected = questionForm.maybeInjectQuestionForm(messages, "create app", { turn: 1 });
    assert.strictEqual(injected, true);
    assert.strictEqual(messages.length, 3);
    assert.ok(messages[1].content.includes("Question-Form"));
  });

  // ── Quality Gate ──────────────────────────────────────────────────────
  await test("qualityGate.checkQuality detects banned phrase", () => {
    const result = qualityGate.checkQuality("I'd be happy to help you build this.");
    assert.ok(result.violations.some(v => v.message.includes("generic assistant")));
    assert.strictEqual(result.score, 80);
  });

  await test("qualityGate.checkQuality passes clean output", () => {
    const result = qualityGate.checkQuality("Here is the implementation.");
    assert.strictEqual(result.pass, true);
    assert.strictEqual(result.score, 100);
  });

  await test("qualityGate.applyQualityGate attaches metadata", () => {
    const state = { output: "I'd be happy to help" };
    qualityGate.applyQualityGate(state, {});
    assert.ok(state.quality);
    assert.ok(state.quality.violations.length > 0);
    assert.strictEqual(state.quality.mode, "warn");
  });

  await test("qualityGate.applyQualityGate bypass when noQualityGate", () => {
    const state = { output: "I'd be happy to help" };
    qualityGate.applyQualityGate(state, { noQualityGate: true });
    assert.strictEqual(state.quality, undefined);
  });

  await test("qualityGate strict mode marks error on p0 violation", () => {
    const state = { output: "Use eval(x) here" };
    qualityGate.applyQualityGate(state, { strict: true });
    assert.strictEqual(state.status, "error");
    assert.ok(state.error.includes("Quality gate failed"));
  });

  // ── Artifact Parser ───────────────────────────────────────────────────
  await test("artifactParser.parseArtifacts single artifact", () => {
    const text = 'Here is the code:\n<artifact type="js" filename="app.js">\nconst x = 1;\n</artifact>\nDone.';
    const result = artifactParser.parseArtifacts(text);
    assert.strictEqual(result.artifacts.length, 1);
    assert.strictEqual(result.artifacts[0].filename, "app.js");
    assert.strictEqual(result.artifacts[0].type, "js");
    assert.ok(result.text.includes("Here is the code:"));
  });

  await test("artifactParser.parseArtifacts multiple artifacts", () => {
    const text = '<artifact type="html" filename="a.html">A</artifact><artifact type="css" filename="b.css">B</artifact>';
    const result = artifactParser.parseArtifacts(text);
    assert.strictEqual(result.artifacts.length, 2);
  });

  await test("artifactParser.parseArtifacts ignores unsupported type", () => {
    const text = '<artifact type="zip" filename="a.zip">data</artifact>';
    const result = artifactParser.parseArtifacts(text);
    assert.strictEqual(result.artifacts.length, 0);
    assert.ok(result.text.includes("<artifact"));
  });

  await test("artifactParser.parseArtifacts unclosed tag fallback", () => {
    const text = '<artifact type="js" filename="a.js">const x=1;';
    const result = artifactParser.parseArtifacts(text);
    assert.strictEqual(result.artifacts.length, 0);
    assert.strictEqual(result.text, text);
  });

  await test("artifactParser.sanitizeFilename prevents traversal", () => {
    const name = artifactParser.sanitizeFilename("../../../etc/passwd", "safe.txt");
    assert.strictEqual(name, "safe.txt");
  });

  await test("artifactParser.sanitizeFilename normalizes slashes", () => {
    const name = artifactParser.sanitizeFilename("foo/bar\\baz.js", "default.js");
    assert.strictEqual(name, "foo/bar/baz.js");
  });

  console.log(`\n  Results: ${passed} passed, ${failed} failed, ${passed + failed} total\n`);
  if (failed > 0) process.exitCode = 1;
}

runAll();
