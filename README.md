# Aiyu MultiAgent — AI Agent Platform

> Production-grade AI Agent Platform with Smart Init, Plugin System, Agent Testing, and Publishing — 83 Agents, 46 Skills, 78 Workflows, 10 Rules
>
> **v2.2.3** — Production upgrade + 20 bug fixes + init mode flags

---

## ✨ Features

### Platform Features (V2)
- **Smart Init** — Quick setup with smart defaults (`--interactive` for full prompts)
- **🔥 Execution Engine** — ReAct loop, tool calling, 4 LLM providers (OpenAI, Claude, Ollama, mock)
- **🔥 `aiyu-multi-agent run`** — Execute agent with input, JSON output for CI/CD
- **🔥 `aiyu-multi-agent chat`** — Interactive session mode, continuous context
- **Plugin System** — `aiyu-multi-agent add skill X` installs from npm with permission checks
- **Agent Testing** — `aiyu-multi-agent test` runs prompt/output assertions
- **Publish/Install** — `aiyu-multi-agent publish` → others can `npx your-agent`
- **Hybrid Config** — `.agent/` universal + `.windsurf/` symlink for Windsurf IDE
- **Node + Bun** — Dual runtime support
- **Built-in Guardrails** — Path traversal protection, safe write, rate limit, sandbox exec
- **Permission System** — Skills declare permissions, user approves on install
- **Usage Tracking** — Local statistics, deployment history, no external telemetry

### Production Features (V2.2)
- **Circuit Breaker** — Prevents cascade failures when LLM providers are down
- **Request Queue** — Concurrency control, priority ordering, backpressure
- **Distributed Tracing** — Trace every agent run, OpenTelemetry export
- **Health Check** — `aiyu-multi-agent health` system status
- **Prometheus Metrics** — `aiyu-multi-agent usage` gauge format export
- **Structured Logging** — JSON log output via `LOG_FORMAT=json`

### Agent Framework
- **80 Specialized AI Agents** — From frontend to IoT, security to mechatronics
- **46 Skills** — Modular capabilities loaded on-demand per agent
- **78 Slash Commands** — Activate agents instantly with `/command`
- **10 Rules** — Auto-triggered guidelines for security, performance, testing, and more
- **Agent Auto-Routing** — The system automatically selects the right agent for your request
- **Multi-Agent Orchestration** — Coordinate 2-7+ agents for complex tasks

---

## 🚀 Quick Start

### Option A: Interactive Init (Recommended)

```bash
# 1. Go to your project
cd your-project

# 2. Initialize (one command, no prompts!)
npx aiyu-multi-agent init

# Or use interactive mode for full setup:
# npx aiyu-multi-agent init --interactive

# 3. Open in Windsurf IDE
aiyu-multi-agent .
```

### Option B: Clone This Repo

```bash
git clone https://github.com/teeprakorn1/aiyu-multi-agent.git
cd aiyu-multi-agent
aiyu-multi-agent .
```

### Start Using Commands

Type any slash command in the Windsurf chat panel:

```
/create Build a task management app
/backend Design REST API with PostgreSQL
/security Audit my codebase for vulnerabilities
```

---

## 📋 CLI Commands

### Core Commands

```bash
aiyu-multi-agent init                        # Quick setup (smart defaults, no prompts)
aiyu-multi-agent init --interactive          # Full interactive setup
aiyu-multi-agent init --dry-run              # Preview without writing files
aiyu-multi-agent init --windsurf-only        # Create .windsurf/ only (no .agent/)
aiyu-multi-agent init --agent-only           # Create .agent/ only (no .windsurf/ symlink)
aiyu-multi-agent update                      # Update config to latest version
aiyu-multi-agent update --dry-run            # Preview update
aiyu-multi-agent version                     # Show version + check for updates
aiyu-multi-agent status                      # Show project statistics
aiyu-multi-agent list                        # List all available slash commands
aiyu-multi-agent info <agent>                # Show agent details
aiyu-multi-agent checklist                   # Run master checklist
aiyu-multi-agent checklist http://localhost:3000  # Checklist with performance + E2E
aiyu-multi-agent inspect                     # Observability — stats, tool usage, latency, errors
aiyu-multi-agent uninstall                   # Remove config directories
```

