# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.3.0] - 2026-05-05

### Added — MCP Server (Issue #1)

- **🔥 `aiyu-multi-agent mcp`** — Start MCP server (stdio transport) for integration with Claude Code, Cursor, Zed, Windsurf
- **`list_agents` tool** — Discover available agents in the project
- **`run_agent` tool** — Execute an agent with input, optional provider/model/max_steps overrides
- **`inspect_agent` tool** — Get detailed agent metadata (skills, tools, instructions)
- **Provider keys** — Reads from same config as CLI (`.agent/config.yaml` / `.windsurf/config.yaml`), env vars (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OLLAMA_HOST`) take priority
- **Dependencies** — Added `@modelcontextprotocol/sdk` + `zod`
- **README** — Added MCP Server section with host configuration examples

### Fixed — System-Wide Bug Audit (18 bugs)

- **🔴 packager.js: execSync in generated bin/run.js** — Removed `execSync` import from published agent template (security regression from V2.1 migration). Also renamed temp dir prefix from `windsurf-publish-` to `aiyu-multi-agent-publish-`
- **🔴 test.js: execSync for unit/integration tests** — Replaced `execSync(\`node "${testFile}"\`)` with `execFileSync("node", [testFile])` in all 3 test runners (unit, production, integration) — same command injection regression
- **🔴 agent-runtime.js: chat session missing truncateResult** — Chat mode tool execution now calls `toolRegistry.truncateResult()` on results (same as `runAgent`). Previously, unbounded tool results in chat could cause OOM
- **🔴 agent-runtime.js: inconsistent tool name resolution** — `getTool(toolCall.tool)` changed to `getTool(resolvedName)` so error messages and tool lookup use the same resolved name. Legacy aliases (e.g., "Bash" → "shell.exec") now resolve consistently
- **🔴 health-check.js: lazy require("../../package.json")** — Moved to top-level `const PKG = require(...)` to avoid stale version after package update and potential path resolution errors
- **🟠 cli.js: cmdList/cmdInfo always read from package dir** — `cmdList()` and `cmdInfo()` now use `config.getConfigDir(process.cwd())` with fallback to `WINDSURF_DIR`. Previously, user-created agents and workflows were invisible to `list`/`info` commands
- **🟠 agent-runtime.js: cache key missing outputFormat/deterministic** — `_cacheKey()` now includes `outputFormat` and `deterministic` so cached results aren't served for different format/mode requests
- **🟠 tool-registry.js: shell.exec cwd path traversal** — `shell.exec` now validates `args.cwd` with `guardrails.pathTraversal()` before passing to `sandboxExec`. Previously, `cwd: "../../etc"` could execute commands outside project root
- **🟠 agent-runtime.js: chat session hardcoded maxChatSteps=5** — Changed to `Math.min(agentSpec.maxSteps || DEFAULT_MAX_STEPS, 10)` so chat respects agent's configured `max_steps`
- **🟡 llm-providers.js: Claude/Ollama missing temperature** — `callClaude` and `callOllama` now pass `options.temperature` to their request bodies. Deterministic mode (`temperature: 0`) now works with all providers, not just OpenAI
- **🟡 test/runner.js: tools parsing crash on YAML array** — `fm.tools.split(",")` throws TypeError when YAML parses tools as array. Now uses `Array.isArray(fm.tools) ? fm.tools : fm.tools.split(",").map(...)` matching the pattern used everywhere else
- **🟡 guardrails.js: pathTraversal returns non-canonical path** — Now returns `realResolved` (symlink-resolved) instead of `resolved` to prevent symlink-based path escape after validation
- **🟡 agent-runtime.js: random cache eviction** — Replaced random eviction with LRU (delete oldest by timestamp). Previously, random eviction could evict recently-used entries while keeping stale ones
- **🟡 request-queue.js: waitFor uses 50ms polling** — Replaced `setInterval` polling with `EventEmitter`-based Promise resolution. Eliminates unnecessary CPU usage and up to 50ms resolution latency
- **🟡 tracing.js: O(n log n) cleanup on every startTrace** — Replaced sort-based cleanup with FIFO iteration (Map preserves insertion order). Reduces trace creation overhead under high volume
- **🟢 packager.js: generated README references "Windsurf IDE"** — Changed to "Aiyu MultiAgent" with `npx aiyu-multi-agent run` command instead of `windsurf .`
- **🟢 cli.js: fetchJSON redirect SSRF** — `fetchJSON` now validates redirect URL protocol (http/https only) before following. Previously, malicious servers could redirect to `file://` or other protocols
- **🟢 request-queue.js: job ID collision risk** — Job IDs now use `crypto.randomUUID()` instead of `Date.now() + 6-char random`. Eliminates collision risk under high throughput

### Fixed — Security Hardening (2 critical)

- **🔴 guardrails.js: `node -e` sandbox bypass** — Added `BLOCKED_FLAGS` (`-e`, `--eval`, `-c`, `--command`, `-i`, `--interactive`, `--repl`) to prevent arbitrary code execution via `node -e "require('child_process').execSync('rm -rf /')"`. Blocked in both `sandboxExec()` and `shell.exec` tool handler (defense-in-depth)
- **🔴 agent-runtime.js: no input sanitization** — Added `sanitizeInput()`: 100K char length limit + heuristic prompt injection detection (logs warning, doesn't block). Applied in both `runAgent()` and `createChatSession().send()`

---

## [2.2.4] - 2026-05-05

### Fixed — Bug Audit (14 bugs)

- **🔴 packager.js: bin/run.js ReferenceError** — Generated `bin/run.js` called `utils.copyRecursive` without importing `utils`. Now includes inline `copyRecursive` implementation
- **🔴 plugin.js: config.yaml writes bypass guardrails** — `registerSkill`/`unregisterSkill` used `fs.writeFileSync` instead of `guardrails.safeWrite`. Now uses safe write with path traversal protection
- **🔴 test.js: misleading variable name** — `chokidar = require("fs")` renamed to `fs = require("fs")` — was working by accident but confusing
- **🟡 agent-runtime.js: operator precedence** — `Math.round(x) / 1000` → `Math.round(x / 1000)` for circuit breaker retry-seconds display
- **🟡 plugin.js: inconsistent inquirer import** — Dynamic `import("inquirer")` → `require("inquirer").default` matching rest of codebase
- **🟡 validator.js: false .gitignore warning** — Removed incorrect warning about `.agent`/`.windsurf` not in `.gitignore` (they're project config, should be tracked)
- **🟡 cli.js: duplicate import** — Removed redundant `const { countFiles, countDirs, updateGitignore } = require(...)` — now uses `utils.*` consistently
- **🟡 config.js: saveVersion ignores windsurf-only** — `saveVersion` fallback `getAgentDir()` could write `.version` to wrong directory. Now uses `getConfigDir()` only
- **🟡 packager.js: .version in skipDirs** — `.version` is a file not a dir, `skipDirs` only filters directories. Removed from list
- **🟢 agent-runtime.js: cache eviction O(n log n)** — Sorted all entries on every `_cacheSet`. Changed to O(1) random eviction
- **🟢 llm-providers.js: unlimited response accumulation** — Added 1MB size limit to OpenAI, Claude, and Ollama response handlers to prevent OOM
- **🟢 request-queue.js: waitFor double reject** — `setInterval` + `setTimeout` could both fire. Added `settled` flag + proper cleanup

---

## [2.2.3] - 2026-05-05

### Added

- **`--windsurf-only` flag** — `aiyu-multi-agent init --windsurf-only` creates `.windsurf/` only (no `.agent/` directory). Useful for Windsurf IDE projects that don't need the `.agent/` hybrid config
- **`--agent-only` flag** — `aiyu-multi-agent init --agent-only` creates `.agent/` only (no `.windsurf/` symlink). Useful for non-Windsurf environments or CI/CD

---

## [2.2.2] - 2026-05-05

### Fixed — Full System Audit (20 bugs)

- **🔴 Circuit breaker null lastFailureTime** — `canExecute()` OPEN state now guards against `null` `lastFailureTime` (e.g. after manual reset). Previously, `Date.now() - null` evaluated to `Date.now()`, causing instant OPEN→HALF_OPEN transition
- **🔴 Hardcoded resetTimeoutMs in error message** — `agent-runtime.js` circuit breaker error message now reads `breaker.options.resetTimeoutMs` instead of hardcoded `30000`
- **🔴 Invalid Claude model name** — `llm-providers.js` default Claude model changed from nonexistent `claude-sonnet-4-20250514` to valid `claude-3-5-sonnet-20241022`
- **🔴 Symlink traversal attack** — `guardrails.pathTraversal()` now uses `fs.realpathSync()` to resolve symlinks before checking path prefix
- **🔴 init.js bypasses guardrails** — `generateWindsurfrules()` now uses `guardrails.safeWrite()` instead of `fs.writeFileSync()`
- **🔴 --interactive flag ignored** — `cli.js cmdInit()` now passes `options.interactive` to `initCmd.run()`
- **🟡 || instead of ??** — `agent-runtime.js` changed `||` to `??` for `maxSteps`, `outputFormat`, `deterministic`, `provider`, `model`
- **🟡 RequestQueue operations after destroy** — `enqueue()` and `waitFor()` now check `_destroyed` flag
- **🟡 JSON.stringify crash on circular references** — Added `safeStringify()` helper and try/catch in `truncateResult()`
- **🟡 safeWrite temp file leak** — `guardrails.safeWrite()` now cleans up temp file on all error paths
- **🟡 publish dry-run temp file leak** — `publish.js` now cleans up tmpDir before returning in dry-run mode
- **🟡 fs.cpSync Node <16.7 incompatibility** — `packager.js` generated `bin/run.js` now uses `utils.copyRecursive()`
- **🟢 Tracing Map cleanup logic** — `tracing.js` cleanup now sorts entries and breaks when under limit
- **🟢 Health check memory calculation** — `health-check.js` now uses `heapTotal` instead of `os.totalmem()`
- **🟢 Production test isolation** — `production.test.js` now calls `resetBreaker()` between tests
- **🟢 Plugin duplicate path logic** — `plugin.js` consolidated duplicate path construction
- **🟢 Chat trace step count** — `createChatSession` now tracks actual step count
- **🟢 Deterministic compliance test** — `compliance.js` test now actually runs an agent

### Changed

- **Version** — Bumped from 2.2.0 to 2.2.1

---

## [2.2.0] - 2026-05-05

### Added — Production Infrastructure

- **Circuit Breaker** — `lib/core/circuit-breaker.js` — Prevents cascade failures when LLM providers are down. States: CLOSED→OPEN→HALF_OPEN→CLOSED. Configurable failure threshold (default 5) and reset timeout (default 30s). Per-service breakers
- **Request Queue** — `lib/core/request-queue.js` — Async job queue with concurrency control (default 5 concurrent, 100 queue). Priority ordering, job timeout (5min), backpressure (QUEUE_FULL error), metrics tracking, destroy() for cleanup
- **Distributed Tracing** — `lib/core/tracing.js` — Every agent run gets a traceId. Spans for each step and tool call. OpenTelemetry export format. Trace metrics (avg/p95 duration). In-memory storage (max 500 traces, 30min TTL)
- **Health Check** — `lib/core/health-check.js` — System health monitoring: liveness, readiness, component-level checks (config, memory, queue, circuit breakers, LLM providers). `aiyu-multi-agent health` and `aiyu-multi-agent health --json`
- **Traces CLI** — `aiyu-multi-agent traces` — View recent traces, specific trace details (`--id`), trace metrics (`--metrics`), OpenTelemetry export (`--otel`)
- **Structured JSON Logging** — `LOG_FORMAT=json` env var for JSON log output. `setJsonOutput()` API. Meta field for structured context
- **Prometheus Metrics** — `usage.formatPrometheusMetrics()` — Gauge format for `aiyu_*` metrics (agent_runs, total_commands, error_rate, commands_per_day, etc.)
- **Context Size Limit** — `MAX_CONTEXT_CHARS=200000` (~50k tokens). Prevents memory overflow from unbounded context growth. Applied in both `runAgent` and chat session
- **Production Unit Tests** — `lib/test/unit/production.test.js` — 25 tests for circuit-breaker, request-queue, tracing, health-check
- **Integration Tests** — `lib/test/integration/flow.test.js` — 12 tests for full agent flow with tracing, breaker, queue, health, metrics
- **Test CLI flags** — `aiyu-multi-agent test --production` and `aiyu-multi-agent test --integration`

### Fixed

- **🔴 Chat session missing circuit breaker** — `createChatSession.send()` now checks `circuitBreaker.canExecute("llm")` before LLM calls and records success/failure. Previously, only `runAgent` had circuit breaker protection, leaving chat sessions vulnerable to cascade failures
- **🔴 Chat session missing tracing** — Chat turns now create traces with `tracing.startTrace/endTrace` and spans. Chat entries include `traceId`. Previously, chat sessions had zero observability
- **🟠 Circuit breaker HALF_OPEN probe leak** — `canExecute()` now increments `halfOpenAttempts` when allowing a probe request in HALF_OPEN state. Previously, the counter was never incremented, allowing unlimited probe requests instead of the configured `halfOpenMaxAttempts`
- **🟠 Step duration_ms excluded LLM time** — `stepStart = Date.now()` moved before the LLM call instead of after. Previously, `duration_ms` only measured tool execution time, not the full step including LLM response
- **🟠 Context trim too aggressive** — Changed `messages.slice(-6)` to `messages.slice(-10)` in context trimming. Previously, only 3 exchanges were preserved when trimming, which could lose important tool result messages
- **🟠 RequestQueue timer leak** — Added `_activeTimers` Set to track all setTimeout references. `destroy()` now clears all timers. Previously, job timeout timers were never cleaned up, causing Node.js process to hang indefinitely
- **🟡 Health readiness logic confused config vs LLM** — `checkReadiness()` now distinguishes config `not_configured` (→ `not_ready`) from LLM provider `not_configured` (→ `limited`). Previously, missing API keys could incorrectly report `limited` even when the project itself wasn't initialized
- **🟡 Test process hanging** — Production and integration tests now use `jobTimeoutMs: 1000` (was default 300000/5min), call `queue.destroy()`, and use `process.exit(0)` to ensure clean exit

### Fixed — Full System Audit (20 bugs)

- **🔴 Circuit breaker null lastFailureTime** — `canExecute()` OPEN state now guards against `null` `lastFailureTime` (e.g. after manual reset). Previously, `Date.now() - null` evaluated to `Date.now()`, causing instant OPEN→HALF_OPEN transition
- **🔴 Hardcoded resetTimeoutMs in error message** — `agent-runtime.js` circuit breaker error message now reads `breaker.options.resetTimeoutMs` instead of hardcoded `30000`. Previously, error showed wrong retry time if custom timeout was configured
- **🔴 Invalid Claude model name** — `llm-providers.js` default Claude model changed from nonexistent `claude-sonnet-4-20250514` to valid `claude-3-5-sonnet-20241022`
- **🔴 Symlink traversal attack** — `guardrails.pathTraversal()` now uses `fs.realpathSync()` to resolve symlinks before checking path prefix. Previously, symlinks could bypass path traversal protection and escape project root
- **🔴 init.js bypasses guardrails** — `generateWindsurfrules()` now uses `guardrails.safeWrite()` instead of `fs.writeFileSync()`. Previously, `.windsurfrules` creation skipped all security checks
- **🔴 --interactive flag ignored** — `cli.js cmdInit()` now passes `options.interactive` to `initCmd.run()`. Previously, `aiyu-multi-agent init --interactive` always used quick defaults
- **🟡 || instead of ?? for maxSteps/outputFormat** — `agent-runtime.js` changed `||` to `??` for `maxSteps`, `outputFormat`, `deterministic`, `provider`, `model` in both `runAgent` and `createChatSession`. Previously, falsy-but-valid values like `0` or empty string fell back to defaults
- **🟡 RequestQueue operations after destroy** — `enqueue()` and `waitFor()` now check `_destroyed` flag and throw `QUEUE_DESTROYED` error. Previously, operations on a destroyed queue caused undefined behavior
- **🟡 JSON.stringify crash on circular references** — `tool-registry.js truncateResult()` and `agent-runtime.js safeStringify()` now wrap `JSON.stringify` in try/catch. Previously, circular references in tool results caused uncaught TypeError crashes
- **🟡 safeWrite temp file leak** — `guardrails.safeWrite()` now cleans up temp file on all error paths (EXDEV fallback and non-EXDEV errors). Previously, failed writes left orphan temp files in `os.tmpdir()`
- **🟡 publish dry-run temp file leak** — `publish.js` now cleans up `pkgResult.tmpDir` before returning in dry-run mode. Previously, `--dry-run` left temp package directories on disk
- **🟡 fs.cpSync Node <16.7 incompatibility** — `packager.js` generated `bin/run.js` now uses `utils.copyRecursive()` instead of `fs.cpSync()`. Previously, published packages failed on Node 16.0–16.6
- **🟢 Tracing Map cleanup logic** — `tracing.js` cleanup now sorts entries by startTime and breaks when `size <= MAX_TRACES`. Previously, cleanup could leave excess traces or skip entries
- **🟢 Health check memory calculation** — `health-check.js` now divides `heapUsed` by `heapTotal` (not `os.totalmem()`). Previously, memory percentage was misleadingly low (e.g. 0.1% instead of 45%)
- **🟢 Production test isolation** — `production.test.js` now calls `resetBreaker()` between shared-state tests. Previously, test order could affect `getAllBreakerStatuses` assertions
- **🟢 Plugin duplicate path logic** — `plugin.js` consolidated duplicate `pkgDir`/`altDir`/`sourceDir` construction into single determination. Previously, path was constructed in 2 separate blocks with inconsistent error handling
- **🟢 Chat trace step count** — `createChatSession` now tracks `actualSteps` counter and passes it to `endTrace`. Previously, `maxChatSteps` constant (5) was used, always reporting 5 steps regardless of actual count
- **🟢 Deterministic compliance test** — `compliance.js` deterministic mode test now actually runs an agent with `deterministic: true` and validates completion. Previously, test was hardcoded `passed: true`

### Changed

- **Version** — Bumped from 2.1.10 to 2.2.0
- **CODEBASE.md** — Updated to V2.2 with all new production modules, CLI commands, and connections
- **package.json** — Version updated to 2.2.0

---

## [2.1.8] - 2026-05-04

### Fixed

- **🔴 Critical: safeWrite missing projectRoot** — `guardrails.safeWrite()` was not receiving `projectRoot` parameter, causing path traversal checks to use `process.cwd()` instead of the actual project root. Now passes `projectRoot` through from all tool handlers
- **🔴 Critical: tool calls missing projectRoot** — `runAgent()` and `createChatSession()` were not injecting `projectRoot` into tool call args, so tools like `fs.write` and `fs.edit` could bypass path traversal protection. Now injects `{ ...args, projectRoot: projectDir }`
- **🟡 Stale temp file prefix** — `safeWrite()` temp files used `windsurf-agent-` prefix (old name). Changed to `aiyu-multi-agent-`
- **🟡 Dead code** — Removed unused `selectedUseCase` variable in `init.js`

## [2.1.7] - 2026-05-04

### Added

- **3 Design Agents** — `uiux-designer` (UI/UX, wireframes, color, typography), `design-system-architect` (tokens, component API, theming), `visual-designer` (brand, icons, motion, illustration) — 83 agents total

---

## [2.1.5] - 2026-05-04

### Fixed

- **Legacy .gitignore headers** — `updateGitignore` now auto-replaces old section headers (`# windsurf-agent-cli`, `# Aiyu AgentForge`, `# Aiyu SubAgent`, `# Aiyu-subagent`) with `# Aiyu MultiAgent` instead of adding a duplicate section

## [2.1.4] - 2026-05-04

### Changed

- **Quick Init** — `aiyu-multi-agent init` no longer prompts by default. Uses smart defaults: auto-detect provider from env vars, agent name from folder name, guardrails on, memory none
- **Interactive mode** — `aiyu-multi-agent init --interactive` for full 5-question setup (previous default behavior)
- **Auto-detect provider** — Checks `ANTHROPIC_API_KEY` → claude, `OPENAI_API_KEY` → openai, else mock

## [2.1.3] - 2026-05-04

### Fixed

- **Full library on init** — `init` now copies all 80 agents, 46+ skills, 78 workflows, rules, and scripts from the package (previously only copied 3 core skills)
- **`.windsurf/` symlink always created** — No longer requires `.windsurfrules` to exist beforehand
- **`.windsurfrules` auto-generated** — Created during init for Windsurf IDE compatibility

## [2.1.2] - 2026-05-04

### Fixed

- **`.windsurf/` symlink on init** — Symlink created unconditionally during init (was conditional on `.windsurfrules` existing)
- **`.windsurfrules` generation** — Auto-generated during init with project-specific content

## [2.1.1] - 2026-05-04

### Fixed

- **inquirer v9 ESM import** — Fixed `inquirer.prompt is not a function` error by using `require("inquirer").default` for CommonJS compatibility. Affected `init.js`, `chat.js`, and `plugin.js`

---

## [2.1.0] - 2026-05-04

### Security — Critical Fixes

- **Command Injection (C1)** — `shell.exec` replaced `execSync` + `shell: true` with `execFileSync` + `parseCommandArgs` (proper arg parsing with escape sequences). Added dangerous pattern detection for command substitution (`$()`, `` ` ``) and destructive commands (`rm -rf`, `mkfs`, `dd if=`, `chmod 777`, `chown root`)
- **Path Traversal (C2)** — `pathTraversal()` now accepts explicit `projectRoot` parameter instead of relying on `process.cwd()`. All tool handlers pass `args.projectRoot || args.cwd || process.cwd()`. Added `path.normalize()` on both resolved path and root to prevent bypass via double slashes or dot segments
- **parseFrontmatter (C3)** — Replaced naive line-by-line parser with `YAML.parse()` (from `yaml` package). Removed fallback parser that silently produced wrong results on nested YAML
- **curl/wget removed** — Removed `curl` and `wget` from `ALLOWED_COMMANDS` to prevent arbitrary network access without guardrails

### Security — High Fixes

- **Dangerous pattern false positives** — Moved pattern detection to run after arg parsing (not on raw command string). Removed `> | ; & && ||` from forbidden patterns (not dangerous with `execFileSync` which has no shell). Only command substitution patterns remain blocked. `echo "2 > 1"` now works correctly
- **parseCommandArgs escape sequences** — Added support for `\" \' \\` escape sequences inside quoted strings. `echo "it's \"ok\""` now parses correctly
- **search.grep recursion depth** — Added `maxDepth=10` parameter to prevent infinite directory traversal
- **search.grep file size limit** — Added `maxFileSize=1MB` + `fs.statSync` check before reading files to prevent OOM
- **search.grep file count limit** — Added `maxFiles=1000` counter with early return + `_truncated` flag to prevent OOM on large projects
- **Chat session error handling** — Added `try/catch` around `callLLM` in chat ReAct loop. Failed LLM calls now produce `"LLM call failed: ..."` instead of crashing
- **Chat session validateToolArgs** — Added tool argument validation in chat session (was missing, only `runAgent` had it)
- **plugin.js safeWrite symlink** — Replaced `guardrails.safeWrite()` with `fs.writeFileSync()` for config.yaml updates. Atomic rename is unnecessary for config and breaks with symlinks

### Fixed

- **init.js missing require** — Added `const utils = require("../utils")` at top level. Was using `utils.copyRecursive` and `utils.updateGitignore` without importing the module — crash on `aiyu-multi-agent init`
- **init.js default agent name** — Fixed `selectedUseCase` being `null` when default function runs. Changed to use inquirer's `currentAnswers` parameter instead of external variable
- **fetchJSON response size** — Added `MAX_RESPONSE_SIZE=1MB` limit. Destroys request and rejects if response exceeds limit
- **truncateResult _truncated flag** — Set `_truncated = true` whenever truncation occurs (was only set for `matches`/`files` arrays, not for `content`/`stdout`)
- **outputFormat precedence** — `options.outputFormat` now correctly overrides `agentSpec.outputFormat` (was reversed)
- **Mock provider outputFormat** — `callMock` now respects `outputFormat: "json"` option and returns valid JSON when requested
- **CLI --json flag** — Now sets `outputFormat: "json"` in addition to `jsonMode` so `runAgent` receives it

### Changed — Architecture

- **Re-exports removed** — Removed `callLLM`, `registerTool`, `getTool`, `listTools`, `resolveToolName`, `validateToolArgs`, `BUILTIN_TOOLS`, `TOOL_SCHEMAS`, `LEGACY_ALIAS` re-exports from `agent-runtime.js`. All consumers now import directly from `tool-registry` and `llm-providers`
- **inspect command extracted** — Moved 108-line inline inspect handler from `cli.js` to `lib/commands/inspect.js` (consistent with other command modules). `cli.js` reduced from 541 to ~440 lines
- **copyTemplateDir deduplicated** — Removed `copyTemplateDir()` from `init.js`. Uses `utils.copyRecursive()` instead
- **copyDirFiltered deduplicated** — Removed `copyDirFiltered()` from `packager.js`. Uses `utils.copyRecursive({ skipDirs })` instead
- **fs.glob fallback** — Replaced broken `includes(pattern.replace("*", ""))` with proper `globToRegex()` converter. `**/*.test.js` patterns now match correctly
- **dev/generate commands** — Marked as `[experimental]` with "not yet implemented" message instead of "coming in future phase"
- **cmdList cache** — Added 30-second cache for workflow file descriptions to avoid re-reading all files on every `aiyu-multi-agent` invocation

### Added

- **Spec Compliance Tests** — `aiyu-multi-agent test --compliance` runs 15 automated spec compliance checks (max steps, tool namespaces, guardrails, output format, step logging, deterministic mode, result truncation)
- **Unit Tests** — `aiyu-multi-agent test --unit` runs 29 core module unit tests for guardrails, tool-registry, and llm-providers
- **Caching Layer** — In-memory SHA-256 cache with TTL (30s) and `--no-cache` flag in `aiyu-multi-agent run`
- **Streaming Output** — Color-coded step-by-step output with `--verbose` flag in `aiyu-multi-agent run`
- **Dry Run** — `--dry-run` flag in `aiyu-multi-agent run` shows plan without executing
- **Observability** — `aiyu-multi-agent inspect` command shows usage stats, tool calls, latency, error rate, agent list
- **Agent Packaging Metadata** — Published packages include `aiyu-multi-agent` field in `package.json` for ecosystem discoverability
- **Plugin Isolation** — `executeToolIsolated()` forks child process with restricted permission env vars
- **Tool Result Truncation** — Results exceeding 100KB are truncated with `_truncated` flag
- **Runtime Spec Version** — `loadAgentSpec` enforces config version compatibility
- `lib/commands/inspect.js` — Observability command module
- `lib/test/compliance.js` — Spec compliance test framework
- `lib/test/unit/core.test.js` — Core module unit tests
- `lib/core/tool-runner.js` — Isolated tool runner child process

---

## [2.0.0] - 2026-05-04

### Added — Platform Features

- **Smart Init** — Interactive agent generator with use case, provider, memory, and guardrails selection (`aiyu-multi-agent init`)
- **🔥 Execution Engine** — ReAct loop with tool calling, state management, and 4 LLM providers (`aiyu-multi-agent run`)
- **🔥 `aiyu-multi-agent run`** — Execute agent with input, supports --agent, --provider, --model, --json, --max-steps
- **🔥 `aiyu-multi-agent chat`** — Interactive session mode with continuous context, history, and tool calls
- **Plugin System** — Install/uninstall skills from npm (`aiyu-multi-agent add skill <name>`, `aiyu-multi-agent remove skill <name>`)
- **Permission System** — Skills declare permissions in config.json, user prompted on install, rollback if denied
- **Agent Testing** — Test framework with markdown-based test files (`aiyu-multi-agent test`, `aiyu-multi-agent test --tap`, `aiyu-multi-agent test --watch`)
- **Publish/Install** — Publish agents to npm, others can install via `npx your-agent` (`aiyu-multi-agent publish`)
- **Usage Tracking** — Local usage statistics and deployment history (`aiyu-multi-agent usage`), no external telemetry
- **Hybrid Config** — `.agent/` as universal primary config + `.windsurf/` symlink for Windsurf IDE
- **Node + Bun Dual Runtime** — Runtime detection and support for both environments
- **Built-in Guardrails** — Path traversal protection, atomic safe write, rate limiting, sandboxed command execution
- **Structured Logger** — Debug/info/warn/error/success/fail with color output and configurable log levels
- **Error Boundary** — Top-level `program.parseAsync().catch()` prevents CLI crash
- **🔥 Tool Namespace** — All tools namespaced (`fs.read`, `fs.write`, `fs.edit`, `fs.glob`, `search.grep`, `shell.exec`), legacy aliases supported, namespace enforced on registration
- **🔥 Parser Fallback Chain** — 4-strategy action parsing: structured JSON → TOOL_CALL regex → JSON code blocks → final answer
- **🔥 Validation Layer** — Tool argument schemas with required/optional fields, validated before execution
- **🔥 Step Logging Structure** — Standard step shape: `{ step, thought, action, result, error, duration_ms, toolCalls }`
- **Output Contract** — `outputFormat: json` enforces JSON output, wraps text if needed
- **Deterministic Mode** — `temperature: 0` for stable test results
- **Tool Timeout** — Default 30s per tool call, configurable per tool

### Changed — Architecture Refactor

- **Modular agent-runtime.js** — Split 713-line monolith into 3 focused modules:
  - `lib/core/tool-registry.js` — Tool definitions, schemas, namespace resolution, validation (150 lines)
  - `lib/core/llm-providers.js` — OpenAI, Claude (with tool_use), Ollama (with tools), Mock providers (180 lines)
  - `lib/core/agent-runtime.js` — ReAct loop, chat session, agent loader (440 lines)
- **Unified utils.js** — Deduplicated `parseFrontmatter` (was in 4 files), `copyRecursive` (was in 4 files), `findDefaultAgent` (was in 2 files) → single source in `lib/utils.js`
- **Removed re-exports** — `parseFrontmatter` no longer re-exported from `agent-runtime.js`; import directly from `lib/utils`
- **shell.exec** — Uses `execSync` + `shell: true` to properly handle quoted args (was `execFileSync` + whitespace split which broke `"echo 'hello world'"`)
- **fs.glob / search.grep** — Replaced `find`/`grep` commands with Node.js native implementations for Windows compatibility
- **Chat session** — Full ReAct loop (max 5 steps) instead of single follow-up + 1 response
- **safeWrite** — Added EXDEV fallback: `copyFileSync` + `unlinkSync` when `renameSync` crosses partitions (Linux tmpfs)
- **rateLimits** — Added cleanup: removes expired entries when Map size > 100 (prevents memory leak in long-running sessions)
- **Mock provider** — Simulates tool calls for testing, with proper termination (stops after tool result)
- **LLM retry/backoff** — Exponential backoff (max 3 retries) for transient failures: 429, 503, rate limit, timeout, ECONNRESET
- **config.yaml** — Version updated from 1.0.0 to 2.0.0
- **package.json** — Removed `docs/` from files array (not needed for npm package)

### Fixed

- **Command Injection** — `runChecklist()` now uses `execFileSync` with args array instead of `execSync` with string concatenation
- **Code Duplication** — Deduplicated `updateGitignore()` from `postinstall.js` into `lib/utils.js`
- **Code Duplication** — Deduplicated `parseFrontmatter()` from `cli.js`, `agent-runtime.js`, `runner.js` into `lib/utils.js`
- **Code Duplication** — Deduplicated `copyRecursive()` from `cli.js`, `config.js`, `plugin.js` into `lib/utils.js`
- **Code Duplication** — Deduplicated `findDefaultAgent()` from `run.js`, `chat.js` into `lib/utils.js`
- **Misnamed Variable** — Renamed `overwritten` → `preserved` in `copyRecursive()` (it tracks skipped files, not overwritten ones)
- **Memory Leak** — Added `req.destroy()` in `fetchJSON()` timeout handler to prevent connection leak
- **Memory Leak** — `rateLimits` Map in guardrails.js now cleans up expired entries (was unbounded growth)
- **EXDEV Error** — `safeWrite` now handles cross-partition rename with `copyFileSync` + `unlinkSync` fallback
- **Dead Reference** — Removed `docs/` from `package.json` files array (directory didn't exist)
- **Dead Reference** — Removed `docs/PLAN.md` from `.windsurfrules` (file didn't exist)
- **NaN% Bug** — Fixed `testPassRate` showing `NaN%` when no test results tracked (usage.js)
- **Variable Hoisting** — Fixed `path` used before `require()` in `run.js` `findDefaultAgent()`
- **Assignment to const** — Fixed `run.js` spinner `const` → `let` (was reassigned in onStep callback)
- **shell.exec split** — Fixed whitespace split breaking quoted args (`echo 'hello world'` → `["echo", "'hello", "world'"]`)
- **fs.edit replace** — Changed `replace()` → `replaceAll()` to replace all occurrences, not just the first
- **agentRuns tracking** — `usage.js` now increments `agentRuns` counter on `run` and `chat` commands
- **Agent name validation** — Added `isValidAgentName()` to prevent path traversal chars (`/ \ : * ? " < > |`)
- **init.js useCase reference** — Fixed early reference to `answers.useCase` before prompt completes

### Added — Core Modules

- `lib/core/config.js` — Config loader with `.agent/` primary + `.windsurf/` symlink support
- `lib/core/agent-runtime.js` — 🔥 ReAct loop, chat session, agent loader (imports from tool-registry + llm-providers)
- `lib/core/tool-registry.js` — 🔥 Tool definitions, schemas, namespace resolution, arg validation
- `lib/core/llm-providers.js` — 🔥 OpenAI, Claude (tool_use), Ollama (tools), Mock (simulated tool calls), retry/backoff
- `lib/core/plugin.js` — Plugin lifecycle manager + permission system (install, remove, validate, checkPermissions)
- `lib/core/guardrails.js` — Security layer (pathTraversal, safeWrite, rateLimit, sandboxExec with timeout/cwd/maxBuffer)
- `lib/core/runtime.js` — Node/Bun runtime detection
- `lib/core/logger.js` — Structured logging with levels and chalk colors
- `lib/core/usage.js` — Usage statistics + deployment tracking (local, no telemetry)
- `lib/commands/init.js` — Interactive agent generator using inquirer
- `lib/commands/add.js` — Skill installer from npm with permission check
- `lib/commands/remove.js` — Skill uninstaller
- `lib/commands/run.js` — 🔥 Agent execution entry (aiyu-multi-agent run)
- `lib/commands/chat.js` — 🔥 Interactive chat session (aiyu-multi-agent chat)
- `lib/commands/test.js` — Test runner with --watch and --tap options
- `lib/commands/publish.js` — npm publisher with validation and packaging
- `lib/test/runner.js` — Discovers and runs `.test.md` files
- `lib/test/assertions.js` — Parses test markdown and evaluates assertions
- `lib/test/simulator.js` — Mock tool calls and LLM responses
- `lib/test/reporter.js` — Pretty and TAP format output
- `lib/publish/packager.js` — Bundles agent as standalone npm package
- `lib/publish/validator.js` — Pre-publish validation checks
- `lib/publish/registry.js` — npm publish wrapper

### Added — Templates

- `templates/agent/backend.md` — Backend API agent template
- `templates/agent/automation.md` — Automation/scraping agent template
- `templates/agent/dev-assistant.md` — Dev assistant agent template
- `templates/agent/custom.md` — Custom agent template
- `templates/skill/SKILL.md` — Skill scaffold template
- `templates/skill/config.json` — Skill manifest template
- `.windsurf/tests/framework.test.md` — Framework validation test

### Added — Documentation

- `docs/ARCHITECTURE-V2.md` — V2 architecture document
- `docs/RUNTIME-SPEC.md` — Runtime specification (ReAct loop, tool format, provider config, permission spec)
- `CHANGELOG.md` — This file

### Changed

- **CLI refactor** — Replaced manual switch/case with Commander.js (`bin/cli.js`)
- **CLI binary** — Added `aiyu-multi-agent` as alternative binary name (in addition to `aiyu-multi-agent`)
- **Sandbox enhancement** — `sandboxExec` now has timeout (30s), cwd isolation, maxBuffer (2MB), expanded whitelist (grep, find, head, tail, curl, wget)
- **Plugin permissions** — `plugin.js` now extracts permissions from `config.json`, prompts user on install, rolls back if denied
- **Error boundary** — CLI uses `program.parseAsync().catch()` instead of `program.parse()` to prevent crashes
- **Version** — Bumped from 1.2.2 to 2.0.0
- **Dependencies** — Added commander, inquirer, chalk, ora, yaml, glob
- **README.md** — Complete rewrite for V2 platform features
- **CODEBASE.md** — Updated for V2 architecture
- **.windsurfrules** — Updated for V2 commands and structure
- **package.json** — Updated description, keywords, files array

### Fixed

- **Command Injection** — `runChecklist()` now uses `execFileSync` with args array instead of `execSync` with string concatenation
- **Code Duplication** — Deduplicated `updateGitignore()` from `postinstall.js` into `lib/utils.js`
- **Misnamed Variable** — Renamed `overwritten` → `preserved` in `copyRecursive()` (it tracks skipped files, not overwritten ones)
- **Memory Leak** — Added `req.destroy()` in `fetchJSON()` timeout handler to prevent connection leak
- **Dead Reference** — Removed `docs/` from `package.json` files array (directory didn't exist)
- **Dead Reference** — Removed `docs/PLAN.md` from `.windsurfrules` (file didn't exist)
- **NaN% Bug** — Fixed `testPassRate` showing `NaN%` when no test results tracked (usage.js)
- **Variable Hoisting** — Fixed `path` used before `require()` in `run.js` `findDefaultAgent()`

---

## [1.2.2] - 2026-04-27

### Fixed

- Remove duplicate `updateGitignore` import in `postinstall.js`

---

## [1.2.1] - 2026-04-27

### Fixed

- Security hardening + code quality improvements

---

## [1.2.0] - 2026-04-27

### Added

- CLI improvements + agent migration

---

## [1.1.4] - 2026-04-27

### Changed

- Rename: Antigravity Kit → Sub-Agent Kit

---

## [1.1.3] - 2026-04-27

### Added

- Smart update system — version tracking, npm registry check, `version` command

---

## [1.1.2] - 2026-04-27

### Added

- Agent announcements now show skills, rules, sub-agents

---

## [1.1.1] - 2026-04-27

### Added

- `info` command — show agent skills, sub-agents, rules, workflows

---

## [1.1.0] - 2026-04-27

### Added

- `init`/`update` commands + npx usage docs

---

## [1.0.0] - 2026-04-27

### Added

- Initial release — 79 agents, 46 skills, 78 workflows, 10 rules

---

[2.2.3]: https://github.com/teeprakorn1/aiyu-multi-agent/compare/v2.2.2...v2.2.3
[2.2.2]: https://github.com/teeprakorn1/aiyu-multi-agent/compare/v2.2.1...v2.2.2
[2.2.1]: https://github.com/teeprakorn1/aiyu-multi-agent/compare/v2.2.0...v2.2.1
[2.2.0]: https://github.com/teeprakorn1/aiyu-multi-agent/compare/v2.1.8...v2.2.0
[2.1.8]: https://github.com/teeprakork1/aiyu-multi-agent/compare/v2.1.7...v2.1.8
[2.1.7]: https://github.com/teeprakorn1/aiyu-multi-agent/compare/v2.1.6...v2.1.7
[2.1.6]: https://github.com/teeprakorn1/aiyu-multi-agent/compare/v2.1.5...v2.1.6
[2.1.5]: https://github.com/teeprakorn1/aiyu-multi-agent/compare/v2.1.4...v2.1.5
[2.1.4]: https://github.com/teeprakorn1/aiyu-multi-agent/compare/v2.1.3...v2.1.4
[2.1.3]: https://github.com/teeprakorn1/aiyu-multi-agent/compare/v2.1.2...v2.1.3
[2.1.2]: https://github.com/teeprakorn1/aiyu-multi-agent/compare/v2.1.1...v2.1.2
[2.1.1]: https://github.com/teeprakorn1/aiyu-multi-agent/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/teeprakorn1/aiyu-multi-agent/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/teeprakorn1/aiyu-multi-agent/compare/v1.2.2...v2.0.0
[1.2.2]: https://github.com/teeprakorn1/aiyu-multi-agent/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/teeprakorn1/aiyu-multi-agent/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/teeprakorn1/aiyu-multi-agent/compare/v1.1.4...v1.2.0
[1.1.4]: https://github.com/teeprakorn1/aiyu-multi-agent/compare/v1.1.3...v1.1.4
[1.1.3]: https://github.com/teeprakorn1/aiyu-multi-agent/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/teeprakorn1/aiyu-multi-agent/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/teeprakorn1/aiyu-multi-agent/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/teeprakorn1/aiyu-multi-agent/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/teeprakorn1/aiyu-multi-agent/releases/tag/v1.0.0
