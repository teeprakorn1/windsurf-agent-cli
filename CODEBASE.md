# CODEBASE.md — Aiyu MultiAgent V2.4.0

## System Overview

Production-grade AI Agent Platform — Smart Init, Plugin System, Agent Testing, and Publishing.

**V2.4.0** — HTTP API + Operational Readiness + MCP Server + security hardening + Docker.

**V2.2** — Production upgrade: circuit breaker, request queue, distributed tracing, health check, structured logging, Prometheus metrics, context size limits, integration tests.

## Architecture V2

```
┌─────────────────────────────────────────┐
│           CLI (Commander.js)            │
│  bin/cli.js — windsurf <command>        │
└─────────────┬───────────────────────────┘
              ▼
┌─────────────────────────────────────────┐
│   lib/core/ — Core Engine               │
│   agent-runtime.js — 🔥 ReAct loop      │
│   tool-registry.js — 🔥 Tools & schemas │
│   llm-providers.js — 🔥 LLM + retry     │
│   circuit-breaker.js — 🔥 Failure guard │
│   request-queue.js — 🔥 Concurrency ctrl │
│   tracing.js   — 🔥 Distributed tracing │
│   health-check.js — 🔥 Health monitor   │
│   tool-runner.js  — Isolated exec       │
│   config.js    — .agent/ + .windsurf/   │
│   plugin.js    — Skill install/remove   │
│   guardrails.js — Security layer        │
│   usage.js     — Usage + Prometheus     │
│   runtime.js   — Node/Bun detection     │
│   logger.js    — Structured JSON logging │
└─────────────┬───────────────────────────┘
              ▼
┌─────────────────────────────────────────┐
│   lib/commands/ — CLI Commands          │
│   run.js       — 🔥 aiyu-multi-agent run        │
│   chat.js      — 🔥 aiyu-multi-agent chat       │
│   init.js      — Smart Init             │
│   add.js       — aiyu-multi-agent add skill     │
│   remove.js    — aiyu-multi-agent remove skill  │
│   test.js      — aiyu-multi-agent test          │
│   inspect.js   — aiyu-multi-agent inspect       │
│   publish.js   — aiyu-multi-agent publish       │
└─────────────┬───────────────────────────┘
              ▼
┌─────────────────────────────────────────┐
│   lib/test/ — Test Framework            │
│   runner.js, assertions.js,             │
│   simulator.js, reporter.js,           │
│   compliance.js, unit/core.test.js,     │
│   unit/production.test.js,              │
│   integration/flow.test.js              │
└─────────────┬───────────────────────────┘
              ▼
┌─────────────────────────────────────────┐
│   lib/publish/ — Publish System         │
│   packager.js, validator.js,            │
│   registry.js                           │
└─────────────┬───────────────────────────┘
              ▼
┌─────────────────────────────────────────┐
│   lib/mcp/ — MCP Server                 │
│   server.js — 🔥 MCP stdio server       │
│   tools/list-agents.js                  │
│   tools/run-agent.js                    │
│   tools/inspect-agent.js                │
└─────────────────────────────────────────┘
```

## Core Components

### Agents (80 total)
`.windsurf/agents/` — Each with frontmatter: name, description, tools, model, skills

### Skills (46 built-in)
`.windsurf/skills/` — Each skill: SKILL.md + scripts/ + references/

### Workflows (78 total)
`.windsurf/workflows/` — Slash command definitions

### Rules (10 total)
`.windsurf/rules/` — Auto-triggered by keywords

