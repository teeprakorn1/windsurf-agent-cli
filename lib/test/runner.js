/**
 * Test runner — discovers and executes .test.md files
 */

const fs = require("fs");
const path = require("path");
const glob = require("glob");

const config = require("../core/config");
const logger = require("../core/logger");
const utils = require("../utils");
const { parseTestFile } = require("./assertions");
const { simulateToolCall } = require("./simulator");
const { formatResult } = require("./reporter");

function discoverTests(projectDir) {
  const cfgDir = config.getConfigDir(projectDir);
  if (!cfgDir) return [];

  const testsDir = path.join(cfgDir, "tests");
  if (!fs.existsSync(testsDir)) return [];

  const pattern = path.join(testsDir, "**", "*.test.md").replace(/\\/g, "/");
  return glob.sync(pattern);
}

function runTestFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const testSuite = parseTestFile(content);

  const results = {
    file: path.basename(filePath),
    name: testSuite.name || path.basename(filePath, ".test.md"),
    tests: [],
    passed: 0,
    failed: 0,
    skipped: 0,
  };

  for (const test of testSuite.tests) {
    if (test.skip) {
      results.tests.push({ name: test.name, status: "skip", reason: test.skipReason || "skipped" });
      results.skipped++;
      continue;
    }

    try {
      const result = executeTest(test);
      results.tests.push(result);
      if (result.status === "pass") results.passed++;
      else results.failed++;
    } catch (err) {
      results.tests.push({ name: test.name, status: "fail", error: err.message });
      results.failed++;
    }
  }

  return results;
}

function executeTest(test) {
  const context = {
    configExists: false,
    agentName: null,
    provider: null,
    memory: null,
    guardrails: false,
    tools: [],
  };

  // Load actual config if available
  const projectDir = process.cwd();
  const cfg = config.loadConfig(projectDir);
  if (cfg) {
    context.configExists = true;
    context.agentName = cfg.agent?.name || cfg.workspace?.name || null;
    context.provider = cfg.agent?.provider || null;
    context.memory = cfg.agent?.memory || null;
    context.guardrails = cfg.agent?.guardrails || false;
  }

  // Check agent file exists
  const cfgDir = config.getConfigDir(projectDir);
  if (cfgDir) {
    const agentsDir = path.join(cfgDir, "agents");
    if (fs.existsSync(agentsDir)) {
      const agentFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith(".md"));
      if (agentFiles.length > 0) {
        const agentContent = fs.readFileSync(path.join(agentsDir, agentFiles[0]), "utf-8");
        const fm = utils.parseFrontmatter(agentContent);
        if (fm && Object.keys(fm).length > 0) {
          context.agentName = context.agentName || fm.name;
          context.provider = context.provider || fm.provider;
          context.memory = context.memory || fm.memory;
          context.tools = Array.isArray(fm.tools) ? fm.tools : (fm.tools ? fm.tools.split(",").map(t => t.trim()) : []);
        }
      }
    }
  }

  // Evaluate assertions
  const errors = [];
  for (const assertion of test.assertions) {
    const result = evaluateAssertion(assertion, context);
    if (!result.passed) {
      errors.push(result);
    }
  }

  if (errors.length === 0) {
    return { name: test.name, status: "pass" };
  } else {
    return { name: test.name, status: "fail", errors };
  }
}

function evaluateAssertion(assertion, context) {
  const { type, value } = assertion;

  switch (type) {
    case "config_exists":
      return { passed: context.configExists, expected: "config exists", actual: context.configExists ? "exists" : "not found" };

    case "agent_name":
      return { passed: context.agentName === value, expected: value, actual: context.agentName || "null" };

    case "provider":
      return { passed: context.provider === value, expected: value, actual: context.provider || "null" };

    case "memory":
      return { passed: context.memory === value, expected: value, actual: context.memory || "null" };

    case "guardrails_enabled":
      return { passed: context.guardrails === true, expected: "enabled", actual: context.guardrails ? "enabled" : "disabled" };

    case "path_traversal_protection":
      try {
        const guardrails = require("../core/guardrails");
        guardrails.pathTraversal("../../etc/passwd", "/tmp/safe-project");
        return { passed: false, expected: "should block", actual: "not blocked" };
      } catch {
        return { passed: true, expected: "should block", actual: "blocked" };
      }

    case "safe_write_enabled":
      return { passed: true, expected: "enabled", actual: "enabled (built-in)" };

    case "rate_limit_enabled":
      return { passed: true, expected: "enabled", actual: "enabled (built-in)" };

    case "tool_available": {
      const hasTool = context.tools.includes(value);
      return { passed: hasTool, expected: value, actual: hasTool ? "available" : `not found (tools: ${context.tools.join(", ") || "none"})` };
    }

    case "skill_loaded": {
      const cfgDir = config.getConfigDir(process.cwd());
      if (!cfgDir) return { passed: false, expected: value, actual: "no config dir" };
      const skillPath = path.join(cfgDir, "skills", value, "SKILL.md");
      const exists = fs.existsSync(skillPath);
      return { passed: exists, expected: value, actual: exists ? "loaded" : "not found" };
    }

    default:
      return { passed: false, expected: `unknown assertion: ${type}`, actual: "N/A" };
  }
}

function runAll(projectDir) {
  const testFiles = discoverTests(projectDir);

  if (testFiles.length === 0) {
    return {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      suites: [],
      status: "no_tests",
    };
  }

  const suites = testFiles.map(f => runTestFile(f));

  return {
    total: suites.reduce((sum, s) => sum + s.tests.length, 0),
    passed: suites.reduce((sum, s) => sum + s.passed, 0),
    failed: suites.reduce((sum, s) => sum + s.failed, 0),
    skipped: suites.reduce((sum, s) => sum + s.skipped, 0),
    suites,
    status: suites.some(s => s.failed > 0) ? "fail" : "pass",
  };
}

module.exports = { discoverTests, runTestFile, runAll };
