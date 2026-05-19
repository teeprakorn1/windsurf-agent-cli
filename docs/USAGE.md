# Usage Guide — Aiyu MultiAgent

> Complete guide for using the AI Agent Platform

---

## Quick start

```bash
# Install globally
npm install -g aiyu-multi-agent

# Initialize a project
aiyu-multi-agent init

# Run an agent
aiyu-multi-agent run "Create a REST API with Express"

# Chat interactively
aiyu-multi-agent chat
```

---

## All commands

| Command | Description |
|---------|-------------|
| `aiyu-multi-agent init` | Interactive agent generator |
| `aiyu-multi-agent update` | Update config to latest version |
| `aiyu-multi-agent version` | Show version + check updates |
| `aiyu-multi-agent status` | Show project statistics |
| `aiyu-multi-agent list` | List all slash commands |
| `aiyu-multi-agent info <agent>` | Show agent details: skills, tools, rules |
| `aiyu-multi-agent checklist [url]` | Run master checklist |
| `aiyu-multi-agent uninstall` | Remove config directories |
| `aiyu-multi-agent run <input>` | Execute agent with input |
| `aiyu-multi-agent run-from-file <path>` | Execute agent from markdown with frontmatter |
| `aiyu-multi-agent chat` | Interactive chat session |
| `aiyu-multi-agent dev` | REPL dev mode with verbose logging |
| `aiyu-multi-agent engines` | List CLI engines detected in PATH |
| `aiyu-multi-agent health` | System health check |
| `aiyu-multi-agent traces` | View recent distributed traces |
| `aiyu-multi-agent inspect` | Observability — stats, tool usage, latency, errors |
| `aiyu-multi-agent usage` | Show usage statistics and deployment history |
| `aiyu-multi-agent serve` | Start HTTP API + WebSocket server |
| `aiyu-multi-agent mcp` | Start MCP server (stdio) |
| `aiyu-multi-agent add skill <name>` | Install skill from npm |
| `aiyu-multi-agent remove skill <name>` | Uninstall skill |
| `aiyu-multi-agent test` | Run agent test suite |
| `aiyu-multi-agent test --compliance` | Spec compliance (15 checks) |
| `aiyu-multi-agent test --unit` | Unit tests (41 tests) |
| `aiyu-multi-agent test --production` | Production module tests (25 tests) |
| `aiyu-multi-agent test --integration` | Integration tests (12 tests) |
| `aiyu-multi-agent publish` | Publish agent to npm |
| `aiyu-multi-agent generate <type>` | Generate MCP server / config (experimental) |

---

## WebSocket API

Real-time agent execution with step-by-step streaming — inspired by Claude Design's live canvas.

```javascript
// Connect to WebSocket
const ws = new WebSocket("ws://localhost:3000/ws");

// Run agent with real-time step events
ws.send(JSON.stringify({
  type: "run",
  agentName: "backend-specialist",
  input: "Create a REST API",
  provider: "openai"
}));

// Receive events:
// { type: "step", runId, step, thought, action, result, error, duration_ms }
// { type: "complete", runId, status, output, usage }
// { type: "error", runId, message }

// Create chat session
ws.send(JSON.stringify({ type: "chat.create", agentName: "frontend-specialist" }));
// → { type: "chat.created", sessionId: "chat_xxx" }

// Send message in chat
ws.send(JSON.stringify({ type: "chat.send", sessionId: "chat_xxx", input: "Hello" }));
// → { type: "chat.step", ... } (per step)
// → { type: "chat.complete", sessionId, content, usage }

// Intervene mid-run (inject feedback while agent is running)
ws.send(JSON.stringify({ type: "intervene", runId: "run_xxx", message: "Use dark mode" }));
```

---

## Agent handoff

Chain agents together — Agent A completes, produces a handoff bundle, Agent B receives enriched context.

```bash
# Chain: frontend-specialist designs UI → backend-specialist implements API
curl -X POST http://localhost:3000/handoff \
  -H "Content-Type: application/json" \
  -d '{
    "from_agent": "frontend-specialist",
    "to_agent": "backend-specialist",
    "input": "Design a task dashboard"
  }'
```

