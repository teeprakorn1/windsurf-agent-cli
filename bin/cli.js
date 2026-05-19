#!/usr/bin/env node

/**
 * Aiyu MultiAgent — AI Agent Platform
 * Production-grade AI Agent CLI — thin router, commands in lib/commands/
 */

const { Command } = require("commander");
const chalk = require("chalk");
const logger = require("../lib/core/logger");
const inline = require("../lib/commands/init-inline");

const program = new Command();

program
  .name("aiyu-multi-agent")
  .description("Production-grade AI Agent Platform")
  .version(inline.CURRENT_VERSION)
  .addHelpText("before", `\n  ${chalk.cyan(`Aiyu MultiAgent v${inline.CURRENT_VERSION}`)} — ${inline.getComponentCounts().agents} Agents | ${inline.getComponentCounts().skills} Skills | ${inline.getComponentCounts().workflows} Workflows\n`)
  .addHelpText("after", `\n  Documentation: https://github.com/teeprakorn1/aiyu-multi-agent#readme\n`);

program
  .command("init")
  .description("Quick setup with smart defaults (use --interactive for full prompts)")
  .option("--interactive", "Full interactive setup with all prompts")
  .option("--dry-run", "Preview without writing files")
  .option("--windsurf-only", "Create .windsurf/ only (no .agent/ directory)")
  .option("--agent-only", "Create .agent/ only (no .windsurf/ symlink)")
  .option("--cursor-only", "Generate .cursor/ only (Cursor IDE rules + commands)")
  .option("--cursor", "Also generate .cursor/ alongside .windsurf/ / .agent/")
  .option("--roo-only", "Generate Roo Code files only (.roomodes, .roorules, .roo/)")
  .option("--no-roo", "Skip Roo Code file generation")
  .option("--force", "Overwrite existing config directories (use with caution)")
  .action(inline.cmdInit);

program
  .command("update")
  .description("Update config to latest version (preserves user-modified files)")
  .option("--dry-run", "Preview without writing files")
  .action(async (options) => {
    await inline.cmdUpdate(options);
    const usage = require("../lib/core/usage");
    usage.trackCommand(process.cwd(), "update");
  });

program
  .command("version")
  .description("Show current version + check for updates")
  .action(async () => {
    await inline.cmdVersion();
    const usage = require("../lib/core/usage");
    usage.trackCommand(process.cwd(), "version");
  });

program
  .command("status")
  .description("Show project statistics")
  .action(() => {
    inline.cmdStatus();
    const usage = require("../lib/core/usage");
    usage.trackCommand(process.cwd(), "status");
  });

program
  .command("list")
  .description("List all available slash commands")
  .action(inline.cmdList);

program
  .command("info <agent>")
  .description("Show agent details: skills, tools, rules, workflow")
  .action(inline.cmdInfo);

program
  .command("checklist [url]")
  .description("Run master checklist (optionally with URL for perf + E2E)")
  .action(inline.cmdChecklist);

program
  .command("uninstall")
  .description("Remove config directories from project")
  .action(inline.cmdUninstall);

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
  .option("--strict", "Block publish if leaked secrets detected")
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
  .option("-p, --provider <provider>", "LLM provider: openai, claude, groq, local, mock")
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
  .command("run-from-file <path>")
  .description("Execute agent from markdown file with frontmatter (agent, provider, maxSteps)")
  .option("-a, --agent <name>", "Override agent (default: from frontmatter)")
  .option("-p, --provider <provider>", "Override provider (default: from frontmatter)")
  .option("-m, --model <model>", "Override model")
  .option("--max-steps <n>", "Override max ReAct loop steps")
  .option("--json", "Output as JSON")
  .option("--verbose", "Show step-by-step thinking and tool results")
  .option("--dry-run", "Preview execution without running")
  .option("--no-cache", "Skip cache, always re-run")
  .action(async (file, options) => {
    const cmd = require("../lib/commands/run-from-file");
    const result = await cmd.runFromFile(file, options);
    if (result) {
      const usage = require("../lib/core/usage");
      usage.trackCommand(process.cwd(), "run-from-file");
    }
  });