### Plugin System

```bash
aiyu-multi-agent add skill <name>            # Install skill from npm
aiyu-multi-agent remove skill <name>         # Uninstall skill
```

Skill packages follow the naming convention: `aiyu-multi-agent-skill-<name>` on npm.

### Agent Testing

```bash
aiyu-multi-agent test                        # Run agent test suite
aiyu-multi-agent test --watch                # Watch mode (auto re-run)
aiyu-multi-agent test --tap                  # TAP format output
aiyu-multi-agent test --compliance           # Spec compliance tests (15 checks)
aiyu-multi-agent test --unit                 # Core module unit tests (29 tests)
```

Test files are markdown: `.agent/tests/*.test.md`

### Publishing

```bash
aiyu-multi-agent publish                     # Publish agent to npm
aiyu-multi-agent publish --dry-run           # Validate + package without publishing
aiyu-multi-agent publish --name my-agent     # Override package name
aiyu-multi-agent publish --access public     # npm access level
```

Published agents can be installed by anyone:
```bash
npx your-agent-name                  # Installs agent config into project
```

### Execution Engine

```bash
aiyu-multi-agent run "Create REST API"       # Run agent with input (core engine)
aiyu-multi-agent run "Fix bug" --agent backend-specialist  # Specify agent
aiyu-multi-agent run "..." --provider openai # Use OpenAI (needs OPENAI_API_KEY)
aiyu-multi-agent run "..." --provider claude # Use Claude (needs ANTHROPIC_API_KEY)
aiyu-multi-agent run "..." --provider local  # Use Ollama (local LLM)
aiyu-multi-agent run "..." --provider mock   # Mock responses (testing)
aiyu-multi-agent run "..." --json            # JSON output (CI/CD)
aiyu-multi-agent run "..." --max-steps 20    # Override max ReAct steps
aiyu-multi-agent run "..." --verbose          # Streaming step-by-step output
aiyu-multi-agent run "..." --dry-run          # Preview without executing
aiyu-multi-agent run "..." --no-cache         # Skip cache, fresh execution

aiyu-multi-agent chat                        # Interactive chat session
aiyu-multi-agent chat --agent backend-specialist  # Chat with specific agent
aiyu-multi-agent chat --provider openai      # Chat with real LLM
```

**LLM Providers:**

| Provider | Env Var | Models |
|----------|---------|--------|
| `openai` | `OPENAI_API_KEY` | gpt-4, gpt-4o, gpt-3.5-turbo |
| `claude` | `ANTHROPIC_API_KEY` | claude-3-5-sonnet-20241022, claude-3-5-haiku-20241022 |
| `local` | (none — needs Ollama) | llama3, mistral, codellama |
| `mock` | (none) | Returns canned responses for testing |

**Built-in Tools (Namespaced):**

| Namespace | Tool | Required Args |
|-----------|------|---------------|
| `fs.read` | Read file | `path` |
| `fs.write` | Write file | `path`, `content` |
| `fs.edit` | Find & replace | `path`, `old_string`, `new_string` |
| `fs.glob` | Find files | `pattern` |
| `search.grep` | Search content | `pattern` |
| `shell.exec` | Run command | `command` |

Legacy names (`Read`, `Write`, `Edit`, `Grep`, `Glob`, `Bash`) auto-alias to namespaced versions. Custom tools must use namespace format (e.g., `custom.tool`).

**Runtime Correctness:**