**Response:**
```json
{
  "handoffId": "bundle_xxx",
  "from": { "agent": "frontend-specialist", "status": "complete", "steps": 5 },
  "to": { "agent": "backend-specialist", "status": "complete", "output": "..." },
  "artifacts": 3,
  "pendingTasks": 0
}
```

**Retrieve bundle:**
```bash
curl http://localhost:3000/handoff/bundle_xxx
```

---

## Inline intervention

Inject feedback mid-run to redirect an agent without restarting.

```bash
# Via HTTP API
curl -X POST http://localhost:3000/agents/intervene \
  -H "Content-Type: application/json" \
  -d '{"run_id": "run_xxx", "message": "Use TypeScript instead of JavaScript"}'
```

```javascript
// Via WebSocket
ws.send(JSON.stringify({
  type: "intervene",
  runId: "run_xxx",
  message: "Use TypeScript instead of JavaScript"
}));
// → { type: "intervene.ack", runId }
```

---

## Execution Engine

### `aiyu-multi-agent run`

Execute an agent with a single input. The core of the platform.

```bash
# Basic usage
aiyu-multi-agent run "Create a REST API with Express"

# Specify agent
aiyu-multi-agent run "Fix the login bug" --agent backend-specialist

# Use real LLM
OPENAI_API_KEY=sk-... aiyu-multi-agent run "Refactor auth module" --provider openai
ANTHROPIC_API_KEY=sk-ant-... aiyu-multi-agent run "Add tests" --provider claude

# Use local LLM (Ollama)
ollama serve
aiyu-multi-agent run "Explain this code" --provider local --model llama3

# JSON output (for CI/CD pipelines)
aiyu-multi-agent run "Analyze codebase" --json

# Limit steps
aiyu-multi-agent run "Quick fix" --max-steps 3

# Mock provider (testing/demo)
aiyu-multi-agent run "Hello world" --provider mock
```

**Options:**

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--agent <name>` | `-a` | Agent to run | First found |
| `--provider <p>` | `-p` | LLM provider | `mock` |
| `--model <m>` | `-m` | LLM model name | `gpt-4` |
| `--max-steps <n>` | | Max ReAct loop steps | `10` |
| `--json` | | Output as JSON | `false` |
| `--verbose` | | Show step-by-step thinking | `false` |
| `--dry-run` | | Preview without running | `false` |
| `--no-cache` | | Skip cache, always re-run | `false` |
| `--output-format <fmt>` | | Output format: text, json, artifact | `text` |
| `--no-form` | | Skip question-form guardrail on first turn | `false` |
| `--no-quality-gate` | | Skip anti-slop quality gate | `false` |
| `--strict-quality-gate` | | Fail on quality violations | `false` |
| `--write-artifacts <dir>` | | Write parsed artifacts to directory | — |

### `aiyu-multi-agent chat`

Interactive session with continuous context. Like ChatGPT in your terminal.

```bash
# Start chat
aiyu-multi-agent chat

# With specific agent
aiyu-multi-agent chat --agent backend-specialist

# With real LLM
aiyu-multi-agent chat --provider openai --model gpt-4o
```

**In-session commands:**

| Command | Description |
|---------|-------------|
| `exit` / `quit` | End session |
| `history` | Show chat history |
| `help` | Show available commands |

**Options:**

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--agent <name>` | `-a` | Agent to chat with | First found |
| `--provider <p>` | `-p` | LLM provider | `mock` |
| `--model <m>` | `-m` | LLM model name | `gpt-4` |
| `--output-format <fmt>` | | Output format: text, json, artifact | `text` |
| `--no-form` | | Skip question-form guardrail on first turn | `false` |
| `--no-quality-gate` | | Skip anti-slop quality gate | `false` |
| `--strict-quality-gate` | | Fail on quality violations | `false` |

### `aiyu-multi-agent run-from-file <path>`