program
  .command("chat")
  .description("Interactive chat session with an agent")
  .option("-a, --agent <name>", "Agent to chat with (default: first found)")
  .option("-p, --provider <provider>", "LLM provider: openai, claude, groq, local, mock")
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
  .action(async (options) => {
    const healthCheck = require("../lib/core/health-check");
    healthCheck.markInitialized();
    const report = await healthCheck.getFullHealthReport(process.cwd());
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
        const icon = check.status === "ok" || check.status === "ready" || check.status === "configured" || check.status === "available" || check.status === "healthy" ? chalk.green("✓") : check.status === "degraded" || check.status === "warning" || check.status === "limited" ? chalk.yellow("⚠") : chalk.red("✗");
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
  .option("-a, --agent <name>", "Agent to run in dev mode")
  .option("-p, --provider <provider>", "LLM provider: openai, claude, local, mock")
  .option("-v, --verbose", "Verbose: log every tool call + LLM response")
  .option("--trace", "Enable persistent trace output to .agent/traces/")
  .action(async (options) => {
    const agentRuntime = require("../lib/core/agent-runtime");
    const tracing = require("../lib/core/tracing");

    if (options.trace) {
      const config = require("../lib/core/config");
      const cfgDir = config.getConfigDir(process.cwd());
      if (cfgDir) tracing.enablePersistentTraces(require("path").join(cfgDir, "traces"));
    }

    console.log(chalk.cyan("\n🔧 Aiyu Dev Mode"));
    console.log(chalk.gray("  Type input to run agent. Type 'exit' to quit.\n"));

    const agentName = options.agent || "default";
    const verbose = options.verbose || false;
    const provider = options.provider || "mock"; // Default mock for safety; use --provider openai/claude for real LLM

    // Simple REPL loop
    const readline = require("readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    const prompt = () => {
      rl.question(chalk.green(`[${agentName}] > `), async (input) => {
        if (!input || input.trim() === "exit" || input.trim() === "quit") {
          console.log(chalk.gray("  Exiting dev mode..."));
          rl.close();
          return;
        }
        try {
          const startTime = Date.now();
          const result = await agentRuntime.runAgent({
            input: input.trim(),
            agentName,
            projectDir: process.cwd(),
            provider,
            noCache: true,
            onStep: verbose ? (step, state) => {
              console.log(chalk.blue(`  Step ${step.step}: ${step.thought?.slice(0, 120)}${step.thought?.length > 120 ? "..." : ""}`));
              if (step.toolCalls.length > 0) {
                for (const tc of step.toolCalls) {
                  if (tc.error) {
                    console.log(chalk.red(`    ❌ ${tc.tool}: ${tc.error}`));
                  } else {
                    console.log(chalk.green(`    ✅ ${tc.tool} (${tc.duration_ms}ms)`));
                  }
                }
              }
            } : undefined,
          });
          const elapsed = Date.now() - startTime;
          const statusIcon = result.status === "complete" ? chalk.green("✓") : chalk.red("✗");
          console.log(`\n  ${statusIcon} ${result.status} (${elapsed}ms, ${result.steps.length} steps)`);
          if (result.output) {
            console.log(chalk.white(`  ${result.output.slice(0, 500)}${result.output.length > 500 ? "..." : ""}`));
          }
          if (result.error) {
            console.log(chalk.red(`  Error: ${result.error}`));
          }
          console.log("");
        } catch (err) {
          console.log(chalk.red(`  Error: ${err.message}\n`));
        }
        prompt();
      });
    };
    prompt();
  });

program
  .command("generate <type> [subtype]")
  .description("[experimental] Generate MCP server / config")
  .action((type, subtype) => {
    console.log(chalk.yellow(`\n  ⚠️ "aiyu-multi-agent generate ${type} ${subtype || ""}" is experimental and not yet implemented\n`));
  });

program
  .command("serve")
  .description("Start HTTP API server — /health, /metrics, /traces, /jobs")
  .option("-p, --port <port>", "Port number", parseInt)
  .option("--trace-dir <dir>", "Enable persistent traces to directory")
  .action((options) => {
    if (options.port) process.env.PORT = options.port;
    if (options.traceDir) {
      const tracing = require("../lib/core/tracing");
      tracing.enablePersistentTraces(options.traceDir);
    }
    require("../bin/server.js");
  });

program
  .command("mcp")
  .description("Start MCP server (stdio) — integrates with Claude Code, Cursor, Zed, Windsurf")
  .action(async () => {
    const { startServer } = require("../lib/mcp/server");
    try {
      await startServer(process.cwd());
    } catch (err) {
      logger.error(`MCP server failed: ${err.message}`);
      process.exitCode = 1;
    }
  });

program.parseAsync().catch((err) => {
  logger.error(err.message);
  process.exitCode = 1;
});
