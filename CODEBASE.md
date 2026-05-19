# CODEBASE.md — Aiyu MultiAgent V2.7.9

## System overview

AI Agent Platform — Smart Init, Plugin System, Agent Testing, and Publishing.

For version history and bug fix details, see [CHANGELOG.md](CHANGELOG.md).

## Architecture V2

```
┌─────────────────────────────────────────┐
│           CLI (Commander.js)            │
│  bin/cli.js — aiyu-multi-agent <command> │
└─────────────┬───────────────────────────┘
              ▼
┌─────────────────────────────────────────┐
│   lib/core/ — Core Engine               │
│   agent-runtime.js — Re-export (V2.6)   │
│   react-loop.js  — ReAct loop        │
│   chat-session.js — Chat session     │
│   failover.js   — Per-provider CB    │
│   cache.js      — LRU cache          │
│   agent-loader.js — Agent spec load  │
│   prompt-builder.js — System prompt  │
│   input-sanitizer.js — Input valid.  │
│   tool-parser.js — Tool call parse   │
│   tool-registry.js — Re-export (V2.6)   │
│   tool-definitions.js — Tools+schema │
│   search-tools.js — Grep + Glob      │
│   command-parser.js — Shell arg parse│
│   llm-providers.js — LLM + retry     │
│   circuit-breaker.js — Failure guard │
│   request-queue.js — Concurrency ctrl │
│   tracing.js   — Async trace queue   │
│   health-check.js — Health monitor   │
│   cli-scanner.js — PATH CLI detect   │
│   question-form.js — Turn-1 discovery │
│   quality-gate.js — Output quality   │
│   artifact-parser.js — Artifact parse│
│   roo-generator.js — Roo Code gen   │
│   tool-runner.js  — Isolated exec       │
│   config.js    — .agent/ + .windsurf/   │
│   plugin.js    — Skill install/remove   │
│   guardrails.js — Security layer        │
│   usage.js     — Usage + Prometheus     │
│   runtime.js   — Node/Bun detection     │
│   logger.js    — Structured JSON logging │
│   types.d.ts   — TypeScript declarations│
└─────────────┬───────────────────────────┘
              ▼
┌─────────────────────────────────────────┐
│   lib/commands/ — CLI Commands          │
│   run.js       — aiyu-multi-agent run        │
│   run-from-file.js — Markdown task runner │
│   chat.js      — aiyu-multi-agent chat       │
│   init.js      — Smart Init             │
│   cursor-generator.js — .cursor/ generator│
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
│   server.js — MCP stdio server       │
│   tools/list-agents.js                  │
│   tools/run-agent.js                    │
│   tools/inspect-agent.js                │
├─────────────────────────────────────────┤
│   lib/api/ — HTTP + WebSocket API       │
│   server.js — Express app + routes      │
│   ws.js — WebSocket real-time stream │
│   handoff.js — Agent handoff + intervene│
│   jobs.js — Async job model             │
│   config.js / middleware.js / etc.      │
├─────────────────────────────────────────┤
│   lib/core/ — Core Engine (continued)   │
│   handoff.js — Agent-to-agent bundles│
│   agent-system.js — Auto-apply profile│
│   cli-adapters/ — CLI engine adapters   │
│   ├── generic-adapter.js — spawn safety │
│   ├── claude-adapter.js — --print wrap  │
│   └── codex-adapter.js — --quiet wrap  │
└─────────────────────────────────────────┘
```

## Core components

### Agents (84 total)
`.windsurf/agents/` — Each with frontmatter: name, description, tools, model, skills

### Skills (46 built-in)
`.windsurf/skills/` — Each skill: SKILL.md + scripts/ + references/

### Workflows (78 total)
`.windsurf/workflows/` — Slash command definitions

### Rules (10 total)
`.windsurf/rules/` — Auto-triggered by keywords

