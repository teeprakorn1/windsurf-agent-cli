# CODEBASE.md — Aiyu MultiAgent V2.1

## System Overview

Production-grade AI Agent Platform — Smart Init, Plugin System, Agent Testing, and Publishing.

**V2.1** — Security hardening, command injection fix, path traversal fix, compliance tests, unit tests, observability, caching, streaming output.

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
│   tool-runner.js  — Isolated exec       │
│   config.js    — .agent/ + .windsurf/   │
│   plugin.js    — Skill install/remove   │
│   guardrails.js — Security layer        │
│   usage.js     — Usage tracking         │
│   runtime.js   — Node/Bun detection     │
│   logger.js    — Structured logging      │
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
│   compliance.js, unit/core.test.js      │
└─────────────┬───────────────────────────┘
              ▼
┌─────────────────────────────────────────┐
│   lib/publish/ — Publish System         │
│   packager.js, validator.js,            │
│   registry.js                           │
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
- `lib/core/agent-runtime.js` — 🔥 ReAct loop, chat session (sliding window), agent loader (imports tool-registry + llm-providers directly, no re-exports)
- `lib/core/tool-registry.js` — 🔥 Namespaced tools (fs.read/shell.exec), schemas, validation, parseCommandArgs (escape sequences), cross-platform fs.glob/search.grep (maxDepth, maxFileSize, maxFiles limits)
- `lib/core/llm-providers.js` — 🔥 OpenAI, Claude (tool_use), Ollama (tools), Mock (respects outputFormat), retry/backoff
- `lib/core/tool-runner.js` — Isolated tool runner (forked child process, restricted env)
- `lib/core/config.js` — .agent/ primary, .windsurf/ symlink
- `lib/core/plugin.js` — npm skill install/remove + permission system (writeFileSync for config, no safeWrite)
- `lib/core/guardrails.js` — pathTraversal (projectRoot param + path.normalize), safeWrite (EXDEV fallback), rateLimit (cleanup), sandboxExec (execFileSync, no curl/wget)
- `lib/core/usage.js` — Usage statistics + deployment tracking + agentRuns counter (local)
- `lib/core/runtime.js` — Node/Bun dual
- `lib/core/logger.js` — Structured logging
- `lib/utils.js` — Shared utilities: parseFrontmatter (YAML.parse only, no fallback), copyRecursive (with skipDirs), findDefaultAgent, isValidAgentName, updateGitignore
- `lib/commands/run.js` — 🔥 Agent execution entry (--verbose, --dry-run, --no-cache, streaming output)
- `lib/commands/chat.js` — 🔥 Interactive chat session (sliding window MAX_CONTEXT_MESSAGES=20)
- `lib/commands/init.js` — Interactive agent generator (with agent name validation, utils import)
- `lib/commands/add.js` — Skill installer (with permission check)
- `lib/commands/remove.js` — Skill remover
- `lib/commands/test.js` — Test runner (--compliance, --unit, --watch, --tap)
- `lib/commands/inspect.js` — Observability (stats, tool usage, latency, errors)
- `lib/commands/publish.js` — npm publisher
- `lib/test/compliance.js` — Spec compliance tests (15 checks)
- `lib/test/unit/core.test.js` — Unit tests for guardrails, tool-registry, llm-providers (29 tests)
- `lib/test/` — Test framework (runner, assertions, simulator, reporter)
- `lib/publish/` — Publish system (packager uses utils.copyRecursive, validator, registry)

### Runtime Correctness
- **Tool Namespace**: `fs.read`, `fs.write`, `fs.edit`, `fs.glob`, `search.grep`, `shell.exec` — legacy aliases supported, namespace enforced on registration
- **Parser Fallback**: structured JSON → TOOL_CALL regex → JSON code blocks → final answer
- **Arg Validation**: `TOOL_SCHEMAS` with required/optional fields, validated before execution (both runAgent and chat)
- **Step Logging**: `{ step, thought, action, result, error, duration_ms, toolCalls }`
- **Output Contract**: `outputFormat: json` enforces JSON output (options.outputFormat overrides agentSpec)
- **Deterministic Mode**: `temperature: 0` for stable tests
- **Tool Timeout**: Default 30s per tool call
- **LLM Retry**: Exponential backoff (max 3 retries) for 429, 503, timeout, ECONNRESET
- **Claude Tool Use**: Parses `tool_use` content blocks from Anthropic API
- **Ollama Tools**: Parses `message.tool_calls` from Ollama API
- **Chat ReAct Loop**: Full loop (max 5 steps) with try/catch around callLLM + sliding window (MAX_CONTEXT_MESSAGES=20)
- **Cross-Platform**: fs.glob/search.grep use Node.js native (no grep/find dependency)
- **Safe Write EXDEV**: copyFileSync + unlinkSync fallback for cross-partition
- **Rate Limits Cleanup**: Removes expired entries when Map > 100
- **Agent Name Validation**: Rejects path traversal chars
- **Mock Tool Calls**: Simulates tool use for testing with proper termination, respects outputFormat

### Security (V2.1)
- **Command Injection**: `shell.exec` uses `execFileSync` (no `shell: true`) + `parseCommandArgs` with escape sequences. Blocks `$()`, `` ` ``, `rm -rf`, `mkfs`, `dd if=`, `chmod 777`, `chown root`
- **Path Traversal**: `pathTraversal(filePath, projectRoot)` — explicit root param + `path.normalize()` on both sides. Prevents bypass via double slashes, dot segments
- **Allowed Commands**: `python3, node, git, npm, npx, bun, ls, cat, echo, mkdir, cp, mv, grep, find, head, tail, wc, sort, uniq` — no curl/wget
- **File Limits**: search.grep: maxDepth=10, maxFileSize=1MB, maxFiles=1000. fetchJSON: 1MB response limit
- **parseFrontmatter**: Uses `YAML.parse()` only — no fallback parser that could silently produce wrong results
- **Plugin Config**: Uses `fs.writeFileSync()` instead of `safeWrite()` for config.yaml (avoids symlink issues)
- **Tool Result Truncation**: Results exceeding 100KB are truncated with `_truncated` flag
- **Plugin Isolation**: `executeToolIsolated()` forks child process with restricted permission env vars

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
- **Publish → npm**: bundles .agent/ as standalone npm package (uses utils.copyRecursive)
- **Usage → Local**: .agent/usage.json, no external telemetry
- **Inspect → Usage**: reads usage.json for stats, tool calls, latency, error rate
