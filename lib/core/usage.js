/**
 * Usage tracking — lightweight, privacy-respecting deployment & usage metrics
 * All data stored locally in .agent/usage.json — no external telemetry
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const config = require("./config");

const USAGE_FILE = "usage.json";

function getUsageFilePath(projectDir) {
  const cfgDir = config.getConfigDir(projectDir);
  if (!cfgDir) return null;
  return path.join(cfgDir, USAGE_FILE);
}

function loadUsage(projectDir) {
  const filePath = getUsageFilePath(projectDir);
  if (!filePath || !fs.existsSync(filePath)) {
    return createDefaultUsage();
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return createDefaultUsage();
  }
}

function saveUsage(projectDir, data) {
  const cfgDir = config.getConfigDir(projectDir);
  if (!cfgDir) return;
  const filePath = path.join(cfgDir, USAGE_FILE);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function createDefaultUsage() {
  return {
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    commands: {},
    deployments: [],
    sessions: 0,
    agentRuns: 0,
    skillInstalls: 0,
    testRuns: 0,
    testPasses: 0,
    testFails: 0,
  };
}

function trackCommand(projectDir, command, meta = {}) {
  const usage = loadUsage(projectDir);
  usage.lastUsedAt = new Date().toISOString();

  if (!usage.commands[command]) {
    usage.commands[command] = { count: 0, firstUsedAt: null, lastUsedAt: null };
  }

  usage.commands[command].count++;
  if (!usage.commands[command].firstUsedAt) {
    usage.commands[command].firstUsedAt = new Date().toISOString();
  }
  usage.commands[command].lastUsedAt = new Date().toISOString();

  // Track specific metrics
  switch (command) {
    case "init":
      usage.sessions++;
      break;
    case "add":
      usage.skillInstalls++;
      break;
    case "run":
    case "chat":
      usage.agentRuns++;
      break;
    case "test":
      usage.testRuns++;
      if (meta.passed) usage.testPasses += meta.passed;
      if (meta.failed) usage.testFails += meta.failed;
      break;
    case "publish":
      usage.deployments.push({
        date: new Date().toISOString(),
        name: meta.name || "unknown",
        version: meta.version || "unknown",
        status: meta.status || "success",
      });
      break;
  }

  saveUsage(projectDir, usage);
  return usage;
}

function getSummary(projectDir) {
  const usage = loadUsage(projectDir);

  const totalCommands = Object.values(usage.commands).reduce((sum, c) => sum + c.count, 0);
  const topCommands = Object.entries(usage.commands)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([name, data]) => ({ name, count: data.count }));

  const daysSinceCreation = usage.createdAt
    ? Math.floor((Date.now() - new Date(usage.createdAt).getTime()) / 86400000)
    : 0;

  return {
    createdAt: usage.createdAt,
    lastUsedAt: usage.lastUsedAt,
    daysActive: daysSinceCreation,
    totalCommands,
    topCommands,
    sessions: usage.sessions,
    agentRuns: usage.agentRuns,
    skillInstalls: usage.skillInstalls,
    testRuns: usage.testRuns,
    testPassRate: (usage.testPasses + usage.testFails) > 0
      ? `${Math.round((usage.testPasses / (usage.testPasses + usage.testFails)) * 100)}%`
      : "N/A",
    deployments: usage.deployments.length,
    deploymentHistory: usage.deployments.slice(-5),
  };
}

function formatSummary(projectDir) {
  const summary = getSummary(projectDir);
  const chalk = require("chalk");

  const lines = [];
  lines.push(chalk.bold("\n📊 Usage Statistics\n"));
  lines.push(chalk.gray("  ──────────────────────────────────────────────"));

  lines.push(`  Active for:     ${summary.daysActive} day${summary.daysActive !== 1 ? "s" : ""}`);
  lines.push(`  Last used:      ${summary.lastUsedAt ? new Date(summary.lastUsedAt).toLocaleString() : "never"}`);
  lines.push(`  Total commands: ${summary.totalCommands}`);
  lines.push(`  Sessions:       ${summary.sessions}`);
  lines.push(`  Agent runs:     ${summary.agentRuns}`);

  if (summary.topCommands.length > 0) {
    lines.push(chalk.cyan("\n  Top Commands:"));
    summary.topCommands.forEach(c => {
      lines.push(`    ${c.name.padEnd(15)} ${c.count}x`);
    });
  }

  if (summary.skillInstalls > 0) {
    lines.push(`\n  Skills installed: ${summary.skillInstalls}`);
  }

  if (summary.testRuns > 0) {
    lines.push(`  Test runs:        ${summary.testRuns}`);
    lines.push(`  Test pass rate:   ${summary.testPassRate}`);
  }

  if (summary.deployments > 0) {
    lines.push(chalk.cyan("\n  Deployments:"));
    summary.deploymentHistory.forEach(d => {
      const status = d.status === "success" ? chalk.green("✓") : chalk.red("✗");
      lines.push(`    ${status} ${d.name}@${d.version} — ${new Date(d.date).toLocaleDateString()}`);
    });
  }

  lines.push(chalk.gray("\n  ──────────────────────────────────────────────"));
  lines.push(chalk.gray("  Data stored locally in .agent/usage.json — no external telemetry\n"));

  return lines.join("\n");
}

module.exports = {
  trackCommand,
  getSummary,
  formatSummary,
  loadUsage,
  saveUsage,
};