### Core modules
- `lib/core/agent-runtime.js` — **Re-export**: thin re-export of decomposed modules for backward compatibility. All `require("./agent-runtime")` calls work unchanged.
- `lib/core/react-loop.js` — ReAct loop execution (`runAgent`, **accepts AbortSignal for timeout cancellation**, **passes _runId to tool args for WS broadcast tracking**), per-provider failover, tracing, context trimming (**null/break-safe pair eviction**), output format enforcement, **Karpathy large-change guardrail** (fs.write/fs.edit >5KB triggers surgical change warning)
- `lib/core/chat-session.js` — Interactive chat (`createChatSession`, **accepts maxSteps override**, **intervene() method for mid-turn feedback**, **signal support for timeout cancellation**, **chatTimedOut/signal checks after tool Promise.race**), sliding window, char-based context limit, step records
- `lib/core/failover.js` — Per-provider circuit breaker (`llm:openai`, `llm:claude`, `llm:local`, `llm:mock`) with `callLLMWithFailover()` chain (**loop-index based last-provider check** instead of indexOf) + `isAnyLlmAvailable()` check
- `lib/core/cache.js` — LRU cache (100 entries, 5min TTL, deep-copy-on-read, **mutable shallow copy fallback** for circular refs (was Object.freeze — broke `_fromCache` mutation))
- `lib/core/agent-loader.js` — Load agent specs (frontmatter parsing, runtime spec version enforcement, **isValidAgentName path traversal validation**) + skill instructions (**MAX_SKILL_FILE_SIZE=100KB with truncated read for oversized files**)
- `lib/core/prompt-builder.js` — Build system prompts (agent spec + skills + project profile + guardrails + **Karpathy Behavioral Rules**), section-aware skill truncation (MAX_SKILL_INSTRUCTION_CHARS=8000), **dynamic tool list from registry** (no hardcoded tools)
- `lib/core/input-sanitizer.js` — Input validation (100K char limit) + heuristic prompt injection detection
- `lib/core/tool-parser.js` — Parse tool calls from LLM responses (4 strategies: API structured → TOOL_CALL regex → JSON blocks → final answer), balanced-depth paren parser
- `lib/core/tool-registry.js` — **Re-export**: thin re-export of decomposed tool modules for backward compatibility
- `lib/core/tool-definitions.js` — Builtin tools (fs.read/write/edit, shell.exec, fetch.url, **memory.save/load with pathTraversal guard**), TOOL_SCHEMAS, LEGACY_ALIAS, registerTool, validateToolArgs, truncateResult (shallow copy + HALF_MAX), executeToolIsolated (forked child with cwd)
- `lib/core/search-tools.js` — search.grep (**async fs.promises** — no event loop blocking, for-loop with lastIndex reset, ReDoS-safe regex) + fs.glob (glob@10+ Promise API with glob@8 callback fallback, brace alternation `{a,b}` with individual metachar escaping)
- `lib/core/command-parser.js` — parseCommandArgs (escape sequences \\, \", \') + _safeRegex (ReDoS protection)
- `lib/core/llm-providers.js` — OpenAI, Claude (**merges multiple system messages**, **Content-Length header for proxy compatibility**), Ollama (tools, **http/https transport selection by URL protocol**), Mock (respects outputFormat, **UTF-8 safe slice for multi-byte chars**), retry/backoff (**fixed off-by-one: exactly MAX_RETRIES attempts**), 1MB response size limit, default temperature 0.7 for all providers
- `lib/core/tool-runner.js` — Isolated tool runner (forked child process with cwd, restricted env, HALF_MAX truncation consistent with tool-registry, `_truncated` flag, exit code 1 on errors)
- `lib/core/config.js` — Config loader (.agent/ primary, .windsurf/ symlink). **try/catch on config.json parse** to prevent crash on malformed JSON. initConfigDir supports windsurfOnly and agentOnly options. saveVersion uses guardrails.safeWrite
- `lib/core/plugin.js` — npm skill install/remove + permission system (guardrails.safeWrite for config.yaml writes, crypto.randomUUID for temp dirs, exports getSkillDir)
- `lib/core/guardrails.js` — pathTraversal (projectRoot param + path.normalize + fs.realpathSync symlink protection), safeWrite (EXDEV fallback + temp file cleanup on writeFileSync AND renameSync errors, **periodic orphaned temp file cleanup every 5min**), rateLimit (configurable windowMs param, time-based cleanup every 60s, **hard cap 200 entries + FIFO eviction** to prevent unbounded growth from unique keys), sandboxExec (execFileSync, no curl/wget, `_isBlockedFlag()` catches `--eval=code` and short-flag patterns with code-char heuristic — only blocks when remainder contains ` '"();{} ` to allow legitimate flags like `-ecount`)
- `lib/core/usage.js` — Usage statistics + deployment tracking + agentRuns counter + Prometheus metrics export (formatPrometheusMetrics) + getMetrics + safeWrite with projectDir (not cfgDir) for correct pathTraversal scope + **beforeExit + sync fallback flush** + **atomic write (temp+rename) in exit handler** to prevent truncated file
- `lib/core/runtime.js` — Node/Bun dual
- `lib/core/logger.js` — Structured JSON logging (LOG_FORMAT=json), meta field support, setJsonOutput()
- `lib/core/circuit-breaker.js` — Circuit breaker pattern (CLOSED→OPEN→HALF_OPEN→CLOSED), failure threshold, reset timeout, per-service breakers. Guards null lastFailureTime to prevent instant OPEN→HALF_OPEN. resetBreaker clears lastFailureTime/lastFailureError. **recordSuccess clears lastFailureTime on HALF_OPEN→CLOSED recovery** (prevents stale cleanup from deleting active breakers). **halfOpenMaxAttempts default 3** (was 1 — too aggressive for recovery). removeBreaker() for cleanup. **Now used with per-provider keys** (`llm:openai`, `llm:claude`, `llm:local`, `llm:mock`) via `ensureLlmBreaker()` in failover.js
- `lib/core/request-queue.js` — Async job queue with concurrency control, priority ordering, backpressure (QUEUE_FULL), job timeout (**explicit undefined check for timeout=0**), metrics, **_finishJob emits events before _processNext** for correct listener order
- `lib/core/tracing.js` — Distributed tracing (trace+span IDs, OpenTelemetry export), trace storage, metrics (avg/p95 duration with Math.min p95 index clamp). **Async batched write queue with setImmediate scheduling** (prevents unbounded recursion under high throughput)
- `lib/core/health-check.js` — System health (liveness, readiness, component checks: memory, queue, breakers, LLM providers with status+message, **Ollama reachability check only when OLLAMA_HOST is set** with GET method + http/https transport selection + keepAlive:false agent, config, error logging in catch blocks). Async checkReadiness/getFullHealthReport
- `lib/utils.js` — Shared utilities: parseFrontmatter (YAML.parse only, no fallback), copyRecursive (with skipDirs, rootDir param), findDefaultAgent, isValidAgentName, updateGitignore
- `lib/commands/run.js` — Agent execution entry (--verbose, --dry-run, --no-cache, streaming output)
- `lib/commands/chat.js` — Interactive chat session (sliding window MAX_CONTEXT_MESSAGES=20, agent validation on session creation)
- `lib/commands/init.js` — Interactive agent generator (with agent name validation, utils import, projectRoot in safeWrite calls). Supports `--windsurf-only` (.windsurf/ only) and `--agent-only` (.agent/ only, no symlink)
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
- `lib/publish/` — Publish system (packager uses utils.copyRecursive + crypto.randomUUID for temp dirs, validator, registry)
- `lib/mcp/server.js` — MCP server (McpServer + StdioServerTransport, dynamic import for ESM-only SDK). Exposes 3 tools: list_agents, run_agent, inspect_agent. **V2.6: run_agent has 2min timeout + maxSteps cap at 20**
- `lib/mcp/tools/list-agents.js` — Lists all agents in project with name + description (optional verbose: skills, tools, provider, model)
- `lib/mcp/tools/run-agent.js` — Executes agent via agentRuntime.runAgent, returns output + steps + usage. Output truncated at 50KB
- `lib/mcp/tools/inspect-agent.js` — Returns full agent spec (frontmatter + instructions, maxSteps capped at 50)

### Runtime correctness
- **Tool Namespace**: `fs.read`, `fs.write`, `fs.edit`, `fs.glob`, `search.grep`, `shell.exec` — legacy aliases supported, namespace enforced on registration
- **Parser Fallback**: structured JSON → TOOL_CALL regex → JSON code blocks → final answer
- **Arg Validation**: `TOOL_SCHEMAS` with required/optional fields, validated before execution (both runAgent and chat)
- **Step Logging**: `{ step, thought, action, result, error, duration_ms, toolCalls }` — now in both runAgent and chat session
- **Output Contract**: `outputFormat: json` enforces JSON output in both runAgent and chat session (options.outputFormat overrides agentSpec)
- **Deterministic Mode**: `temperature: 0` for stable tests (now passed to all providers: OpenAI, Claude, Ollama)
- **Tool Timeout**: Default 30s per tool call
- **LLM Retry**: Exponential backoff (max 3 retries) for 429, 503, timeout, ECONNRESET
- **Claude Tool Use**: Parses `tool_use` content blocks from Anthropic API
- **Ollama Tools**: Parses `message.tool_calls` from Ollama API
- **Chat ReAct Loop**: Full loop (**maxSteps from options override ?? agent spec ?? DEFAULT_MAX_STEPS, capped at MAX_ALLOWED_STEPS**) with try/catch around callLLM + sliding window (MAX_CONTEXT_MESSAGES=20) + char-based context limit (MAX_CONTEXT_CHARS=200000) + truncateResult on tool outputs + step records (chatSteps[]) + outputFormat enforcement + circuit breaker with retry time + error message pushed as assistant content on circuit breaker/LLM failure for conversation continuity
- **Cross-Platform**: fs.glob/search.grep use Node.js native (no grep/find dependency)
- **Safe Write EXDEV**: copyFileSync + unlinkSync fallback for cross-partition
- **Rate Limits**: Configurable `windowMs` parameter (default 60s). API uses 1-second window for true 10 req/sec. **IP source: `req.ip` primary (Express trust proxy), `X-Forwarded-For` only when `AIYU_TRUST_PROXY=true`** to prevent spoofing. Cleanup removes expired entries when Map > 100. **Hard cap 200 entries** with FIFO eviction prevents unbounded growth from unique keys (e.g. bot scans)
- **Security Headers**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security` (HTTPS only) — applied as global middleware in server.js
- **Metrics Auth**: `/metrics` endpoint requires `apiKeyAuth` middleware — prevents unauthenticated access to Prometheus metrics
- **Agent Name Validation**: Rejects path traversal chars
- **Mock Tool Calls**: Simulates tool use for testing with proper termination, respects outputFormat
- **Karpathy Behavioral Principles** (V2.6): 4 principles injected into system prompt when guardrails enabled — (1) THINK FIRST: state assumptions, ask when uncertain; (2) SIMPLICITY: minimum code, no speculative features; (3) SURGICAL: touch only what you must, every changed line traces to user request; (4) GOAL-DRIVEN: define success criteria, tests first. Large-change guardrail in react-loop.js warns on fs.write/fs.edit >5KB. Self-checks in clean-code skill (senior engineer + surgical). Goal-driven verification in plan-writing skill. Tradeoff note in GEMINI.md for trivial tasks. **All 84 agent `.md` files** include Karpathy reference line in Philosophy/Mindset section
- **Agent System Quality** (V2.6): 84/84 agents have `clean-code` skill (was 82/84). 84/84 have Interaction Maps (was 49/84). `cli.md` tools use standard names (was legacy `fs.read`/`search.grep`). `frontend-specialist.md` decomposed from 26KB → 11KB, design process extracted into `frontend-design-process` skill. `cli.md` has Philosophy + Mindset (was skeleton). `explorer-agent.md` tools fixed (removed non-existent `ViewCodeItem`/`FindByName`)
- **7 New Tools** (V2.6): Tool registry expanded from 7 → 14. `agent.delegate` — nested agent execution with max depth 3, 60s timeout, self-delegation guard. `memory.save`/`memory.load` — file-based agent memory (`.agent/memory/<agent>/<key>.json`). `web.search` — multi-provider web search (SearXNG/Serper/Tavily), configurable via `config.yaml`. `plan.create`/`plan.update`/`plan.list` — structured task planning with status tracking. `Agent` → `agent.delegate` legacy alias added
- **Agent Frontmatter Audit** (V2.6): 84/84 agents have `When to Activate` (was 12/84). 84/84 have `Core Philosophy` (was 81/84). 84/84 have `memory` field — 73 `session` + 11 `persistent` (orchestrators/planner/explorer). New tools in frontmatter: `memory.save`/`memory.load` (84/84), `web.search` (17 researchers), `plan.create`/`update`/`list` (15 planners). 9 orchestration workflows have `Available Orchestration Tools` table

### Production infrastructure
- **Circuit Breaker**: LLM calls protected by **per-provider** circuit breaker (`llm:openai`, `llm:claude`, `llm:local`, `llm:mock`) with failureThreshold=5, resetTimeout=30s. Prevents cascade failures when a single provider is down without blocking other providers. `callLLMWithFailover()` iterates provider chain, skipping OPEN breakers. `isAnyLlmAvailable()` for API-level pre-check. Applied in both `runAgent` and `createChatSession`
- **Request Queue**: Concurrency control (default 5 concurrent, 100 queue). Priority ordering, job timeout (5min), backpressure (QUEUE_FULL error), metrics tracking. `destroy()` clears all timers for clean shutdown
- **Distributed Tracing**: Every agent run and chat turn gets a traceId. Spans for each step and tool call. OpenTelemetry export format. Trace metrics (avg/p95 duration). Stored in-memory (max 500 traces, 30min TTL)
- **Health Check**: `aiyu-multi-agent health` — liveness, readiness, component-level checks (config, memory, queue, breakers, LLM providers with status+message). JSON output with --json. Config not_configured → not_ready; LLM not_configured → limited. Icon recognizes 'healthy' status
- **Traces CLI**: `aiyu-multi-agent traces` — view recent traces, specific trace details, trace metrics, OpenTelemetry export
- **Structured Logging**: JSON log format via LOG_FORMAT=json env var. Meta field for structured context. setJsonOutput() API
- **Prometheus Metrics**: `usage.formatPrometheusMetrics()` — gauge format for aiyu_* metrics (agent_runs, total_commands, error_rate, etc.)
- **Context Size Limit**: MAX_CONTEXT_CHARS=200000 (~50k tokens). Prevents memory overflow from unbounded context growth. Applied in both runAgent and chat session. Trim preserves last 10 messages (~5 exchanges)
- **Step Duration**: `duration_ms` now includes LLM response time (stepStart measured before LLM call)

### Security
- **Command Injection**: `shell.exec` uses `execFileSync` (no `shell: true`) + `parseCommandArgs` with escape sequences. Blocks `$()`, `` ` ``, `rm -rf`, `mkfs`, `dd if=`, `chmod 777`, `chown root`. No `execSync` anywhere in codebase or generated templates. `BLOCKED_FLAGS` (`-e`, `--eval`, `-c`, `--command`, `-i`, `--repl`) prevent `node -e` style arbitrary code execution. `_isBlockedFlag()` catches `--eval=code` and short-flag concatenation with code-char heuristic (` '"();{}`) — allows legitimate flags like `-ecount`. Path-prefixed commands (e.g., `./node`) rejected to prevent allowlist bypass — only bare command names passed to `sandboxExec`
- **Path Traversal**: `pathTraversal(filePath, projectRoot)` — explicit root param + `path.normalize()` on both sides + `fs.realpathSync()` to resolve symlinks. Returns `realResolved` (canonical path). Prevents bypass via double slashes, dot segments, and symlink attacks. Also applied to `shell.exec` cwd argument
- **Allowed Commands**: `python3, node, git, npm, npx, bun, ls, cat, echo, mkdir, cp, mv, grep, find, head, tail, wc, sort, uniq`
- **File Limits**: search.grep: maxDepth=10, maxFileSize=1MB, maxFiles=1000, **async fs.promises walk** (no event loop blocking). fetchJSON: 1MB response limit
- **parseFrontmatter**: Uses `YAML.parse()` only — no fallback parser that could silently produce wrong results
- **Plugin Config**: Uses `guardrails.safeWrite()` for config.yaml writes (with projectRoot). init.js uses `guardrails.safeWrite()` with projectRoot for all generated files
- **Tool Result Truncation**: Results exceeding 100KB are truncated with `_truncated` flag (applied in both `runAgent` and `createChatSession`, also in `tool-runner.js` isolated execution). **Uses shallow copy `{...result}` instead of `JSON.parse(JSON.stringify())`** — only serializes for final size check
- **Plugin Isolation**: `executeToolIsolated()` forks child process with restricted permission env vars
- **Glob Semantics**: `?` matches any char except `/` (consistent with `*` to `[^/]*`), `**` matches any path including `/`. `{a,b,c}` brace alternation expanded with **individual metachar escaping per alternative** before joining with `|`, preventing regex injection from brace values like `{a.c,b*}`. Fallback glob skips `node_modules` and `.git`, transforms wildcards before escaping regex metacharacters. glob@10+ Promise API with glob@8 callback fallback
- **Input Sanitization**: `sanitizeInput()` — 100K char limit + heuristic prompt injection detection (warning log). Applied in `runAgent()` and `createChatSession().send()`. **WS intervene: MAX_INTERVENTION_LENGTH=10000** matches HTTP /agents/intervene limit
- **fs.edit Uniqueness**: `fs.edit` enforces unique `old_string` — rejects edit when multiple occurrences found, returns error with occurrence count. Prevents silent partial edits

## Connections

- **CLI → Command module**: via Commander.js action handlers (inspect, test, run, chat, etc.)
- **Command → Core**: commands use config, plugin, guardrails, agent-runtime, utils
- **Agent Runtime → LLM**: via `callLLMWithFailover()` (failover.js) → `llmProviders.callLLM` (openai, claude, ollama, mock) with retry/backoff
- **Agent Runtime → Tools**: via `toolRegistry.getTool/resolveToolName/validateToolArgs` (tool-definitions.js) — no re-exports
- **Agent Runtime → Utils**: parseFrontmatter, findDefaultAgent from lib/utils
- **React Loop → Failover**: `callLLMWithFailover()` wraps LLM calls with per-provider circuit breaker
- **React Loop → Cache**: `_cacheGet/_cacheSet` for result caching with TTL + deep-copy-on-read
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
- **Agent Runtime → Circuit Breaker**: Per-provider `circuitBreaker.canExecute/recordSuccess/recordFailure` wraps LLM calls via `callLLMWithFailover()`. `isAnyLlmAvailable()` for API/MCP pre-checks
- **Agent Runtime → Tracing**: `tracing.startTrace/startSpan/endSpan/endTrace` wraps each run and step (FIFO cleanup, no sort)
- **Agent Runtime → Queue**: `getDefaultQueue().enqueue` for concurrent execution control (EventEmitter-based waitFor with 1s timeout buffer, crypto.randomUUID job IDs)
- **Publish → npm**: bundles .agent/ as standalone npm package (uses utils.copyRecursive)
- **Usage → Local**: .agent/usage.json, no external telemetry
- **Inspect → Usage**: reads usage.json for stats, tool calls, latency, error rate
- **MCP → Agent Runtime**: `run_agent` calls `agentRuntime.runAgent` with json:true, noCache:true + usage.trackCommand({via: "mcp"}). **V2.6: 2min timeout + maxSteps cap at 20**. `agent_name` is optional (z.string().optional()), defaults to findDefaultAgent(). API /jobs validates resolvedAgentName before enqueue, validates max_steps 1-50, passes projectDir explicitly, **uses `isAnyLlmAvailable()` for circuit breaker pre-check**
- **MCP → Config**: `list_agents`/`inspect_agent` reads `.agent/agents/` via config.getConfigDir + markInitialized() on server start
- **MCP → SDK**: `@modelcontextprotocol/sdk` (ESM-only, dynamic import) + `zod` for tool schemas

## Dashboard

Standalone Next.js 14 application in `aiyu-multi-agent-dashboard/` — real-time agent monitoring.

### Architecture

```
┌─────────────────────────────────────────┐
│     Dashboard (Next.js 14 + Tailwind)   │
│  ┌─────────────────────────────────┐    │
│  │  useWebSocket hook             │    │
│  │  ├── agent.status events       │    │
│  │  ├── step/complete events      │    │
│  │  └── auto-reconnect (exp backoff)│ │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │  Components                     │    │
│  │  ├── AgentStatusPanel          │    │
│  │  ├── ExecutionTimeline         │    │
│  │  ├── InterventionPanel         │    │
│  │  ├── InteractionMap            │    │
│  │  ├── MemoryViewer              │    │
│  │  ├── MetricsPanel              │    │
│  │  ├── LogsViewer                │    │
│  │  └── ThemeToggle               │    │
│  └─────────────────────────────────┘    │
└─────────────────┬───────────────────────┘
                  │ WebSocket /ws
                  │ HTTP /agents/statuses
                  │ HTTP /metrics
┌─────────────────▼───────────────────────┐
│         Aiyu API Server (port 3000)   │
└─────────────────────────────────────────┘
```

### Features by phase

- **P0 (Core)**: Agent Status, Execution Timeline, Intervention, Run Input
- **P2 (Enhanced)**: Interaction Map, Memory Viewer, Metrics Panel, Logs Viewer
- **P3 (Polish)**: Dark Mode, Export JSON, Keyboard Shortcuts (Ctrl+Enter/Esc), Auto-Reconnect, Mobile Responsive

### Dashboard connections

- **Dashboard → WS**: Real-time events via `/ws` (agent.status, step, complete, error)
- **Dashboard → HTTP**: Poll `/agents/statuses` for initial state, `/metrics` for stats
- **Dashboard → Export**: Download JSON with runs, completedRuns, agentStatuses
