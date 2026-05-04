/**
 * aiyu-multi-agent inspect — Observability command
 * Shows agent stats, tool usage, latency, errors
 */

const chalk = require("chalk");
const fs = require("fs");
const path = require("path");
const usage = require("../core/usage");
const config = require("../core/config");

async function run(options = {}) {
  const projectDir = process.cwd();
  const summary = usage.getSummary(projectDir);

  console.log(chalk.bold("\n🔍 Agent Observability\n"));
  console.log(chalk.gray("─".repeat(50)));

  // Overview
  console.log(`  Active for:      ${summary.daysActive} day${summary.daysActive !== 1 ? "s" : ""}`);
  console.log(`  Total commands:  ${summary.totalCommands}`);
  console.log(`  Agent runs:      ${summary.agentRuns}`);
  console.log(`  Sessions:        ${summary.sessions}`);

  // Top commands
  if (summary.topCommands.length > 0) {
    console.log(chalk.cyan("\n  Command Usage:"));
    summary.topCommands.forEach(c => {
      console.log(`    ${c.name.padEnd(15)} ${c.count}x`);
    });
  }

  // Tool usage from agent runs
  const cfgDir = config.getConfigDir(projectDir);
  if (cfgDir) {
    const usageFile = path.join(cfgDir, "usage.json");
    if (fs.existsSync(usageFile)) {
      try {
        const usageData = JSON.parse(fs.readFileSync(usageFile, "utf-8"));
        const toolStats = {};
        let totalLatency = 0;
        let latencyCount = 0;
        let errorCount = 0;
        let stepCount = 0;

        // Scan run history if available
        if (usageData.runHistory) {
          for (const run of usageData.runHistory) {
            stepCount += run.steps || 0;
            if (run.error) errorCount++;
            totalLatency += run.duration_ms || 0;
            latencyCount++;
            if (run.tools) {
              for (const [tool, count] of Object.entries(run.tools)) {
                toolStats[tool] = (toolStats[tool] || 0) + count;
              }
            }
          }
        }

        if (Object.keys(toolStats).length > 0) {
          console.log(chalk.cyan("\n  Tool Calls:"));
          const sorted = Object.entries(toolStats).sort((a, b) => b[1] - a[1]);
          sorted.forEach(([tool, count]) => {
            console.log(`    ${tool.padEnd(20)} ${count}x`);
          });
        }

        if (latencyCount > 0) {
          const avgLatency = (totalLatency / latencyCount / 1000).toFixed(1);
          console.log(chalk.cyan("\n  Performance:"));
          console.log(`    Avg latency:    ${avgLatency}s`);
          console.log(`    Total steps:    ${stepCount}`);
          if (latencyCount > 0) {
            console.log(`    Error rate:     ${((errorCount / latencyCount) * 100).toFixed(1)}%`);
          }
        }
      } catch { /* skip parse errors */ }
    }

    // Agent list with basic stats
    const agentsDir = path.join(cfgDir, "agents");
    if (fs.existsSync(agentsDir)) {
      const agents = fs.readdirSync(agentsDir).filter(f => f.endsWith(".md"));
      if (agents.length > 0) {
        console.log(chalk.cyan("\n  Agents:"));
        agents.forEach(a => {
          const name = a.replace(".md", "");
          console.log(`    ${name}`);
        });
      }
    }
  }

  // Skills
  if (summary.skillInstalls > 0) {
    console.log(chalk.cyan("\n  Skills:"));
    console.log(`    Installed: ${summary.skillInstalls}`);
  }

  // Tests
  if (summary.testRuns > 0) {
    console.log(chalk.cyan("\n  Tests:"));
    console.log(`    Runs:      ${summary.testRuns}`);
    console.log(`    Pass rate: ${summary.testPassRate}`);
  }

  console.log(chalk.gray("\n─".repeat(50)));
  console.log("");
}

module.exports = { run };