### V2 Modules
- `lib/core/agent-runtime.js` — 🔥 ReAct loop, chat session (sliding window + char-based context limit MAX_CONTEXT_CHARS=200000), agent loader, circuit breaker integration, distributed tracing (traceId in state)
- `lib/core/tool-registry.js` — 🔥 Namespaced tools (fs.read/shell.exec), schemas, validation, parseCommandArgs (escape sequences), cross-platform fs.glob/search.grep (maxDepth, maxFileSize, maxFiles limits)
- `lib/core/llm-providers.js` — 🔥 OpenAI, Claude (tool_use), Ollama (tools), Mock (respects outputFormat), retry/backoff, 1MB response size limit
- `lib/core/tool-runner.js` — Isolated tool runner (forked child process, restricted env)
- `lib/core/config.js` — Config loader (.agent/ primary, .windsurf/ symlink). initConfigDir supports windsurfOnly and agentOnly options
- `lib/core/plugin.js` — npm skill install/remove + permission system (guardrails.safeWrite for config.yaml writes)
- `lib/core/guardrails.js` — pathTraversal (projectRoot param + path.normalize + fs.realpathSync symlink protection), safeWrite (EXDEV fallback + temp file cleanup on error), rateLimit (cleanup), sandboxExec (execFileSync, no curl/wget)
- `lib/core/usage.js` — Usage statistics + deployment tracking + agentRuns counter + Prometheus metrics export (formatPrometheusMetrics) + getMetrics
- `lib/core/runtime.js` — Node/Bun dual
- `lib/core/logger.js` — Structured JSON logging (LOG_FORMAT=json), meta field support, setJsonOutput()
- `lib/core/circuit-breaker.js` — 🔥 Circuit breaker pattern (CLOSED→OPEN→HALF_OPEN→CLOSED), failure threshold, reset timeout, per-service breakers. Guards null lastFailureTime to prevent instant OPEN→HALF_OPEN
- `lib/core/request-queue.js` — 🔥 Async job queue with concurrency control, priority ordering, backpressure (QUEUE_FULL), job timeout, metrics
- `lib/core/tracing.js` — 🔥 Distributed tracing (trace+span IDs, OpenTelemetry export), trace storage, metrics (avg/p95 duration)
- `lib/core/health-check.js` — 🔥 System health (liveness, readiness, component checks: memory, queue, breakers, LLM providers, config)
- `lib/utils.js` — Shared utilities: parseFrontmatter (YAML.parse only, no fallback), copyRecursive (with skipDirs), findDefaultAgent, isValidAgentName, updateGitignore
- `lib/commands/run.js` — 🔥 Agent execution entry (--verbose, --dry-run, --no-cache, streaming output)
- `lib/commands/chat.js` — 🔥 Interactive chat session (sliding window MAX_CONTEXT_MESSAGES=20)
- `lib/commands/init.js` — Interactive agent generator (with agent name validation, utils import). Supports `--windsurf-only` (.windsurf/ only) and `--agent-only` (.agent/ only, no symlink)
- `lib/commands/add.js` — Skill installer (with permission check)
- `lib/commands/remove.js` — Skill remover
- `lib/commands/test.js` — Test runner (--compliance, --unit, --production, --integration, --watch, --tap)
- `lib/commands/inspect.js` — Observability (stats, tool usage, latency, errors)
- `lib/commands/publish.js` — npm publisher
- `lib/test/compliance.js` — Spec compliance tests (15 checks)
- `lib/test/unit/core.test.js` — Unit tests for guardrails, tool-registry, llm-providers (29 tests)
- `lib/test/unit/production.test.js` — Unit tests for circuit-breaker, request-queue, tracing, health-check (25 tests)
- `lib/test/integration/flow.test.js` — Integration tests: full agent flow with tracing, breaker, queue, health, metrics (12 tests)
- `lib/test/` — Test framework (runner, assertions, simulator, reporter)
- `lib/publish/` — Publish system (packager uses utils.copyRecursive, validator, registry)
- `lib/mcp/server.js` — 🔥 MCP server (McpServer + StdioServerTransport, dynamic import for ESM-only SDK). Exposes 3 tools: list_agents, run_agent, inspect_agent
- `lib/mcp/tools/list-agents.js` — Lists all agents in project with name + description (optional verbose: skills, tools, provider, model)
- `lib/mcp/tools/run-agent.js` — Executes agent via agentRuntime.runAgent, returns output + steps + usage. Output truncated at 50KB
- `lib/mcp/tools/inspect-agent.js` — Returns full agent spec (frontmatter + instructions)