- **Parser Fallback Chain** — 4 strategies: structured JSON → TOOL_CALL regex → JSON code blocks → final answer
- **Arg Validation** — Required args checked before tool execution, missing args return error
- **Step Logging** — Standard shape: `{ step, thought, action, result, error, duration_ms }`
- **Output Contract** — `outputFormat: json` enforces JSON output
- **Deterministic Mode** — `temperature: 0` for stable test results
- **Tool Timeout** — Default 30s per tool call
- **LLM Retry/Backoff** — Exponential backoff (max 3 retries) for 429, 503, timeout errors
- **Claude/Ollama Tool Use** — `callClaude` parses `tool_use` blocks; `callOllama` parses `tool_calls` response
- **Chat ReAct Loop** — Chat sessions run full ReAct loop (max 5 steps), not just single follow-up
- **Cross-Platform Tools** — `fs.glob` and `search.grep` use Node.js native (no grep/find dependency — works on Windows)
- **Safe Write EXDEV** — Atomic write handles cross-partition rename with copy+unlink fallback
- **Agent Name Validation** — Rejects path traversal chars (`/ \ : * ? " < > |`)

### Permission System

Skills declare required permissions in `config.json`:
```json
{ "permissions": { "fs": true, "network": true, "exec": false } }
```

When installing a skill that requires permissions:
```
⚠️ Skill requires: filesystem access, network access
Allow? (y/N)
```

```bash
aiyu-multi-agent add skill my-skill           # Prompts for permissions
aiyu-multi-agent add skill my-skill --auto-approve  # Auto-approve all
```

---

## 📁 Project Structure

### V2 Hybrid Config

```
.agent/                          # Universal config (primary)
├── agents/                      # AI Agents
├── skills/
│   ├── core/                    # Built-in skills
│   └── installed/               # npm-installed skills
├── workflows/                   # Slash command workflows
├── rules/                       # Auto-triggered rules
├── tests/                       # Agent test files (*.test.md)
├── scripts/                     # Verification scripts
└── config.yaml                  # Agent configuration

.windsurf/                       # Symlink → .agent/ (if Windsurf IDE detected)
```

### Package Structure

```
aiyu-multi-agent/
├── bin/
│   ├── cli.js                   # CLI entry (Commander.js)
│   └── postinstall.js           # Post-install script
├── lib/
│   ├── utils.js                 # Shared utilities
│   ├── core/
│   │   ├── config.js            # Config loader (.agent/ + .windsurf/ symlink)
│   │   ├── agent-runtime.js     # 🔥 ReAct loop + tool calling (imports llm-providers, tool-registry)
│   │   ├── tool-registry.js     # 🔥 Namespaced tools, schemas, arg validation, parseCommandArgs
│   │   ├── llm-providers.js     # 🔥 OpenAI, Claude, Ollama, Mock + retry/backoff
│   │   ├── tool-runner.js       # Isolated tool runner (child process)
│   │   ├── plugin.js            # Plugin lifecycle + permission system
│   │   ├── guardrails.js        # Security & safety layer (pathTraversal, safeWrite, rateLimit, sandboxExec)
│   │   ├── runtime.js           # Node/Bun detection
│   │   ├── logger.js            # Structured logging
│   │   └── usage.js             # Usage statistics + deployment tracking
│   ├── commands/
│   │   ├── init.js              # Smart Init (interactive)
│   │   ├── add.js               # aiyu-multi-agent add skill (with permission check)
│   │   ├── remove.js            # aiyu-multi-agent remove skill
│   │   ├── run.js               # 🔥 aiyu-multi-agent run (--verbose, --dry-run, --no-cache)
│   │   ├── chat.js              # 🔥 aiyu-multi-agent chat (sliding window context)
│   │   ├── test.js              # aiyu-multi-agent test (--compliance, --unit, --watch, --tap)
│   │   ├── inspect.js           # aiyu-multi-agent inspect (observability)
│   │   └── publish.js           # aiyu-multi-agent publish
│   ├── test/
│   │   ├── runner.js            # Test runner
│   │   ├── assertions.js        # Assertion parser + evaluator
│   │   ├── simulator.js         # Tool call + LLM simulator
│   │   ├── reporter.js          # Pretty + TAP output
│   │   ├── compliance.js        # Spec compliance tests (15 checks)
│   │   └── unit/
│   │       └── core.test.js     # Unit tests for guardrails, tool-registry, llm-providers (29 tests)
│   └── publish/
│       ├── packager.js          # Bundle agent for npm
│       ├── validator.js         # Pre-publish validation
│       └── registry.js          # npm publish wrapper
├── templates/
│   ├── agent/                   # Agent templates (backend, automation, etc.)
│   └── skill/                   # Skill scaffold template
├── docs/
│   └── ARCHITECTURE-V2.md       # Architecture document
└── .windsurf/                   # 80 Agents, 46 Skills, 78 Workflows, 10 Rules
```