Execute an agent from a markdown file with frontmatter. Useful for repeatable tasks and CI/CD pipelines.

```bash
# Run from markdown file
aiyu-multi-agent run-from-file task.md

# Override provider
aiyu-multi-agent run-from-file task.md --provider openai

# JSON output
aiyu-multi-agent run-from-file task.md --json
```

**Frontmatter format:**

```markdown
---
agent: backend-specialist
provider: openai
model: gpt-4o
maxSteps: 15
---

Create a REST API with Express and PostgreSQL for a todo app.
Include authentication with JWT tokens.
```

**Options:**

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--agent <name>` | `-a` | Override agent (default: from frontmatter) | Frontmatter |
| `--provider <p>` | `-p` | Override provider | Frontmatter |
| `--model <m>` | `-m` | Override model | Frontmatter |
| `--max-steps <n>` | | Override max ReAct loop steps | Frontmatter |
| `--json` | | Output as JSON | `false` |
| `--verbose` | | Show step-by-step thinking | `false` |
| `--dry-run` | | Preview without running | `false` |
| `--no-cache` | | Skip cache, always re-run | `false` |
| `--output-format <fmt>` | | Output format: text, json, artifact | `text` |
| `--no-form` | | Skip question-form guardrail | `false` |
| `--no-quality-gate` | | Skip anti-slop quality gate | `false` |
| `--strict-quality-gate` | | Fail on quality violations | `false` |
| `--write-artifacts <dir>` | | Write parsed artifacts to directory | — |

### `aiyu-multi-agent dev`

REPL dev mode with verbose logging. Shows every tool call, LLM response, and internal state.

```bash
aiyu-multi-agent dev
```

### `aiyu-multi-agent update`

Update config to latest version. Preserves user-modified files.

```bash
aiyu-multi-agent update
aiyu-multi-agent update --dry-run    # Preview without writing
```

### `aiyu-multi-agent inspect`

Observability dashboard — agent stats, tool usage, latency, errors.

```bash
aiyu-multi-agent inspect
aiyu-multi-agent inspect --agent backend-specialist
```

---

## LLM providers

### OpenAI

```bash
export OPENAI_API_KEY=sk-...
aiyu-multi-agent run "..." --provider openai
aiyu-multi-agent run "..." --provider openai --model gpt-4o
aiyu-multi-agent run "..." --provider openai --model gpt-3.5-turbo
```

### Claude (Anthropic)

```bash
export ANTHROPIC_API_KEY=sk-ant-...
aiyu-multi-agent run "..." --provider claude
aiyu-multi-agent run "..." --provider claude --model claude-sonnet-4-20250514
```

### Local (Ollama)

```bash
# Start Ollama first
ollama serve

# Pull a model
ollama pull llama3

# Run
aiyu-multi-agent run "..." --provider local --model llama3
aiyu-multi-agent run "..." --provider local --model mistral
aiyu-multi-agent run "..." --provider local --model codellama
```

### Groq

```bash
export GROQ_API_KEY=gsk_...
aiyu-multi-agent run "..." --provider groq
aiyu-multi-agent run "..." --provider groq --model llama-3.3-70b-versatile
aiyu-multi-agent run "..." --provider groq --model mixtral-8x7b-32768
```

OpenAI-compatible API at `api.groq.com`. Free tier: 14,400 req/day at console.groq.com. Default model: `llama-3.3-70b-versatile`, configurable via `GROQ_MODEL`.

### Mock (Testing / Default)

```bash
aiyu-multi-agent run "..." --provider mock
```

Returns canned responses. Mock is the default provider when no API keys are configured. No env var required. Perfect for testing and demos.

### CLI engines

Use AI CLIs installed in `$PATH` as LLM providers. Auto-detected by the `engines` command.

```bash
# List detected CLI engines
aiyu-multi-agent engines
aiyu-multi-agent engines --json

