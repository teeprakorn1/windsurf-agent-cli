/**
 * aiyu-multi-agent test — Run agent test suite
 */

const chalk = require("chalk");
const chokidar = require("fs");

const config = require("../core/config");
const runner = require("../test/runner");
const { formatSummary, formatTAP } = require("../test/reporter");
const { runComplianceTests } = require("../test/compliance");

async function run(options = {}) {
  const projectDir = process.cwd();

  if (!config.configExists(projectDir)) {
    console.log(chalk.red("No config directory found. Run `aiyu-multi-agent init` first.\n"));
    return;
  }

  // Spec compliance mode
  if (options.compliance) {
    const result = await runComplianceTests(projectDir);
    if (result.failed > 0) process.exitCode = 1;
    return result;
  }

  // Unit test mode
  if (options.unit) {
    const { execSync } = require("child_process");
    const path = require("path");
    const testFile = path.join(__dirname, "../test/unit/core.test.js");
    try {
      execSync(`node "${testFile}"`, { stdio: "inherit" });
    } catch {
      process.exitCode = 1;
    }
    return;
  }

  // Production module unit tests
  if (options.production) {
    const { execSync } = require("child_process");
    const path = require("path");
    const testFile = path.join(__dirname, "../test/unit/production.test.js");
    try {
      execSync(`node "${testFile}"`, { stdio: "inherit" });
    } catch {
      process.exitCode = 1;
    }
    return;
  }

  // Integration test mode
  if (options.integration) {
    const { execSync } = require("child_process");
    const path = require("path");
    const testFile = path.join(__dirname, "../test/integration/flow.test.js");
    try {
      execSync(`node "${testFile}"`, { stdio: "inherit" });
    } catch {
      process.exitCode = 1;
    }
    return;
  }

  const results = runner.runAll(projectDir);
  const output = options.tap ? formatTAP(results) : formatSummary(results);
  console.log(output);

  if (options.watch) {
    console.log(chalk.cyan("\n👀 Watching for changes... (Ctrl+C to stop)\n"));
    const cfgDir = config.getConfigDir(projectDir);
    const testsDir = cfgDir ? `${cfgDir}/tests` : null;
    if (testsDir && chokidar.existsSync(testsDir)) {
      // Simple polling watch — no chokidar dependency needed
      let lastRun = Date.now();
      setInterval(() => {
        const now = Date.now();
        const changed = runner.discoverTests(projectDir).some(f => {
          try {
            const stat = chokidar.statSync(f);
            return stat.mtimeMs > lastRun;
          } catch { return false; }
        });
        if (changed) {
          lastRun = now;
          console.clear();
          const r = runner.runAll(projectDir);
          console.log(options.tap ? formatTAP(r) : formatSummary(r));
          console.log(chalk.cyan("\n👀 Watching for changes... (Ctrl+C to stop)\n"));
        }
      }, 2000);
    }
  }

  // Exit code
  if (results.status === "fail") {
    process.exitCode = 1;
  }

  return results;
}

module.exports = { run };
