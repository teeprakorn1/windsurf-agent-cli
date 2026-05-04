# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
