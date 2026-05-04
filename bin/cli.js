#!/usr/bin/env node

/**
 * Aiyu MultiAgent — AI Agent Platform
 * Production-grade AI Agent CLI with Smart Init, Plugin System, Testing, and Publishing
 */

const { Command } = require("commander");
const chalk = require("chalk");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const http = require("http");
const https = require("https");
const utils = require("../lib/utils");

const { countFiles, countDirs, updateGitignore } = require("../lib/utils");
const config = require("../lib/core/config");
const logger = require("../lib/core/logger");
const guardrails = require("../lib/core/guardrails");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const WINDSURF_DIR = path.join(PROJECT_ROOT, ".windsurf");
const PKG = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf-8"));
const CURRENT_VERSION = PKG.version;

// ── Helpers ──────────────────────────────────────────────────────────

function fetchJSON(url, redirects = 0) {
  const MAX_RESPONSE_SIZE = 1024 * 1024; // 1MB
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error("too many redirects"));
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { timeout: 5000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJSON(res.headers.location, redirects + 1).then(resolve, reject);
      }
      let data = "";
      res.on("data", chunk => {
        data += chunk;
        if (data.length > MAX_RESPONSE_SIZE) {
          req.destroy();
          reject(new Error("Response too large"));
        }
      });
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

async function getLatestVersion() {
  try {
    const data = await fetchJSON("https://registry.npmjs.org/aiyu-multi-agent/latest");
    return data.version || null;
  } catch { return null; }
}

function getComponentCounts() {
  return {
    agents: countFiles(path.join(WINDSURF_DIR, "agents"), ".md"),
    skills: countDirs(path.join(WINDSURF_DIR, "skills")),
    workflows: countFiles(path.join(WINDSURF_DIR, "workflows"), ".md"),
  };
}

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return ["http:", "https:"].includes(u.protocol);
  } catch { return false; }
}

// ── Command Implementations ──────────────────────────────────────────

async function cmdInit(options) {
  const initCmd = require("../lib/commands/init");
  await initCmd.run(process.cwd(), { dryRun: options.dryRun, interactive: options.interactive, windsurfOnly: options.windsurfOnly, agentOnly: options.agentOnly });
  const usage = require("../lib/core/usage");
  usage.trackCommand(process.cwd(), "init");
}

async function cmdUpdate(options) {
  const targetDir = process.cwd();
  const targetAgent = config.getAgentDir(targetDir);
  const targetWindsurf = config.getWindsurfDir(targetDir);

  if (!fs.existsSync(targetAgent) && !fs.existsSync(targetWindsurf)) {
    console.log(chalk.yellow(".agent/ or .windsurf/ not found. Run `aiyu-multi-agent init` first.\n"));
    return;
  }

  const installed = config.getVersion(targetDir);
  console.log(`Installed version: ${installed || "unknown"}`);
  console.log(`Package version:   ${CURRENT_VERSION}`);

  if (installed === CURRENT_VERSION) {
    console.log(chalk.green(`\nAlready up to date! v${CURRENT_VERSION}\n`));
    return;
  }

  console.log("\nChecking npm for latest version...");
  const latest = await getLatestVersion();
  if (latest && latest !== CURRENT_VERSION) {
    console.log(chalk.yellow(`Newer version available on npm: v${latest}`));
    console.log("Run: npx aiyu-multi-agent@latest update\n");
    return;
  }

  const targetConfig = config.getConfigDir(targetDir);
  console.log(`\nUpdating from v${installed || "?"} to v${CURRENT_VERSION}...`);
  const preserved = utils.copyRecursive(WINDSURF_DIR, targetConfig, { merge: true, dryRun: options.dryRun });
  if (preserved.length > 0) {
    console.log("\n  Preserved user-modified files (not overwritten):");
    preserved.forEach(f => console.log(`    ${f}`));
  }
  if (!options.dryRun) {
    config.saveVersion(targetDir, CURRENT_VERSION);
    updateGitignore(targetDir);
  }
  console.log(options.dryRun ? "\n[DRY RUN] No files were written.\n" : chalk.green(`\nUpdated to v${CURRENT_VERSION}!\n`));
}