# Use a CLI engine as provider
aiyu-multi-agent run "..." --provider cli:claude
aiyu-multi-agent run "..." --provider cli:codex
```

Spawn safety: `shell: false`, 120s timeout, 1MB output cap, limited env passthrough.

---

## Built-in tools

All tools use **namespace.name** format. Legacy names are auto-aliased.

| Namespaced Name | Legacy Alias | Required Args | Description |
|----------------|-------------|---------------|-------------|
| `fs.read` | `Read` | `path` | Read file contents |
| `fs.write` | `Write` | `path`, `content` | Write file (atomic) |
| `fs.edit` | `Edit` | `path`, `old_string`, `new_string` | Find & replace |
| `fs.glob` | `Glob` | `pattern` | Find files by name |
| `search.grep` | `Grep` | `pattern` | Search file contents |
| `shell.exec` | `Bash` | `command` | Execute allowed commands |

**Arg Validation:** Required args are checked before execution. Missing args return an error.

**Tool Timeout:** Default 30 seconds per tool call. Configurable via `timeout` arg on `shell.exec`.

**Allowed Shell Commands:** `ls`, `cat`, `echo`, `pwd`, `mkdir`, `git`, `node`, `npm`, `npx`, `python3`, `grep`, `find`, `head`, `tail`, `curl`, `wget`

### Custom Tools

Register custom tools with namespace enforcement:

```javascript
const { registerTool } = require("aiyu-multi-agent/lib/core/agent-runtime");

registerTool("db.query", async (args) => {
  // args validated: { sql: required, params: optional }
  const result = await db.query(args.sql, args.params);
  return { rows: result.rows, count: result.rowCount };
});
```

> Custom tool names **must** contain a `.` (e.g., `db.query`). Non-namespaced names are rejected.

---

## Plugin system

### Install a Skill

```bash
# Install from npm
aiyu-multi-agent add skill clean-code

