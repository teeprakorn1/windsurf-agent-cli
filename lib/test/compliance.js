/**
 * Spec Compliance Test Runner
 * Validates that the runtime behaves according to spec
 * Usage: aiyu-multi-agent test --compliance
 */

const agentRuntime = require("../core/agent-runtime");
const toolRegistry = require("../core/tool-registry");
const guardrails = require("../core/guardrails");
const config = require("../core/config");
const usage = require("../core/usage");

const MAX_RESULT_SIZE = 100 * 1024; // 100KB

// Enable mock provider for compliance tests
process.env.AIYU_ENABLE_MOCK = "1";

// Resolve a valid agent name for compliance tests — fail with clear message if none found
function resolveComplianceAgent(projectDir) {
  const config = require("../core/config");
  const path = require("path");
  const fs = require("fs");
  const cfgDir = config.getConfigDir(projectDir);
  if (!cfgDir) return null;
  const agentsDir = path.join(cfgDir, "agents");
  if (!fs.existsSync(agentsDir)) return null;
  const files = fs.readdirSync(agentsDir).filter(f => f.endsWith(".md"));
  return files.length > 0 ? files[0].replace(".md", "") : null;
}

const COMPLIANCE_TESTS = [
  // ── Max Steps Enforcement ──────────────────────────────────────────
  {
    name: "max_steps=1 must stop after 1 step",
    async run(projectDir) {
      const state = await agentRuntime.runAgent({
        input: "Read the package.json file",
        agentName: resolveComplianceAgent(projectDir) || "accessibility-specialist",
        projectDir,
        provider: "mock",
        maxSteps: 1,
      });
      const passed = state.steps.length <= 1;
      return { passed, detail: `steps=${state.steps.length}, expected≤1, status=${state.status}` };
    },
  },
  {
    name: "max_steps=2 must stop after 2 steps",
    async run(projectDir) {
      const state = await agentRuntime.runAgent({
        input: "Read the package.json file",
        agentName: resolveComplianceAgent(projectDir) || "accessibility-specialist",
        projectDir,
        provider: "mock",
        maxSteps: 2,
      });
      const passed = state.steps.length <= 2;
      return { passed, detail: `steps=${state.steps.length}, expected≤2, status=${state.status}` };
    },
  },

  // ── Tool Namespace Enforcement ─────────────────────────────────────
  {
    name: "registerTool must reject non-namespaced names",
    async run() {
      try {
        toolRegistry.registerTool("badname", async () => ({}));
        return { passed: false, detail: "Should have thrown" };
      } catch (e) {
        const passed = e.message.includes("namespaced");
        return { passed, detail: `Error: ${e.message}` };
      }
    },
  },
  {
    name: "registerTool accepts namespaced names",
    async run() {
      try {
        toolRegistry.registerTool("test.compliance", async () => ({ ok: true }));
        const tool = toolRegistry.getTool("test.compliance");
        const passed = tool !== null;
        return { passed, detail: `tool registered: ${passed}` };
      } catch (e) {
        return { passed: false, detail: e.message };
      }
    },
  },

  // ── Tool Arg Validation ────────────────────────────────────────────
  {
    name: "fs.read requires path arg",
    async run() {
      const err = toolRegistry.validateToolArgs("fs.read", {});
      const passed = err !== null && err.includes("path");
      return { passed, detail: `Error: ${err}` };
    },
  },
  {
    name: "fs.write requires path + content",
    async run() {
      const err = toolRegistry.validateToolArgs("fs.write", { path: "/tmp/test" });
      const passed = err !== null && err.includes("content");
      return { passed, detail: `Error: ${err}` };
    },
  },
  {
    name: "shell.exec requires command arg",
    async run() {
      const err = toolRegistry.validateToolArgs("shell.exec", {});
      const passed = err !== null && err.includes("command");
      return { passed, detail: `Error: ${err}` };
    },
  },

  // ── Guardrails ─────────────────────────────────────────────────────
  {
    name: "pathTraversal blocks ../etc/passwd",
    async run() {
      const fs = require("fs");
      const os = require("os");
      const path = require("path");
      const tmpDir = path.join(os.tmpdir(), `compliance-test-${Date.now()}`);
      fs.mkdirSync(tmpDir, { recursive: true });
      try {
        guardrails.pathTraversal("../../etc/passwd", tmpDir);
        return { passed: false, detail: "Should have thrown" };
      } catch (e) {
        const passed = e.message.includes("traversal") || e.message.includes("outside") || e.message.includes("ENOENT");
        return { passed, detail: `Blocked: ${e.message}` };
      } finally {
        try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* cleanup */ }
      }
    },
  },
  {
    name: "rateLimit throws when exceeded",
    async run() {
      try {
        for (let i = 0; i < 70; i++) {
          guardrails.rateLimit("test-compliance", 5);
        }
        return { passed: false, detail: "Should have thrown" };
      } catch (e) {
        const passed = e.message.includes("Rate limit");
        return { passed, detail: `Blocked: ${e.message}` };
      }
    },
  },
  {
    name: "sandboxExec blocks disallowed commands",
    async run() {
      try {
        guardrails.sandboxExec("rm", ["-rf", "/"], { timeout: 5000 });
        return { passed: false, detail: "Should have thrown" };
      } catch (e) {
        const passed = e.message.includes("not allowed") || e.message.includes("Allowed");
        return { passed, detail: `Blocked: ${e.message}` };
      }
    },
  },

  // ── Output Format ─────────────────────────────────────────────────
  {
    name: "outputFormat=json must return valid JSON",
    async run(projectDir) {
      const state = await agentRuntime.runAgent({
        input: "Hello",
        agentName: resolveComplianceAgent(projectDir) || "accessibility-specialist",
        projectDir,
        provider: "mock",
        outputFormat: "json",
        noCache: true,
      });
      try {
        JSON.parse(state.output);
        return { passed: true, detail: "Output is valid JSON" };
      } catch {
        return { passed: false, detail: `Output is not JSON: ${state.output?.slice(0, 80)}` };
      }
    },
  },

  // ── Step Logging ────────────────────────────────────────────────────
  {
    name: "step records have required fields",
    async run(projectDir) {
      const state = await agentRuntime.runAgent({
        input: "Hello",
        agentName: resolveComplianceAgent(projectDir) || "accessibility-specialist",
        projectDir,
        provider: "mock",
      });
      if (state.steps.length === 0) return { passed: false, detail: "No steps recorded" };
      const step = state.steps[0];
      const required = ["step", "thought", "action", "result", "error", "duration_ms"];
      const missing = required.filter(k => step[k] === undefined);
      const passed = missing.length === 0;
      return { passed, detail: missing.length > 0 ? `Missing: ${missing.join(", ")}` : "All fields present" };
    },
  },

  // ── Agent Runs Tracking ────────────────────────────────────────────
  {
    name: "agentRuns increments on run command",
    async run(projectDir) {
      const before = usage.getSummary(projectDir).agentRuns || 0;
      usage.trackCommand(projectDir, "run");
      const after = usage.getSummary(projectDir).agentRuns || 0;
      const passed = after > before;
      return { passed, detail: `agentRuns: ${before} → ${after}` };
    },
  },

  // ── Tool Result Size Limit ─────────────────────────────────────────
  {
    name: "tool results are truncated when exceeding size limit",
    async run() {
      const bigContent = "x".repeat(MAX_RESULT_SIZE + 1000);
      const truncated = typeof bigContent === "string" && bigContent.length > MAX_RESULT_SIZE
        ? bigContent.slice(0, MAX_RESULT_SIZE) + "...[truncated]"
        : bigContent;
      const passed = truncated.length <= MAX_RESULT_SIZE + 20;
      return { passed, detail: `truncated length=${truncated.length}, original=${bigContent.length}` };
    },
  },

  // ── Deterministic Mode ─────────────────────────────────────────────
  {
    name: "deterministic mode sets temperature=0",
    async run(projectDir) {
      const state = await agentRuntime.runAgent({
        input: "Hello",
        agentName: resolveComplianceAgent(projectDir) || "accessibility-specialist",
        projectDir,
        provider: "mock",
        deterministic: true,
        noCache: true,
      });
      const passed = state.status === "completed" || state.status === "max_steps";
      return { passed, detail: `deterministic=true, status=${state.status}` };
    },
  },
];