---

## 🎯 How to Use

### Method 1: Slash Commands (Recommended)

Type `/` followed by the command name in the Windsurf chat:

| Category | Commands |
|----------|----------|
| **Core** | `/create`, `/plan`, `/enhance`, `/brainstorm`, `/status`, `/debug`, `/deploy`, `/test` |
| **Development** | `/backend`, `/frontend`, `/fullstack`, `/database`, `/data-layer`, `/business-logic` |
| **Frameworks** | `/nextjs`, `/react`, `/angular`, `/sveltekit`, `/nestjs`, `/express`, `/python-api`, `/go`, `/php`, `/delphi`, `/vbnet` |
| **Security** | `/security`, `/secure-coding`, `/threat-modeling`, `/incident-response`, `/compliance`, `/hack`, `/bypass`, `/pentest-plan`, `/kali` |
| **Infrastructure** | `/cloud`, `/docker`, `/linux`, `/windows`, `/network`, `/load-balancer`, `/migrate`, `/reliability` |
| **Orchestration** | `/orchestrate`, `/junior-orchestrate`, `/senior-orchestrate`, `/elite-orchestrate` |
| **Industrial** | `/mechatronic`, `/pneumatic`, `/electric`, `/chief-machine`, `/plc`, `/iot` |
| **Specialist** | `/math`, `/elite-tech-leader`, `/package-finder`, `/staff`, `/platform`, `/ux-research`, `/accessibility` |

### Method 2: Natural Language (Auto-Routing)

Just describe what you need — the system auto-selects the right agent:

```
"Build me a REST API with authentication"
→ 🤖 Active Agent: backend-specialist

"Check my code for security vulnerabilities"
→ 🤖 Active Agent: security-auditor
```

### Method 3: Orchestration (Multi-Agent)

| Level | Agents | Use Case |
|-------|--------|----------|
| `/junior-orchestrate` | 2-3 | Simple feature, quick fix |
| `/senior-orchestrate` | 4-6 | Multi-service feature, cross-team |
| `/elite-orchestrate` | 7+ | Mission-critical, enterprise migration |

---

## 🧪 Agent Testing

### Write Tests

Create `.agent/tests/your-agent.test.md`:

```markdown
---
name: your-agent-test
description: "Test suite for your-agent"
---

## Test 1: Agent loads correctly
- assert: config exists
- assert: agent name is "your-agent"
- assert: provider is "openai"

## Test 2: Guardrails active
- assert: path traversal protection enabled
- assert: safe write enabled
- assert: rate limit enabled

## Test 3: Skills loaded
- assert: skill clean-code loaded
```

### Available Assertions

| Assertion | Description |
|-----------|-------------|
| `config exists` | Config directory exists |
| `agent name is "X"` | Agent name matches |
| `provider is "X"` | LLM provider matches |
| `memory strategy is "X"` | Memory strategy matches |
| `guardrails active/enabled` | Guardrails are enabled |
| `path traversal protection enabled` | Path traversal guard works |
| `safe write enabled` | Atomic write enabled |
| `rate limit enabled` | Rate limiting enabled |
| `tool X available` | Tool is in agent's tool list |
| `skill X loaded` | Skill directory exists |
| `- skip: reason` | Skip this test |

---

## 🔌 Plugin System

### Install a Skill

```bash
aiyu-multi-agent add skill postgres        # installs aiyu-multi-agent-skill-postgres
aiyu-multi-agent add skill @org/custom     # scoped package
```