# Auto-approve permissions (CI/CD)
aiyu-multi-agent add skill clean-code --auto-approve
```

If the skill requires permissions, you'll be prompted:

```
⚠️ Skill requires: filesystem access, network access
Allow? (y/N)
```

Denying permissions rolls back the installation.

### Remove a Skill

```bash
aiyu-multi-agent remove skill clean-code
```

### Skill Package Convention

Skills on npm follow the naming pattern: `aiyu-multi-agent-skill-<name>`

```bash
# These are equivalent
aiyu-multi-agent add skill clean-code
aiyu-multi-agent add skill aiyu-multi-agent-skill-clean-code
```

### Skill config.json

```json
{
  "name": "my-skill",
  "version": "1.0.0",
  "description": "What this skill provides",
  "permissions": {
    "fs": true,
    "network": false,
    "exec": false,
    "env": false
  }
}
```

| Permission | Scope | Default |
|-----------|-------|---------|
| `fs` | File system read/write | Ask on install |
| `network` | HTTP requests | Deny by default |
| `exec` | Shell command execution | Deny by default |
| `env` | Environment variable access | Deny by default |

---

## Agent testing

### Write a Test

Create `.agent/tests/*.test.md` files:

```markdown
---
agent: backend-specialist
provider: mock
---

# Backend Agent Test

## Test: API Generation

**prompt:** Create a REST API with Express

**assertions:**
- output contains "express"
- output contains "router"
- status equals "complete"
```

### Run Tests

```bash
# Run all tests
aiyu-multi-agent test

# TAP format (CI/CD)
aiyu-multi-agent test --tap

# Watch mode
aiyu-multi-agent test --watch
```

### Assertion Types

| Assertion | Example |
|-----------|---------|
| `output contains <text>` | `output contains "express"` |
| `output not contains <text>` | `output not contains "error"` |
| `status equals <value>` | `status equals "complete"` |
| `steps less than <n>` | `steps less than 5` |

---

## Publishing

### Publish Your Agent

```bash
# Validate + publish
aiyu-multi-agent publish

# Dry run (validate only)
aiyu-multi-agent publish --dry-run

# Override package name
aiyu-multi-agent publish --name my-awesome-agent

# Override version
aiyu-multi-agent publish --version 1.0.0

# Set author
aiyu-multi-agent publish --author "Your Name"

# npm access level
aiyu-multi-agent publish --access public

# Block publish if leaked secrets detected
aiyu-multi-agent publish --strict

# npm dist-tag
aiyu-multi-agent publish --tag next

# Set license
aiyu-multi-agent publish --license MIT
```

**Publish options:**

| Flag | Description | Default |
|------|-------------|---------|
| `--dry-run` | Validate and package without publishing | `false` |
| `--strict` | Block publish if leaked secrets detected | `false` |
| `--name <name>` | Override package name | From `package.json` |
| `--version <version>` | Override version | From `package.json` |
| `--author <author>` | Set author | From `package.json` |
| `--license <license>` | Set license | `MIT` |
| `--access <level>` | npm access level (public/restricted) | `public` |
| `--tag <tag>` | npm dist-tag | `latest` |

### Install a Published Agent

```bash
npx my-awesome-agent
```

This installs the agent config into the current project.

---

## Usage statistics

```bash
aiyu-multi-agent usage
```

Shows:
- Days active
- Last used timestamp
- Total commands run
- Top 5 commands
- Skills installed
- Test runs + pass rate
- Deployment history (last 5)

All data stored locally in `.agent/usage.json`. **No external telemetry.**

---

## Smart init

```bash
aiyu-multi-agent init            # Interactive setup
aiyu-multi-agent init --dry-run  # Preview without writing
aiyu-multi-agent init --windsurf-only   # Create .windsurf/ only (no .agent/)
aiyu-multi-agent init --agent-only     # Create .agent/ only (no .windsurf/ symlink)
aiyu-multi-agent init --cursor-only   # Generate .cursor/ only (Cursor IDE)
aiyu-multi-agent init --cursor        # Generate .windsurf/ + .cursor/ together
aiyu-multi-agent init --roo-only      # Generate Roo Code files only (.roomodes, .roorules, .roo/)
aiyu-multi-agent init --no-roo        # Skip Roo Code file generation
aiyu-multi-agent init --cursor-only --force  # Re-sync .cursor/ after .windsurf/ changes
```

Interactive prompts:
1. **Use case** — Backend, Automation, Dev Assistant, or Custom
2. **Provider** — OpenAI, Claude, Local, or Mock
3. **Memory** — None, File, or Vector
4. **Guardrails** — Enable/disable security layer

**Init flags:**

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview without writing files |
| `--windsurf-only` | Create `.windsurf/` only (no `.agent/` directory) |
| `--agent-only` | Create `.agent/` only (no `.windsurf/` symlink) |
| `--cursor-only` | Generate `.cursor/` only (Cursor IDE rules + commands) |
| `--cursor` | Also generate `.cursor/` alongside `.windsurf/` / `.agent/` |
| `--roo-only` | Generate Roo Code files only (`.roomodes`, `.roorules`, `.roo/`) |
| `--no-roo` | Skip Roo Code file generation |
| `--force` | Overwrite existing config directories |

Creates:
- `.agent/` — Universal config directory
- `.windsurf/` — Symlink for Windsurf IDE compatibility
- `.cursor/` — Cursor IDE rules and slash commands (with `--cursor` or `--cursor-only`)
- `.roomodes` — Roo Code custom modes (84 agents)
- `.roorules` — Roo Code rules
- `.roo/` — Roo Code system prompts
- Agent definition with your selections
- Config files and test directory

---

## Cursor IDE support

First-class Cursor IDE integration via auto-generated `.cursor/rules/*.mdc` and `.cursor/commands/*.md`.

```bash
# Generate Cursor config from existing .windsurf/
aiyu-multi-agent init --cursor-only

# Generate both Windsurf and Cursor configs
aiyu-multi-agent init --cursor

# Force re-sync after .windsurf/ changes
aiyu-multi-agent init --cursor-only --force
```

**Generated structure:**

| Directory | Contents | Count |
|-----------|----------|-------|
| `.cursor/rules/agents/` | Agent rules (Agent-Requested `.mdc`) | 84 |
| `.cursor/rules/skills/` | Skill rules (Agent-Requested `.mdc`) | 45 |
| `.cursor/rules/domain/` | Domain rules (Auto-Attached `.mdc`) | 9 |
| `.cursor/commands/` | Slash commands (`.md`) | 78 |
| `.cursor/mcp.json` | MCP server config | 1 |
| `.cursor/rules/00-project-overview.mdc` | Always-applied overview | 1 |

**Rule types:**
- **Agent-Requested** — AI decides when to apply based on context (`@orchestrator`, `@backend-specialist`)
- **Auto-Attached** — Automatically applied when matching file globs (e.g., `*.ts`, `**/api/**`)
- **Always** — Applied in every conversation (project overview, GEMINI protocol)

Coexists with Windsurf — both `.windsurf/` and `.cursor/` can live in the same project.

Full guide: [`docs/CURSOR-IDE.md`](CURSOR-IDE.md)

---

## Roo Code support

First-class Roo Code (VS Code extension) integration via auto-generated `.roomodes`, `.roorules`, and `.roo/`.

```bash
# Generate Roo Code files from existing .agent/
aiyu-multi-agent init --roo-only

# Skip Roo generation during regular init
aiyu-multi-agent init --no-roo

# Re-generate after .agent/ updates
aiyu-multi-agent init --roo-only --force
```

**Generated files:**
- `.roomodes` — 84 custom modes (one per agent) for Roo Code mode selector
- `.roorules` — Project rules mirroring `.windsurfrules`
- `.roo/` — System prompts per agent

Source: `lib/core/roo-generator.js`

---

## Security

### Guardrails (Always Active)

- **Path Traversal Protection** — All file operations restricted to project root
- **Atomic Safe Write** — Files written to temp then renamed (no partial writes)
- **Rate Limiting** — 60 operations per minute per key
- **Sandbox Exec** — Only whitelisted commands allowed, with timeout and maxBuffer

### Permission System (On Skill Install)

- Skills declare required permissions in `config.json`
- User prompted before granting access
- Installation rolled back if denied
- `--auto-approve` flag for CI/CD

---

## Runtime correctness

### Parser Fallback Chain

When an LLM returns a response, the runtime tries 4 strategies to parse tool calls:

1. **Structured JSON** — OpenAI-style `tool_calls` array
2. **TOOL_CALL regex** — `TOOL_CALL: fs.read({"path": "/src"})` format
3. **JSON code blocks** — ` ```json { "tool": "fs.read" }``` ` format
4. **Final answer** — No tool calls found, treat as output

### Step Logging

Every step in the ReAct loop produces a standard record:

```json
{
  "step": 1,
  "thought": "I need to read the file first...",
  "action": { "name": "fs.read", "args": { "path": "/src/index.js" } },
  "result": { "content": "...", "lines": 42 },
  "error": null,
  "duration_ms": 120,
  "toolCalls": [...]
}
```

### Deterministic Mode

For stable test results:

```yaml
# In agent frontmatter
deterministic: true
```

Sets `temperature: 0` — eliminates randomness in LLM responses.

### Output Contract

```yaml
# In agent frontmatter
output:
  format: json
```

Enforces JSON output. If the LLM returns plain text, it's wrapped: `{"text": "..."}`

### LLM Retry/Backoff

All LLM providers automatically retry on transient failures:

- **Retryable errors**: 429 (rate limit), 503 (overloaded), timeout, ECONNRESET, ETIMEDOUT
- **Strategy**: Exponential backoff — 1s → 2s → 4s (max 10s), up to 3 retries
- **Configurable**: `callLLM(messages, { maxRetries: 5 })` for custom retry count

### Claude & Ollama Tool Use

- **Claude**: Parses `tool_use` content blocks from Anthropic API — returns structured `toolCalls` array
- **Ollama**: Parses `message.tool_calls` from Ollama API — supports models with tool capabilities
- Both integrate with the parser fallback chain — tool calls work regardless of provider

### Chat Session ReAct Loop

Chat sessions (`aiyu-multi-agent chat`) now run a full ReAct loop (max 5 steps per message), not just a single follow-up. If the LLM requests a tool, the result is fed back and the loop continues until a final answer is reached.

### Cross-Platform Tools

`fs.glob` and `search.grep` use Node.js native implementations — no dependency on `grep` or `find` commands. Works on Windows, macOS, and Linux.

### Safe Write EXDEV Fallback

Atomic file writes (`guardrails.safeWrite`) now handle cross-partition renames. On Linux where `/tmp` is a separate tmpfs mount, `renameSync` would fail with `EXDEV`. The fallback uses `copyFileSync` + `unlinkSync`.

### Agent Name Validation

Agent names are validated to prevent path traversal attacks. Characters not allowed: `/ \ : * ? " < > |`

---

## Config directory structure

```
.agent/                          # Universal config (primary)
├── agents/                      # AI Agent definitions
│   └── backend-specialist.md
├── skills/
│   ├── core/                    # Built-in skills
│   └── installed/               # npm-installed skills
├── tests/                       # Test files (*.test.md)
├── config.yaml                  # Project configuration
└── usage.json                   # Usage statistics

.windsurf/                       # Symlink → .agent/ (IDE compatibility)
```

---

## Environment variables

| Variable | Purpose | Required For |
|----------|---------|-------------|
| `OPENAI_API_KEY` | OpenAI API access | `--provider openai` |
| `ANTHROPIC_API_KEY` | Anthropic API access | `--provider claude` |
| `GROQ_API_KEY` | Groq API access | `--provider groq` |
| `GROQ_MODEL` | Override default Groq model | `--provider groq` (optional) |
| `AIYU_ENABLE_MOCK` | (Legacy, no longer required) | `--provider mock` |
| `AIYU_API_KEY` | API server auth key | `serve` command |
| `AIYU_CORS_ORIGIN` | CORS origin for API server | `serve` command |
| `AIYU_TRUST_PROXY` | Trust X-Forwarded-For header | Reverse proxy |
| `OLLAMA_HOST` | Ollama server URL | `--provider local` |
| `AIYU_LOG_LEVEL` | Log level (debug/info/warn/error) | Optional |
| `AIYU_CONFIG_DIR` | Override config directory | Optional |

---

## Common workflows

### Development

```bash
aiyu-multi-agent init                              # Setup project
aiyu-multi-agent run "Create Express API" --provider mock  # Quick test
aiyu-multi-agent add skill clean-code              # Add coding standards
aiyu-multi-agent test                              # Run tests
aiyu-multi-agent run "Refactor routes" --provider openai    # Real run
```

### CI/CD Pipeline

```bash
aiyu-multi-agent run "Validate API spec" --json --provider mock
aiyu-multi-agent test --tap
aiyu-multi-agent publish --dry-run
```

### Publishing & Sharing

```bash
aiyu-multi-agent publish --dry-run                 # Validate first
aiyu-multi-agent publish --access public           # Publish to npm
# Others can now: npx your-agent-name
```

### Cursor IDE Setup

```bash
aiyu-multi-agent init --cursor-only                # Generate .cursor/ from .windsurf/
aiyu-multi-agent init --cursor                     # Generate both Windsurf + Cursor
aiyu-multi-agent init --cursor-only --force        # Re-sync after changes
```

### Debugging

```bash
aiyu-multi-agent status                            # Check project state
aiyu-multi-agent usage                             # See command history
aiyu-multi-agent health                            # System health check
aiyu-multi-agent traces                            # View recent traces
aiyu-multi-agent traces --id <traceId>             # Specific trace details
aiyu-multi-agent traces --metrics                  # Trace metrics summary
aiyu-multi-agent run "Debug auth" --max-steps 3     # Limit loop
aiyu-multi-agent run "Test output" --json          # Structured output
aiyu-multi-agent run "Generate API" --output-format artifact --write-artifacts ./out
```