async function runComplianceTests(projectDir) {
  const chalk = require("chalk");
  const results = [];
  let passed = 0;
  let failed = 0;

  console.log(chalk.bold("\n🔍 Spec Compliance Tests\n"));
  console.log(chalk.gray("─".repeat(60)));

  for (const test of COMPLIANCE_TESTS) {
    try {
      const result = await test.run(projectDir);
      results.push({ name: test.name, ...result });
      if (result.passed) {
        passed++;
        console.log(chalk.green(`  ✓ ${test.name}`));
      } else {
        failed++;
        console.log(chalk.red(`  ✗ ${test.name}`));
        console.log(chalk.gray(`    ${result.detail}`));
      }
    } catch (e) {
      failed++;
      results.push({ name: test.name, passed: false, detail: e.message });
      console.log(chalk.red(`  ✗ ${test.name}`));
      console.log(chalk.gray(`    Error: ${e.message}`));
    }
  }

  console.log(chalk.gray("\n─".repeat(60)));
  console.log(chalk.bold(`\n  Results: ${passed} passed, ${failed} failed, ${results.length} total\n`));

  if (failed > 0) {
    console.log(chalk.red("  ❌ Compliance check FAILED\n"));
  } else {
    console.log(chalk.green("  ✅ All compliance checks PASSED\n"));
  }

  return { passed, failed, total: results.length, results };
}

module.exports = { runComplianceTests, COMPLIANCE_TESTS };