### Create a Skill Package

1. Create npm package with name `aiyu-multi-agent-skill-<name>`:

```
aiyu-multi-agent-skill-my-skill/
├── SKILL.md          # Required: metadata + guidelines
├── config.json       # Optional: plugin manifest
├── scripts/          # Optional: tool functions
└── references/       # Optional: templates, docs
```

2. Publish to npm: `npm publish`

3. Users install: `aiyu-multi-agent add skill my-skill`

---

## 🛡️ Built-in Guardrails

| Guardrail | Description |
|-----------|-------------|
| **Path Traversal** | Blocks `../`, absolute paths, double slashes, dot segments, symlink attacks escaping project root. Uses explicit `projectRoot` param + `path.normalize()` + `fs.realpathSync()` |
| **Safe Write** | Atomic file writes (temp → rename) with EXDEV fallback + temp file cleanup on error |
| **Rate Limit** | In-memory rate limiting (configurable per key, auto-cleanup) |
| **Sandbox Exec** | `execFileSync` only (no shell), whitelist-only, `parseCommandArgs` with escape sequences, dangerous pattern detection (command substitution, destructive commands) |
| **Command Injection** | `shell.exec` uses `execFileSync` + parsed args (no `shell: true`). Blocks `$()`, `` ` ``, `rm -rf`, `mkfs`, etc. |
| **File Limits** | `search.grep`: maxDepth=10, maxFileSize=1MB, maxFiles=1000. `fetchJSON`: 1MB response limit |

---

## 🔧 Adding New Components

### Add a New Agent

1. Create `.agent/agents/your-agent.md`:

```markdown
---
name: your-agent
description: What this agent does
tools: Read, Grep, Glob, Bash, Edit, Write
model: inherit
skills: clean-code, architecture
provider: openai
memory: none
guardrails: true
---

# Your Agent
Instructions here...
```

### Add a New Skill

```bash
aiyu-multi-agent add skill your-skill
```

Or create manually in `.agent/skills/your-skill/SKILL.md`.

### Add a New Rule

Create `.agent/rules/your-rules.md`:

```markdown
---
trigger: on_request
keywords: [keyword1, keyword2]
---

# Your Rule Title
Guidelines here...
```

---

## ✅ Verification & Quality

```bash
aiyu-multi-agent test                        # Run agent test suite
aiyu-multi-agent checklist                   # Run master checklist
aiyu-multi-agent checklist http://localhost:3000  # With performance + E2E
```

### Python Scripts

```bash
python3 .windsurf/skills/vulnerability-scanner/scripts/security_scan.py .
python3 .windsurf/skills/lint-and-validate/scripts/lint_runner.py .
python3 .windsurf/skills/testing-patterns/scripts/test_runner.py .
python3 .windsurf/skills/database-design/scripts/schema_validator.py .
python3 .windsurf/skills/frontend-design/scripts/ux_audit.py .
```

---

## 📊 Statistics

| Component | Count |
|-----------|-------|
| Agents | 80 |
| Skills | 46 |
| Workflows | 78 |
| Rules | 10 |
| Scripts | 4 |

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code style, and PR guidelines.

### Quick Links

| Document | Description |
|----------|-------------|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development guide, code style, testing |
| [SECURITY.md](SECURITY.md) | Vulnerability reporting and security policy |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Community standards (Contributor Covenant 2.1) |
| [CHANGELOG.md](CHANGELOG.md) | Version history and release notes |
| [CODEBASE.md](CODEBASE.md) | Architecture and module documentation |

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit with conventional commits: `feat(scope): description`
4. Push and create a Pull Request

---

## License

[MIT License](LICENSE) © 2026

**Authors:**
- [@teeprakorn1](https://github.com/teeprakorn1)
- [@FrameHandsomez](https://github.com/FrameHandsomez)

---
*Created: 2026-04-27 | V2: 2026-05-04 | V2.1: 2026-05-04*