async function cmdVersion() {
  console.log(`aiyu-multi-agent v${CURRENT_VERSION}`);
  const installed = config.getVersion(process.cwd());
  if (installed) console.log(`Project config version: v${installed}`);
  console.log("\nChecking npm for latest...");
  const latest = await getLatestVersion();
  if (latest) {
    console.log(latest === CURRENT_VERSION ? chalk.green(`You are on the latest: v${latest}`) : `Latest on npm: v${latest}\nUpdate: npx aiyu-multi-agent@latest update`);
  } else {
    console.log("Could not reach npm registry.");
  }
  console.log("");
}

function cmdStatus() {
  const cfgDir = config.getConfigDir(process.cwd()) || WINDSURF_DIR;
  const scriptsDir = path.join(cfgDir, "scripts");
  console.log("📊 Project Status:\n");
  console.log(`  Agents:    ${countFiles(path.join(cfgDir, "agents"), ".md")}`);
  console.log(`  Skills:    ${countDirs(path.join(cfgDir, "skills"))}`);
  console.log(`  Workflows: ${countFiles(path.join(cfgDir, "workflows"), ".md")}`);
  console.log(`  Scripts:   ${fs.existsSync(scriptsDir) ? fs.readdirSync(scriptsDir).filter(f => f.endsWith(".py")).length : 0}`);
  console.log(`  Rules:     ${countFiles(path.join(cfgDir, "rules"), ".md")}`);
  console.log(`  Config:    ${cfgDir}`);
  console.log("");
}

function cmdList() {
  console.log("📋 Available Commands:\n");
  const workflowsDir = path.join(WINDSURF_DIR, "workflows");
  if (!fs.existsSync(workflowsDir)) {
    console.log("  No workflows found.");
    return;
  }

  // Cache workflow descriptions for 30s
  if (!global._wfCache || Date.now() - global._wfCache.ts > 30000) {
    const entries = [];
    fs.readdirSync(workflowsDir).filter(f => f.endsWith(".md")).sort().forEach(f => {
      const content = fs.readFileSync(path.join(workflowsDir, f), "utf-8");
      const descMatch = content.match(/description:\s*(.+)/);
      entries.push({ name: f.replace(".md", ""), desc: descMatch ? descMatch[1].trim() : "No description" });
    });
    global._wfCache = { entries, ts: Date.now() };
  }

  global._wfCache.entries.forEach(e => {
    console.log(`  /${e.name.padEnd(25)} ${e.desc}`);
  });
  console.log("");
}

function cmdInfo(agentName) {
  const agentsDir = path.join(WINDSURF_DIR, "agents");
  const filePath = path.join(agentsDir, `${agentName}.md`);
  if (!fs.existsSync(filePath)) {
    const files = fs.readdirSync(agentsDir).filter(f => f.endsWith(".md"));
    const match = files.find(f => f.replace(".md", "").includes(agentName));
    if (match) return cmdInfo(match.replace(".md", ""));
    console.log(`Agent not found: ${agentName}\n`);
    console.log("Available agents:");
    files.sort().forEach(f => console.log(`  ${f.replace(".md", "")}`));
    return;
  }
  const content = fs.readFileSync(filePath, "utf-8");
  const fm = utils.parseFrontmatter(content);
  const skills = Array.isArray(fm.skills) ? fm.skills : (fm.skills ? fm.skills.split(",").map(s => s.trim()) : []);
  const tools = Array.isArray(fm.tools) ? fm.tools : (fm.tools ? fm.tools.split(",").map(t => t.trim()) : []);
  console.log(`Agent: ${fm.name || agentName}\n`);
  console.log(`  Description: ${fm.description || "N/A"}\n`);
  console.log(`  Tools:       ${tools.join(", ")}`);
  console.log(`  Skills:      ${skills.join(", ")}`);
  console.log(`  Sub-agents:  ${tools.includes("Agent") ? "Yes" : "No"}`);
  if (skills.length > 0) {
    console.log("\n  Skill Details:");
    skills.forEach(skill => {
      const skillPath = path.join(WINDSURF_DIR, "skills", skill, "SKILL.md");
      if (fs.existsSync(skillPath)) {
        const sfm = utils.parseFrontmatter(fs.readFileSync(skillPath, "utf-8"));
        console.log(`     ${skill.padEnd(25)} ${sfm.description || "Loaded"}`);
      } else {
        console.log(`     ${skill.padEnd(25)} (built-in)`);
      }
    });
  }
  console.log("");
}