### Runtime Correctness
- **Tool Namespace**: `fs.read`, `fs.write`, `fs.edit`, `fs.glob`, `search.grep`, `shell.exec` — legacy aliases supported, namespace enforced on registration
- **Parser Fallback**: structured JSON → TOOL_CALL regex → JSON code blocks → final answer
- **Arg Validation**: `TOOL_SCHEMAS` with required/optional fields, validated before execution (both runAgent and chat)
- **Step Logging**: `{ step, thought, action, result, error, duration_ms, toolCalls }`
- **Output Contract**: `outputFormat: json` enforces JSON output (options.outputFormat overrides agentSpec)
- **Deterministic Mode**: `temperature: 0` for stable tests (now passed to all providers: OpenAI, Claude, Ollama)
- **Tool Timeout**: Default 30s per tool call
- **LLM Retry**: Exponential backoff (max 3 retries) for 429, 503, timeout, ECONNRESET
- **Claude Tool Use**: Parses `tool_use` content blocks from Anthropic API
- **Ollama Tools**: Parses `message.tool_calls` from Ollama API
- **Chat ReAct Loop**: Full loop (max steps from agent spec, capped at 10) with try/catch around callLLM + sliding window (MAX_CONTEXT_MESSAGES=20) + char-based context limit (MAX_CONTEXT_CHARS=200000) + truncateResult on tool outputs
- **Cross-Platform**: fs.glob/search.grep use Node.js native (no grep/find dependency)
- **Safe Write EXDEV**: copyFileSync + unlinkSync fallback for cross-partition
- **Rate Limits Cleanup**: Removes expired entries when Map > 100
- **Agent Name Validation**: Rejects path traversal chars
- **Mock Tool Calls**: Simulates tool use for testing with proper termination, respects outputFormat

### Production (V2.2)
- **Circuit Breaker**: LLM calls protected by circuit breaker (failureThreshold=5, resetTimeout=30s). Prevents cascade failures when provider is down. State: CLOSED→OPEN→HALF_OPEN. Probe limit enforced in HALF_OPEN (halfOpenAttempts). Applied in both `runAgent` and `createChatSession`
- **Request Queue**: Concurrency control (default 5 concurrent, 100 queue). Priority ordering, job timeout (5min), backpressure (QUEUE_FULL error), metrics tracking. `destroy()` clears all timers for clean shutdown
- **Distributed Tracing**: Every agent run and chat turn gets a traceId. Spans for each step and tool call. OpenTelemetry export format. Trace metrics (avg/p95 duration). Stored in-memory (max 500 traces, 30min TTL)
- **Health Check**: `aiyu-multi-agent health` — liveness, readiness, component-level checks (config, memory, queue, breakers, LLM providers). JSON output with --json. Config not_configured → not_ready; LLM not_configured → limited
- **Traces CLI**: `aiyu-multi-agent traces` — view recent traces, specific trace details, trace metrics, OpenTelemetry export
- **Structured Logging**: JSON log format via LOG_FORMAT=json env var. Meta field for structured context. setJsonOutput() API
- **Prometheus Metrics**: `usage.formatPrometheusMetrics()` — gauge format for aiyu_* metrics (agent_runs, total_commands, error_rate, etc.)
- **Context Size Limit**: MAX_CONTEXT_CHARS=200000 (~50k tokens). Prevents memory overflow from unbounded context growth. Applied in both runAgent and chat session. Trim preserves last 10 messages (~5 exchanges)
- **Step Duration**: `duration_ms` now includes LLM response time (stepStart measured before LLM call)

