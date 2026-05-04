# Usage Guide — Aiyu MultiAgent

> Complete guide for using the AI Agent Platform

---

## 🚀 Quick Start

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

## 📋 All Commands

| Command | Description |
|---------|-------------|
| `aiyu-multi-agent init` | Interactive agent generator |
| `aiyu-multi-agent run <input>` | Execute agent with input |
| `aiyu-multi-agent chat` | Interactive chat session |
| `aiyu-multi-agent add skill <name>` | Install skill from npm |
| `aiyu-multi-agent remove skill <name>` | Uninstall skill |
| `aiyu-multi-agent test` | Run agent test suite |
| `aiyu-multi-agent publish` | Publish agent to npm |
| `aiyu-multi-agent status` | Show project statistics |
| `aiyu-multi-agent inspect` | Observability — stats, tool usage, latency, errors |
| `aiyu-multi-agent version` | Show version + check updates |
| `aiyu-multi-agent update` | Update config to latest |
| `aiyu-multi-agent list` | List all slash commands |
| `aiyu-multi-agent info <agent>` | Show agent details |
| `aiyu-multi-agent checklist` | Run master checklist |
| `aiyu-multi-agent uninstall` | Remove config directories |

---

## 🔥 Execution Engine

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

---

## 🤖 LLM Providers

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

### Mock (Testing)

```bash
aiyu-multi-agent run "..." --provider mock
```

Returns canned responses. No API key needed. Perfect for testing and demos.

---

## 🛠️ Built-in Tools

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

## 🔌 Plugin System

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

## 🧪 Agent Testing

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

## 📦 Publishing

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
```

### Install a Published Agent

```bash
npx my-awesome-agent
```

This installs the agent config into the current project.

---

## 📊 Usage Statistics

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

## 🏗️ Smart Init

```bash
aiyu-multi-agent init            # Interactive setup
aiyu-multi-agent init --dry-run  # Preview without writing
```

Interactive prompts:
1. **Use case** — Backend, Automation, Dev Assistant, or Custom
2. **Provider** — OpenAI, Claude, Local, or Mock
3. **Memory** — None, File, or Vector
4. **Guardrails** — Enable/disable security layer

Creates:
- `.agent/` — Universal config directory
- `.windsurf/` — Symlink for Windsurf IDE compatibility
- Agent definition with your selections
- Config files and test directory

---

## 🔒 Security

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

## 🎯 Runtime Correctness

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

## 📁 Config Directory Structure

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

## ⚙️ Environment Variables

| Variable | Purpose | Required For |
|----------|---------|-------------|
| `OPENAI_API_KEY` | OpenAI API access | `--provider openai` |
| `ANTHTHROPIC_API_KEY` | Anthropic API access | `--provider claude` |
| `WINDSURF_LOG_LEVEL` | Log level (debug/info/warn/error) | Optional |
| `WINDSURF_CONFIG_DIR` | Override config directory | Optional |

---

## 🔄 Common Workflows

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

### Debugging

```bash
aiyu-multi-agent status                            # Check project state
aiyu-multi-agent usage                             # See command history
aiyu-multi-agent run "Debug auth" --max-steps 3     # Limit loop
aiyu-multi-agent run "Test output" --json          # Structured output
```