function cmdChecklist(url) {
  if (url && !isValidUrl(url)) {
    console.error(chalk.red("Invalid URL. Only http:// and https:// allowed.\n"));
    return;
  }
  const args = url
    ? [".windsurf/scripts/checklist.py", ".", "--url", url]
    : [".windsurf/scripts/checklist.py", "."];
  console.log("Running Master Checklist...\n");
  try {
    execFileSync("python3", args, { cwd: process.cwd(), encoding: "utf-8", stdio: "inherit" });
  } catch {
    console.error(chalk.red("Checklist failed. See errors above.\n"));
  }
}

function cmdUninstall() {
  const targetDir = process.cwd();
  const agentDir = config.getAgentDir(targetDir);
  const windsurfDir = config.getWindsurfDir(targetDir);

  if (!fs.existsSync(agentDir) && !fs.existsSync(windsurfDir)) {
    console.log(chalk.yellow("No config directory found. Nothing to uninstall.\n"));
    return;
  }

  console.log("Removing config directories...\n");
  [agentDir, windsurfDir].forEach(dir => {
    if (fs.existsSync(dir)) {
      const stat = fs.lstatSync(dir);
      if (stat.isSymbolicLink()) {
        fs.unlinkSync(dir);
      } else {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });
  console.log(chalk.green("Done! Config directories removed.\n"));
  console.log("Note: .gitignore entries were left intact. Remove '# Aiyu MultiAgent' and '.windsurf' manually if desired.\n");
}

// ── CLI Program ──────────────────────────────────────────────────────

const program = new Command();

program
  .name("aiyu-multi-agent")
  .description("Production-grade AI Agent Platform")
  .version(CURRENT_VERSION)
  .addHelpText("before", `\n  ${chalk.cyan(`Aiyu MultiAgent v${CURRENT_VERSION}`)} — ${getComponentCounts().agents} Agents | ${getComponentCounts().skills} Skills | ${getComponentCounts().workflows} Workflows\n`)
  .addHelpText("after", `\n  Documentation: https://github.com/teeprakorn1/aiyu-multi-agent#readme\n`);

program
  .command("init")
  .description("Quick setup with smart defaults (use --interactive for full prompts)")
  .option("--interactive", "Full interactive setup with all prompts")
  .option("--dry-run", "Preview without writing files")
  .option("--windsurf-only", "Create .windsurf/ only (no .agent/ directory)")
  .option("--agent-only", "Create .agent/ only (no .windsurf/ symlink)")
  .action(cmdInit);

program
  .command("update")
  .description("Update config to latest version (preserves user-modified files)")
  .option("--dry-run", "Preview without writing files")
  .action(async (options) => {
    await cmdUpdate(options);
    const usage = require("../lib/core/usage");
    usage.trackCommand(process.cwd(), "update");
  });

program
  .command("version")
  .description("Show current version + check for updates")
  .action(async () => {
    await cmdVersion();
    const usage = require("../lib/core/usage");
    usage.trackCommand(process.cwd(), "version");
  });

program
  .command("status")
  .description("Show project statistics")
  .action(() => {
    cmdStatus();
    const usage = require("../lib/core/usage");
    usage.trackCommand(process.cwd(), "status");
  });

program
  .command("list")
  .description("List all available slash commands")
  .action(cmdList);

program
  .command("info <agent>")
  .description("Show agent details: skills, tools, rules, workflow")
  .action(cmdInfo);

program
  .command("checklist [url]")
  .description("Run master checklist (optionally with URL for perf + E2E)")
  .action(cmdChecklist);

program
  .command("uninstall")
  .description("Remove config directories from project")
  .action(cmdUninstall);

program
  .command("add <type> <name>")
  .description("Add a skill/plugin from npm")
  .option("--auto-approve", "Auto-approve skill permissions")
  .action(async (type, name, cmdOpts) => {
    const addCmd = require("../lib/commands/add");
    await addCmd.run(type, name, { autoApprove: cmdOpts.autoApprove });
    const usage = require("../lib/core/usage");
    usage.trackCommand(process.cwd(), "add", { type, name });
  });

program
  .command("remove <type> <name>")
  .description("Remove an installed skill/plugin")
  .action(async (type, name) => {
    const removeCmd = require("../lib/commands/remove");
    await removeCmd.run(type, name);
    const usage = require("../lib/core/usage");
    usage.trackCommand(process.cwd(), "remove", { type, name });
  });

program
  .command("test")
  .description("Run agent test suite")
  .option("--watch", "Watch for changes and re-run")
  .option("--tap", "Output in TAP format")
  .option("--compliance", "Run spec compliance tests (validates runtime behavior)")
  .option("--unit", "Run core module unit tests")
  .option("--production", "Run production module unit tests (circuit breaker, queue, tracing, health)")
  .option("--integration", "Run integration tests (full agent flow with production modules)")
  .action(async (options) => {
    const testCmd = require("../lib/commands/test");
    const results = await testCmd.run(options);
    const usage = require("../lib/core/usage");
    usage.trackCommand(process.cwd(), "test", { passed: results?.passed || 0, failed: results?.failed || 0 });
  });

program
  .command("publish")
  .description("Publish agent to npm")
  .option("--dry-run", "Validate and package without publishing")
  .option("--name <name>", "Override package name")
  .option("--version <version>", "Override version")
  .option("--author <author>", "Set author")
  .option("--license <license>", "Set license (default: MIT)")
  .option("--access <access>", "npm access level (public/restricted)", "public")
  .option("--tag <tag>", "npm dist-tag (default: latest)")
  .action(async (options) => {
    const publishCmd = require("../lib/commands/publish");
    await publishCmd.run(options);
    const usage = require("../lib/core/usage");
    usage.trackCommand(process.cwd(), "publish");
  });

program
  .command("usage")
  .description("Show usage statistics and deployment history")
  .action(() => {
    const usage = require("../lib/core/usage");
    console.log(usage.formatSummary(process.cwd()));
  });

program
  .command("run <input>")
  .description("Execute agent with input (the core execution engine)")
  .option("-a, --agent <name>", "Agent to run (default: first found)")
  .option("-p, --provider <provider>", "LLM provider: openai, claude, local, mock")
  .option("-m, --model <model>", "LLM model name")
  .option("--max-steps <n>", "Max ReAct loop steps", "10")
  .option("--json", "Output as JSON")
  .option("--verbose", "Show step-by-step thinking and tool results")
  .option("--dry-run", "Preview execution without running")
  .option("--no-cache", "Skip cache, always re-run")
  .action(async (input, options) => {
    const runCmd = require("../lib/commands/run");
    await runCmd.run(input, options);
    const usage = require("../lib/core/usage");
    usage.trackCommand(process.cwd(), "run");
  });

program
  .command("chat")
  .description("Interactive chat session with an agent")
  .option("-a, --agent <name>", "Agent to chat with (default: first found)")
  .option("-p, --provider <provider>", "LLM provider: openai, claude, local, mock")
  .option("-m, --model <model>", "LLM model name")
  .action(async (options) => {
    const chatCmd = require("../lib/commands/chat");
    await chatCmd.run(options);
    const usage = require("../lib/core/usage");
    usage.trackCommand(process.cwd(), "chat");
  });

program
  .command("inspect")
  .description("Observability — agent stats, tool usage, latency, errors")
  .option("--agent <name>", "Inspect specific agent")
  .action(async (options) => {
    const inspectCmd = require("../lib/commands/inspect");
    await inspectCmd.run(options);
  });

program
  .command("health")
  .description("System health check — liveness, readiness, component status")
  .option("--json", "Output as JSON")
  .action((options) => {
    const healthCheck = require("../lib/core/health-check");
    const report = healthCheck.getFullHealthReport(process.cwd());
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(chalk.cyan(`\n🏥 System Health Report\n`));
      console.log(chalk.gray("─".repeat(50)));
      const statusIcon = report.readiness === "ready" ? chalk.green("✓") : report.readiness === "degraded" ? chalk.yellow("⚠") : chalk.red("✗");
      console.log(`  Overall:     ${statusIcon} ${report.readiness}`);
      console.log(`  Uptime:      ${Math.round(report.uptimeMs / 1000)}s`);
      console.log(`  Version:     v${report.version}`);
      console.log(`  Node:        ${report.nodeVersion}`);
      console.log(`  PID:         ${report.pid}`);
      console.log(chalk.gray("\n  Components:"));
      for (const [name, check] of Object.entries(report.checks)) {
        const icon = check.status === "ok" || check.status === "ready" || check.status === "configured" || check.status === "available" ? chalk.green("✓") : check.status === "degraded" || check.status === "warning" || check.status === "limited" ? chalk.yellow("⚠") : chalk.red("✗");
        console.log(`    ${icon} ${name.padEnd(18)} ${check.status}`);
        if (check.message) console.log(`      ${chalk.gray(check.message)}`);
        if (check.heapUsedMB) console.log(`      ${chalk.gray(`heap: ${check.heapUsedMB}MB / ${check.heapTotalMB}MB`)}`);
      }
      console.log(chalk.gray("\n  System:"));
      console.log(`    CPUs:       ${report.system.cpuCount}`);
      console.log(`    Memory:     ${report.system.freeMemoryMB}MB free / ${report.system.totalMemoryMB}MB total`);
      console.log(`    Load:       ${report.system.loadAvg.map(l => l.toFixed(2)).join(", ")}`);
      console.log(chalk.gray("─".repeat(50)));
      console.log("");
    }
  });

program
  .command("traces")
  .description("View recent distributed traces")
  .option("--id <traceId>", "Get specific trace details")
  .option("--metrics", "Show trace metrics summary")
  .option("--otel <traceId>", "Export trace in OpenTelemetry format")
  .option("-n, --limit <n>", "Number of recent traces to show", "20")
  .action((options) => {
    const tracing = require("../lib/core/tracing");
    if (options.otel) {
      const otel = tracing.exportOpenTelemetry(options.otel);
      if (otel) console.log(JSON.stringify(otel, null, 2));
      else console.log(chalk.red(`Trace ${options.otel} not found`));
      return;
    }
    if (options.id) {
      const trace = tracing.getTrace(options.id);
      if (!trace) { console.log(chalk.red(`Trace ${options.id} not found`)); return; }
      console.log(chalk.cyan(`\n🔍 Trace: ${trace.traceId}\n`));
      console.log(`  Operation:  ${trace.operationName}`);
      console.log(`  Status:     ${trace.status}`);
      console.log(`  Duration:   ${trace.durationMs ?? "running"}ms`);
      console.log(`  Spans:      ${trace.spans.length}`);
      for (const span of trace.spans) {
        const icon = span.status === "ok" ? chalk.green("✓") : chalk.red("✗");
        console.log(`    ${icon} ${span.operationName.padEnd(30)} ${span.durationMs ?? "..."}ms`);
      }
      console.log("");
      return;
    }
    if (options.metrics) {
      const metrics = tracing.getTraceMetrics();
      console.log(chalk.cyan(`\n📊 Trace Metrics\n`));
      console.log(`  Total traces:  ${metrics.total}`);
      console.log(`  Completed:     ${metrics.completed}`);
      console.log(`  Failed:        ${metrics.failed}`);
      console.log(`  Avg duration:  ${metrics.avgDurationMs}ms`);
      console.log(`  P95 duration:  ${metrics.p95DurationMs}ms`);
      console.log(`  Total spans:   ${metrics.totalSpans}`);
      console.log("");
      return;
    }
    const recent = tracing.getRecentTraces(parseInt(options.limit, 10));
    console.log(chalk.cyan(`\n📋 Recent Traces (last ${recent.length})\n`));
    for (const t of recent) {
      const icon = t.status === "ok" ? chalk.green("✓") : t.status === "error" ? chalk.red("✗") : chalk.yellow("⏳");
      console.log(`  ${icon} ${t.traceId}  ${t.operationName.padEnd(35)} ${t.durationMs ?? "..."}ms  spans:${t.spanCount}`);
    }
    console.log("");
  });

program
  .command("dev")
  .description("[experimental] Dev mode — live reload, debug reasoning, log tool calls")
  .action(() => {
    console.log(chalk.yellow('\n  ⚠️ "aiyu-multi-agent dev" is experimental and not yet implemented\n'));
  });

program
  .command("generate <type> [subtype]")
  .description("[experimental] Generate MCP server / config")
  .action((type, subtype) => {
    console.log(chalk.yellow(`\n  ⚠️ "aiyu-multi-agent generate ${type} ${subtype || ""}" is experimental and not yet implemented\n`));
  });

program.parseAsync().catch((err) => {
  logger.error(err.message);
  process.exitCode = 1;
});