### Security (V2.1)
- **Command Injection**: `shell.exec` uses `execFileSync` (no `shell: true`) + `parseCommandArgs` with escape sequences. Blocks `$()`, `` ` ``, `rm -rf`, `mkfs`, `dd if=`, `chmod 777`, `chown root`. No `execSync` anywhere in codebase or generated templates. `BLOCKED_FLAGS` (`-e`, `--eval`, `-c`, `--command`, `-i`, `--repl`) prevent `node -e` style arbitrary code execution
- **Path Traversal**: `pathTraversal(filePath, projectRoot)` — explicit root param + `path.normalize()` on both sides + `fs.realpathSync()` to resolve symlinks. Returns `realResolved` (canonical path). Prevents bypass via double slashes, dot segments, and symlink attacks. Also applied to `shell.exec` cwd argument
- **Allowed Commands**: `python3, node, git, npm, npx, bun, ls, cat, echo, mkdir, cp, mv, grep, find, head, tail, wc, sort, uniq` — no curl/wget
- **File Limits**: search.grep: maxDepth=10, maxFileSize=1MB, maxFiles=1000. fetchJSON: 1MB response limit
- **parseFrontmatter**: Uses `YAML.parse()` only — no fallback parser that could silently produce wrong results
- **Plugin Config**: Uses `fs.writeFileSync()` instead of `safeWrite()` for config.yaml (avoids symlink issues). init.js uses `guardrails.safeWrite()` for .windsurfrules
- **Tool Result Truncation**: Results exceeding 100KB are truncated with `_truncated` flag (applied in both `runAgent` and `createChatSession`)
- **Plugin Isolation**: `executeToolIsolated()` forks child process with restricted permission env vars
- **Input Sanitization**: `sanitizeInput()` — 100K char limit + heuristic prompt injection detection (warning log). Applied in `runAgent()` and `createChatSession().send()`

## Connections

- **CLI → Command module**: via Commander.js action handlers (inspect, test, run, chat, etc.)
- **Command → Core**: commands use config, plugin, guardrails, agent-runtime, utils
- **Agent Runtime → LLM**: via `llmProviders.callLLM` (openai, claude, ollama, mock) with retry/backoff — no re-exports
- **Agent Runtime → Tools**: via `toolRegistry.getTool/resolveToolName/validateToolArgs` — no re-exports
- **Agent Runtime → Utils**: parseFrontmatter, findDefaultAgent from lib/utils
- **Agent → Skill**: via frontmatter `skills:` field
- **Plugin → npm**: `aiyu-multi-agent-skill-<name>` convention
- **Plugin → Permission**: checkPermissions() prompts user, rollback if denied
- **Test → Config**: reads .agent/ or .windsurf/ for assertions
- **Test → Compliance**: `aiyu-multi-agent test --compliance` runs spec validation
- **Test → Unit**: `aiyu-multi-agent test --unit` runs core.test.js
- **Test → Production**: `aiyu-multi-agent test --production` runs production module unit tests (circuit-breaker, queue, tracing, health)
- **Test → Integration**: `aiyu-multi-agent test --integration` runs full agent flow integration tests
- **Health → Components**: `aiyu-multi-agent health` checks config, memory, queue, breakers, LLM providers
- **Traces → Debug**: `aiyu-multi-agent traces` views distributed traces for debugging
- **Agent Runtime → Circuit Breaker**: `circuitBreaker.canExecute/recordSuccess/recordFailure` wraps LLM calls
- **Agent Runtime → Tracing**: `tracing.startTrace/startSpan/endSpan/endTrace` wraps each run and step (FIFO cleanup, no sort)
- **Agent Runtime → Queue**: `getDefaultQueue().enqueue` for concurrent execution control (EventEmitter-based waitFor, crypto.randomUUID job IDs)
- **Publish → npm**: bundles .agent/ as standalone npm package (uses utils.copyRecursive)
- **Usage → Local**: .agent/usage.json, no external telemetry
- **Inspect → Usage**: reads usage.json for stats, tool calls, latency, error rate
- **MCP → Agent Runtime**: `run_agent` calls `agentRuntime.runAgent` with json:true, noCache:true
- **MCP → Config**: `list_agents`/`inspect_agent` reads `.agent/agents/` via config.getConfigDir
- **MCP → SDK**: `@modelcontextprotocol/sdk` (ESM-only, dynamic import) + `zod` for tool schemas
