/**
 * Usage tracking — lightweight, privacy-respecting deployment & usage metrics
 * All data stored locally in .agent/usage.json — no external telemetry
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const config = require("./config");
const guardrails = require("./guardrails");

const USAGE_FILE = "usage.json";

// In-memory buffer for atomic writes (prevents read-modify-write race)
let _bufferedUsage = null;
let _bufferProjectDir = null;
let _flushTimer = null;
let _exitHandlerRegistered = false;
const FLUSH_INTERVAL_MS = 5000; // flush every 5 seconds

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
  guardrails.safeWrite(filePath, JSON.stringify(data, null, 2), "utf-8", projectDir);
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

function _flushBuffer() {
  if (_bufferedUsage && _bufferProjectDir) {
    saveUsage(_bufferProjectDir, _bufferedUsage);
    _bufferedUsage = null;
    _bufferProjectDir = null;
  }
  if (_flushTimer) {
    clearInterval(_flushTimer);
    _flushTimer = null;
  }
}

function trackCommand(projectDir, command, meta = {}) {
  // Use in-memory buffer to avoid read-modify-write race under concurrency
  if (!_bufferedUsage || _bufferProjectDir !== projectDir) {
    // Flush previous buffer if project changed
    if (_bufferedUsage && _bufferProjectDir !== projectDir) _flushBuffer();
    _bufferedUsage = loadUsage(projectDir);
    _bufferProjectDir = projectDir;
  }
  const usage = _bufferedUsage;
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

  // Schedule periodic flush instead of writing on every call
  if (!_flushTimer) {
    _flushTimer = setInterval(_flushBuffer, FLUSH_INTERVAL_MS);
    _flushTimer.unref(); // don't keep process alive
  }

  // Ensure buffer is flushed on process exit to prevent data loss
  if (!_exitHandlerRegistered) {
    _exitHandlerRegistered = true;
    process.on("exit", _flushBuffer);
  }

  return usage;
}

function getSummary(projectDir) {
  // If buffered usage exists for this project, use it (includes unflushed changes)
  const usage = (_bufferedUsage && _bufferProjectDir === projectDir)
    ? _bufferedUsage
    : loadUsage(projectDir);

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

function getMetrics(projectDir) {
  const usage = loadUsage(projectDir);
  const summary = getSummary(projectDir);

  // Calculate error rate from test data
  const totalTests = usage.testPasses + usage.testFails;
  const errorRate = totalTests > 0 ? usage.testFails / totalTests : 0;

  // Calculate daily averages
  const daysActive = summary.daysActive || 1;

  return {
    // Counters
    totalCommands: summary.totalCommands,
    agentRuns: usage.agentRuns,
    sessions: usage.sessions,
    skillInstalls: usage.skillInstalls,
    testRuns: usage.testRuns,
    deployments: usage.deployments.length,

    // Rates
    testPassRate: summary.testPassRate,
    errorRate: Math.round(errorRate * 100) / 100,
    commandsPerDay: Math.round(summary.totalCommands / daysActive),
    agentRunsPerDay: Math.round(usage.agentRuns / daysActive),

    // Uptime
    daysActive,
    createdAt: usage.createdAt,
    lastUsedAt: usage.lastUsedAt,

    // Top commands
    topCommands: summary.topCommands,
  };
}

function formatPrometheusMetrics(projectDir) {
  const m = getMetrics(projectDir);
  const lines = [];

  const gauge = (name, value, help) => {
    lines.push(`# HELP aiyu_${name} ${help}`);
    lines.push(`# TYPE aiyu_${name} gauge`);
    lines.push(`aiyu_${name} ${value}`);
  };

  gauge("total_commands", m.totalCommands, "Total commands executed");
  gauge("agent_runs", m.agentRuns, "Total agent executions");
  gauge("sessions", m.sessions, "Total init sessions");
  gauge("skill_installs", m.skillInstalls, "Total skill installations");
  gauge("test_runs", m.testRuns, "Total test runs");
  gauge("deployments", m.deployments, "Total deployments");
  gauge("days_active", m.daysActive, "Days since first use");
  gauge("error_rate", m.errorRate, "Error rate (0-1)");
  gauge("commands_per_day", m.commandsPerDay, "Average commands per day");

  return lines.join("\n");
}

module.exports = {
  trackCommand,
  getSummary,
  formatSummary,
  loadUsage,
  saveUsage,
  getMetrics,
  formatPrometheusMetrics,
  _flushBuffer,
};
