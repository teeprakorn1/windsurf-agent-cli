<div align="center">

<pre style="background:none;border:none;">
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🤖  AIYU MULTIAGENT  —  AI Agent Platform for Developers   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
</pre>

<h1>Aiyu MultiAgent — Production-Grade AI Agent Platform</h1>

<p>
  <strong>Build, test, and deploy AI agents with 83+ specialized agents, MCP integration, WebSocket streaming, and multi-LLM support.</strong>
</p>

<p>
  <a href="https://www.npmjs.com/package/aiyu-multi-agent"><img src="https://img.shields.io/npm/v/aiyu-multi-agent?style=for-the-badge&color=0ea5e9&logo=npm&logoColor=white" alt="NPM Version"></a>
  <a href="https://www.npmjs.com/package/aiyu-multi-agent"><img src="https://img.shields.io/npm/dt/aiyu-multi-agent?style=for-the-badge&color=8b5cf6&logo=npm&logoColor=white" alt="NPM Downloads"></a>
  <a href="https://github.com/teeprakorn1/aiyu-multi-agent/blob/main/LICENSE"><img src="https://img.shields.io/github/license/teeprakorn1/aiyu-multi-agent?style=for-the-badge&color=10b981&logo=opensourceinitiative&logoColor=white" alt="MIT License"></a>
</p>

<p>
  <a href="https://github.com/teeprakorn1/aiyu-multi-agent/commits/main"><img src="https://img.shields.io/github/last-commit/teeprakorn1/aiyu-multi-agent?style=flat-square&color=64748b" alt="Last Commit"></a>
  <a href="https://github.com/teeprakorn1/aiyu-multi-agent"><img src="https://img.shields.io/github/languages/top/teeprakorn1/aiyu-multi-agent?style=flat-square&color=64748b" alt="Top Language JavaScript"></a>
  <a href="https://github.com/teeprakorn1/aiyu-multi-agent"><img src="https://views.whatilearened.today/views/github/teeprakorn1/aiyu-multi-agent.svg?cache=remove" alt="GitHub Views"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-18%20%7C%2020%20%7C%2022-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js 18 20 22"></a>
  <a href="https://github.com/teeprakorn1/aiyu-multi-agent/pulls"><img src="https://img.shields.io/badge/PRs-Welcome-ff69b4?style=flat-square&logo=git&logoColor=white" alt="PRs Welcome"></a>
</p>

<table align="center">
  <tr>
    <td align="center"><b>83</b><br>🎯 Agents</td>
    <td align="center"><b>46</b><br>📚 Skills</td>
    <td align="center"><b>78</b><br>⚡ Workflows</td>
    <td align="center"><b>10</b><br>🛡️ Rules</td>
    <td align="center"><b>4</b><br>🧠 LLM Providers</td>
  </tr>
</table>

</div>

---

**Aiyu MultiAgent** is an open-source AI agent platform that helps developers automate software engineering tasks using large language models (LLMs). It features a **ReAct execution engine**, **MCP server integration** for Claude Code / Cursor / Windsurf, **WebSocket real-time streaming**, **agent handoff orchestration**, and a **plugin system** for extensible AI capabilities. Supports OpenAI GPT-4, Anthropic Claude, Ollama local models, and mock mode for testing.

> **Latest Release: v2.6.0** — Module decomposition + production hardening + Karpathy Behavioral Principles (84 agents): `agent-runtime.js` (843 → 8 focused modules), `tool-registry.js` (543 → 3 modules), tracing async write queue, MCP `run_agent` timeout + maxSteps cap, usage flush fix, Docker non-root user, `aiyu-multi-agent dev` command, TypeScript declarations, Karpathy principles (4 behavioral rules in system prompt + runtime guardrails + skill self-checks + all 84 agent files). All changes backward compatible.

---

## 📑 Table of Contents

- [What's New in V2.6](#-whats-new-in-v26)
- [What's New in V2.5](#-whats-new-in-v25)
- [Quick Start](#-quick-start)
- [Why Aiyu MultiAgent?](#-why-aiyu-multiagent)
- [CLI Reference](#-cli-reference)
- [LLM Providers](#-llm-providers)
- [Built-in Tools](#-built-in-tools)
- [Project Structure](#-project-structure)
- [How to Use](#-how-to-use)
- [Security & Guardrails](#-security--guardrails)
- [Agent Testing](#-agent-testing)
- [Plugin System](#-plugin-system)
- [Contributing](#-contributing)
- [License](#license)

---

## ✨ What's New in V2.6

V2.6 brings **module decomposition** and **production hardening** — breaking the two largest god modules into focused, maintainable files while preserving full backward compatibility.

| Area | Change | Impact |
|------|--------|--------|
| 🏗️ Decomposition | `agent-runtime.js` (843 lines) → 8 modules | Maintainability ⬆️ |
| 🏗️ Decomposition | `tool-registry.js` (543 lines) → 3 modules | Maintainability ⬆️ |
| 🔧 Production | Tracing `appendFileSync` → async batched queue | No event loop blocking |
| 🔧 Production | MCP `run_agent` 2min timeout + maxSteps cap 20 | Prevents runaway agents |
| 🔧 Production | Usage flush `beforeExit` + sync fallback | No data loss on exit |
| 🐳 Docker | Non-root user + expanded `.dockerignore` | Security ⬆️ |
| 🛠️ CLI | `aiyu-multi-agent dev` REPL with verbose logging | Dev experience ⬆️ |
| 📦 Types | `types.d.ts` for 12 core modules | TS migration foundation |
| 🧠 Karpathy | Behavioral principles in system prompt + runtime guardrails | LLM coding quality ⬆️ |
| 🤖 Agent Audit | 84/84 clean-code, 84/84 Interaction Maps, frontend decomposed | Agent consistency ⬆️ |
| 🛠️ 7 New Tools | agent.delegate, memory.save/load, web.search, plan.create/update/list | Agent capability ⬆️ |
| 📋 Frontmatter Audit | 84/84 When to Activate, 84/84 Philosophy, 84/84 memory field | Agent completeness ⬆️ |

### Decomposed Modules

```
agent-runtime.js (re-export) ──► react-loop.js    — ReAct loop
                               ► chat-session.js — Interactive chat
                               ► failover.js     — Per-provider CB
                               ► cache.js        — LRU cache
                               ► agent-loader.js — Agent spec loading
                               ► prompt-builder.js — System prompt
                               ► input-sanitizer.js — Input validation
                               ► tool-parser.js — Tool call parsing

tool-registry.js (re-export) ──► tool-definitions.js — Tools + schemas
                               ► search-tools.js   — Grep + Glob
                               ► command-parser.js — Shell arg parse
```

---

## ✨ What's New in V2.5

V2.5 brings **Claude Design-inspired** capabilities to the Aiyu MultiAgent platform, enabling real-time agent collaboration, external API access, and smarter project-aware AI automation. This release adds 9 major features and fixes 31 bugs for production-grade reliability.

**V2.5.1** adds 25 system-audit bug fixes: per-provider circuit breaker keys (`llm:openai`, `llm:claude` etc.) with `callLLMWithFailover()`, rate limit hard cap (200 entries) + X-Forwarded-For spoofing fix (`AIYU_TRUST_PROXY`), `search.grep` lastIndex reset, chat session failover + 30-min TTL, `PENDING_INTERVENTIONS` export fix, handoff bundle persistence + project-scoped path, cache freeze-on-fallback (Object.freeze), truncation optimization (shallow copy), LLM retry off-by-one fix, queue event order fix, Ollama https transport, usage flush on exit, tracing p95 clamp, CORS origin config (`AIYU_CORS_ORIGIN`), and fs.glob brace alternation escape.

| 🎛️ **Real-Time Streaming** | 🔗 **Agent Handoff** | 💬 **Inline Intervention** |
|:---:|:---:|:---:|
| WebSocket API at `/ws` streams agent step events live to your IDE | `POST /handoff` chains multiple AI agents with enriched context bundles | `POST /agents/intervene` or WebSocket lets you inject feedback mid-run |

| 🌐 **`fetch.url` Tool** | 🤖 **Auto-Apply Context** | 🔐 **API Key Auth** |
|:---:|:---:|:---:|
| Agents fetch HTTP(S) URLs with 15s timeout and 100KB body limit | Auto-detects language/framework from `package.json` + `.windsurf/rules` | `AIYU_API_KEY` env var with Bearer token + `crypto.timingSafeEqual` |

| ⚡ **LLM Failover** | ⏱️ **Per-Tool Timeout** | ✂️ **Smart Truncation** |
|:---:|:---:|:---:|
| `openai → claude → local → mock` failover when circuit breaker opens | 30s `Promise.race` per tool call with `tool_timeout` tracing | Section-aware 8KB skill limit preserving headings and code blocks |

---

## 🚀 Quick Start

Get started in seconds with `npx` — no installation required:

```bash
# Initialize in your project (one command, smart defaults, no prompts!)
npx aiyu-multi-agent init

# Or use interactive mode for full guided setup
npx aiyu-multi-agent init --interactive
```

Once initialized, type any **slash command** in the Windsurf chat panel or terminal to activate specialized AI agents:

```
/create Build a task management app with Next.js
/backend Design a REST API with PostgreSQL and authentication
/security Audit my codebase for OWASP vulnerabilities
/debug Find the memory leak in my Express middleware
```

The platform automatically detects your project type, selects the right agent, and starts working.

<details>
<summary><b>📦 Or Clone From Source</b></summary>

```bash
git clone https://github.com/teeprakorn1/aiyu-multi-agent.git
cd aiyu-multi-agent
npm install
aiyu-multi-agent .
```
</details>

---

## � Why Aiyu MultiAgent?

### The Problem
Developers waste hours on repetitive tasks — setting up projects, writing boilerplate, auditing code, debugging, and orchestrating complex multi-step workflows across different tools and LLM providers.

### The Solution
Aiyu MultiAgent is a **unified AI agent platform** that brings 83+ specialized agents to your fingertips. Instead of context-switching between ChatGPT, Claude, and custom scripts, you get:

- **⚡ Instant Agent Activation** — Type `/backend`, `/security`, or `/deploy` and a domain expert agent takes over
- **🧠 Multi-LLM Support** — Works with OpenAI GPT-4, Anthropic Claude, local Ollama models, and mock mode for testing
- **🔒 Production-Grade Safety** — Path traversal protection, sandboxed execution, secret scanning, and permission-based skill installation
- **🔌 MCP Integration** — Native support for Claude Code, Cursor, and Windsurf via the Model Context Protocol
- **📡 Real-Time Streaming** — WebSocket API streams agent thoughts and actions live to your IDE
- **🤝 Agent Handoff** — Chain multiple agents together for complex workflows (e.g., architect → backend → security auditor)
- **🧪 Built-In Testing** — Write declarative agent tests in Markdown, run compliance checks, and validate with CI/CD
- **📦 Publish & Share** — Package your custom agents as npm modules for your team or the community

---

##  CLI Reference

Aiyu MultiAgent provides a comprehensive command-line interface for managing AI agents, running tasks, testing, and publishing. All commands support `--help` for detailed usage.

### 🏠 Core Commands

```bash
aiyu-multi-agent init                        # Quick setup (smart defaults)
aiyu-multi-agent init --interactive          # Full interactive setup
aiyu-multi-agent init --dry-run              # Preview without writing
aiyu-multi-agent version                     # Show version + check updates
aiyu-multi-agent status                      # Project statistics
aiyu-multi-agent list                        # List all slash commands
aiyu-multi-agent inspect                     # Observability dashboard
aiyu-multi-agent checklist                   # Run master checklist
```

### ⚙️ Execution Engine

Run agents with natural language input or start an interactive chat session:

```bash
aiyu-multi-agent run "Create REST API"       # Run agent with input
aiyu-multi-agent run "..." --agent backend   # Specify agent
aiyu-multi-agent run "..." --provider openai # OpenAI (needs OPENAI_API_KEY)
aiyu-multi-agent run "..." --provider claude # Claude (needs ANTHROPIC_API_KEY)
aiyu-multi-agent run "..." --provider local  # Ollama (local LLM)
aiyu-multi-agent run "..." --provider mock   # Mock (testing)
aiyu-multi-agent run "..." --json            # JSON output (CI/CD)
aiyu-multi-agent run "..." --max-steps 20    # Override max ReAct steps
aiyu-multi-agent run "..." --verbose         # Streaming step-by-step
aiyu-multi-agent run "..." --no-cache        # Skip cache

aiyu-multi-agent chat                        # Interactive session
aiyu-multi-agent chat --agent backend        # Chat with specific agent
```

### 🌐 HTTP API & WebSocket

Start a production-ready HTTP server with REST API and WebSocket streaming:

```bash
aiyu-multi-agent serve                       # Start HTTP API server
```

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | System status (k8s probe exempt from auth) |
| `/jobs` | POST | Enqueue agent run |
| `/jobs/:id` | GET | Poll job status |
| `/metrics` | GET | Prometheus gauge format |
| `/traces` | GET | Distributed trace data |
| `/handoff` | POST | Chain agents with context bundles |
| `/agents/intervene` | POST | Inject mid-run feedback |
| `/ws` | WebSocket | Real-time agent step streaming |

### 🔌 MCP Server

Integrate with Claude Code, Cursor, Windsurf, and any MCP-compatible host:

```bash
aiyu-multi-agent mcp                         # Start MCP server (stdio)
```

<details>
<summary><b>Host Configuration</b></summary>

**Claude Code** — `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "aiyu": {
      "command": "npx",
      "args": ["-y", "aiyu-multi-agent", "mcp"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

**Cursor** — `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "aiyu": {
      "command": "npx",
      "args": ["-y", "aiyu-multi-agent", "mcp"]
    }
  }
}
```

| MCP Tool | Description |
|----------|-------------|
| `list_agents` | Discover available agents |
| `run_agent` | Execute agent (pass `agent_name` + `input`) |
| `inspect_agent` | Get agent details — skills, tools, instructions |

</details>

### 🧪 Testing & Publishing

```bash
aiyu-multi-agent test                        # Run agent test suite
aiyu-multi-agent test --compliance           # Spec compliance (15 checks)
aiyu-multi-agent test --unit                 # Unit tests (29 tests)
aiyu-multi-agent test --watch                # Watch mode

aiyu-multi-agent publish                     # Publish agent to npm
aiyu-multi-agent publish --dry-run           # Validate without publishing
```

### 📦 Plugin System

```bash
aiyu-multi-agent add skill <name>            # Install skill from npm
aiyu-multi-agent remove skill <name>         # Uninstall skill
```

---

## 🔧 LLM Providers

Aiyu MultiAgent supports multiple large language model providers with **automatic failover**. If one provider's circuit breaker opens, the system automatically tries the next provider in the chain.

| 🧠 Provider | 🔑 Environment Variable | 📝 Supported Models | 💡 Best For |
|:---:|:---:|:---|:---|
| **OpenAI** | `OPENAI_API_KEY` | `gpt-4`, `gpt-4o`, `gpt-3.5-turbo` | General-purpose coding, reasoning, creative tasks |
| **Claude** | `ANTHROPIC_API_KEY` | `claude-3-5-sonnet`, `claude-3-5-haiku` | Long context, detailed analysis, safety-critical code |
| **Ollama** | `OLLAMA_HOST` | `llama3`, `mistral`, `codellama` | Local/offline execution, privacy-sensitive projects |
| **Mock** | *(none)* | Canned responses | Testing, CI/CD pipelines, development without API keys |

**🔄 Failover Chain:** `openai → claude → ollama → mock`

When the circuit breaker detects failures (timeouts, 5xx errors, rate limits), it automatically promotes the next provider. No manual intervention required.

---

## 🛠️ Built-in Tools

Every agent gets access to a set of **sandboxed, namespaced tools** for safe file system and shell operations. All tools run with path traversal protection and argument validation.

| 🔧 Tool | 📥 Required Args | 📝 What It Does |
|:---:|:---:|:---|
| `fs.read` | `path` | Read file contents with project-root restriction |
| `fs.write` | `path`, `content` | Atomic file write (temp → rename) with EXDEV fallback |
| `fs.edit` | `path`, `old_string`, `new_string` | Find & replace with **unique match enforcement** |
| `fs.glob` | `pattern` | Find files by glob pattern (brace `{a,b}` expansion supported) |
| `search.grep` | `pattern` | Search file contents (async walk, Node.js native — works on Windows) |
| `shell.exec` | `command` | Execute whitelisted shell commands via `execFileSync` (no shell) |
| `fetch.url` | `url` | Fetch HTTP(S) URLs with 15s timeout, 3-redirect follow, 100KB limit |

> **Legacy aliases:** `Read`, `Write`, `Edit`, `Grep`, `Glob`, `Bash` auto-map to namespaced versions for backward compatibility.

<details>
<summary><b>⚙️ Runtime Correctness Guarantees</b></summary>

- **Parser Fallback Chain** — 4 strategies: structured JSON → `TOOL_CALL` regex → JSON code blocks → final answer
- **Arg Validation** — Required args checked before execution; missing args return descriptive errors
- **Step Logging** — Every step recorded as `{ step, thought, action, result, error, duration_ms }`
- **Output Contract** — `outputFormat: json` enforces valid JSON output (useful for CI/CD)
- **Deterministic Mode** — `temperature: 0` for reproducible test results across all providers
- **Tool Timeout** — 30s per tool call via `Promise.race`; tracing tags `tool_timeout` vs `tool_failure`
- **LLM Retry/Backoff** — Exponential backoff (max 3 retries) for HTTP 429, 503, and network timeouts
- **Cross-Platform** — `fs.glob` and `search.grep` use pure Node.js (no external `grep`/`find` dependency)
- **Safe Write EXDEV** — Atomic write handles cross-partition rename with copy+unlink fallback
- **Agent Name Validation** — Rejects path traversal characters: `/ \ : * ? " < > |`

</details>

---

## 📁 Project Structure

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

.windsurf/                       # Symlink → .agent/ (Windsurf IDE)
```

<details>
<summary>📦 Package Structure</summary>

```
aiyu-multi-agent/
├── bin/
│   ├── cli.js                   # CLI entry (Commander.js)
│   ├── server.js                # HTTP API server entry
│   └── postinstall.js           # Post-install script
├── lib/
│   ├── api/
│   │   ├── server.js            # Express HTTP server
│   │   ├── ws.js                # WebSocket real-time streaming
│   │   ├── handoff.js           # Agent handoff + intervention API
│   │   ├── jobs.js              # Async job queue
│   │   ├── middleware.js        # Auth, rate-limit, logging, shutdown guard
│   │   └── config.js            # API configuration
│   ├── core/
│   │   ├── agent-runtime.js     # 🔥 ReAct loop + tool calling + timeout + skill truncation
│   │   ├── agent-system.js      # Auto-detect project context
│   │   ├── handoff.js           # Handoff bundle builder
│   │   ├── tool-registry.js     # Namespaced tools, schemas, arg validation
│   │   ├── llm-providers.js     # OpenAI, Claude, Ollama, Mock + retry/backoff
│   │   ├── tool-runner.js       # Isolated tool runner (child process)
│   │   ├── plugin.js            # Plugin lifecycle + permission system
│   │   ├── guardrails.js        # Security & safety layer
│   │   ├── circuit-breaker.js   # Prevents cascade LLM failures
│   │   ├── request-queue.js     # Concurrency control + backpressure
│   │   ├── tracing.js           # Distributed tracing (OTel export)
│   │   ├── health-check.js      # System + Ollama health status
│   │   ├── usage.js             # Usage statistics + Prometheus metrics
│   │   ├── config.js            # Config loader (.agent/ + .windsurf/ symlink)
│   │   ├── logger.js            # Structured logging
│   │   └── runtime.js           # Node/Bun detection
│   ├── commands/                # CLI command handlers
│   ├── test/                    # Test runner + compliance + unit tests
│   ├── mcp/                     # MCP server + tools
│   └── publish/                 # Packager + validator + registry
├── templates/                  # Agent + skill scaffolds
├── docs/                       # Architecture, runtime spec, roadmap, usage
└── .windsurf/                  # 83 Agents, 46 Skills, 78 Workflows, 10 Rules
```
</details>

---

## 🎯 How to Use Aiyu MultiAgent

### Method 1: Slash Commands — Instant Agent Activation

Type `/` followed by a command name to instantly activate a specialized AI agent. Each agent has domain-specific skills, tools, and guardrails tailored to its purpose.

| 🏠 **Core** | 💻 **Development** | 🏗️ **Frameworks** |
|:---:|:---:|:---:|
| `/create` `/plan` `/enhance` `/brainstorm` | `/backend` `/frontend` `/fullstack` | `/nextjs` `/react` `/angular` `/sveltekit` |
| `/status` `/debug` `/deploy` `/test` | `/database` `/data-layer` `/business-logic` | `/nestjs` `/express` `/python-api` `/go` |

| 🔒 **Security** | ☁️ **Infrastructure** | 🏭 **Industrial** |
|:---:|:---:|:---:|
| `/security` `/secure-coding` `/threat-modeling` | `/cloud` `/docker` `/linux` `/windows` | `/mechatronic` `/pneumatic` `/electric` |
| `/pentest-plan` `/kali` `/hack` `/bypass` | `/network` `/load-balancer` `/migrate` | `/chief-machine` `/plc` `/iot` |

| 🤝 **Orchestration** | 🎓 **Specialist** |
|:---:|:---:|
| `/orchestrate` `/junior-orchestrate` (2-3 agents) | `/math` `/elite-tech-leader` `/package-finder` |
| `/senior-orchestrate` (4-6 agents) | `/staff` `/platform` `/ux-research` `/accessibility` |
| `/elite-orchestrate` (7+ agents) | |

### Method 2: Natural Language — Smart Auto-Routing

Just describe your task in plain English — the built-in **intelligent routing system** automatically selects the best AI agent for your request:

```
"Build me a REST API with JWT authentication and PostgreSQL"
→ 🤖 Active Agent: backend-specialist

"Check my React app for XSS and CSRF vulnerabilities"
→ 🤖 Active Agent: security-auditor

"Design a cloud architecture on AWS for 10k concurrent users"
→ 🤖 Active Agent: cloud-architect
```

### Method 3: Multi-Agent Orchestration — Complex Projects

For complex, multi-domain projects, orchestrate multiple agents to work together:

| Orchestration Level | Agents | Best For |
|:---:|:---:|:---|
| 🟢 **Junior** `/junior-orchestrate` | 2–3 | Simple feature, quick bug fix, single-file refactor |
| 🟡 **Senior** `/senior-orchestrate` | 4–6 | Multi-service feature, cross-team integration, architecture review |
| 🔴 **Elite** `/elite-orchestrate` | 7+ | Mission-critical migration, enterprise platform, zero-downtime deployment |

---

## 🛡️ Security & Guardrails

Aiyu MultiAgent is built with **security-first design** for safe AI agent execution in production environments. Every tool call passes through multiple safety layers:

| 🔐 Guardrail | 🛡️ Protection Layer | 📝 Details |
|:---:|:---|:---|
| **Path Traversal** | File system isolation | Blocks `../`, absolute paths, symlink escapes. Uses `projectRoot` + `path.normalize()` + `fs.realpathSync()` |
| **Safe Write** | Data integrity | Atomic writes (temp → rename) with EXDEV cross-partition fallback |
| **Rate Limit** | DoS prevention | In-memory limiting with X-Forwarded-For support, auto-cleanup |
| **Sandbox Exec** | Command isolation | `execFileSync` only (no shell). Whitelist-only commands. `path.basename()` pre-check |
| **Command Injection** | Input sanitization | Blocks `$()`, `` ` ``, `rm -rf`, `mkfs`, `dd`, destructive patterns |
| **API Key Auth** | Access control | `AIYU_API_KEY` env var. Bearer token with `crypto.timingSafeEqual` (timing-attack safe) |
| **Env Leak Prevention** | Secret protection | Strips `API_KEY` / `TOKEN` / `SECRET` / `PASSWORD` from child process `env` |
| **Secret Scanning** | Pre-publish safety | Detects leaked keys on `publish`. Blocks with `--strict`. Scans for `ghp_`, `sk-`, `AKIA` |
| **Permission System** | Explicit consent | Skills declare `permissions: { fs, network, exec }`. User must approve on install |

---

## 🧪 Testing Your Agents

Write declarative tests in **Markdown** — no code required. Create `.agent/tests/your-agent.test.md`:

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

Run tests with a single command:

```bash
aiyu-multi-agent test                        # Run all test suites
aiyu-multi-agent test --compliance           # 15 spec compliance checks
aiyu-multi-agent test --unit                 # 29 core module unit tests
aiyu-multi-agent test --watch                # Auto-re-run on file changes
```

| Assertion | What It Checks |
|-----------|----------------|
| `config exists` | `.agent/` directory exists and is valid |
| `agent name is "X"` | Agent manifest name matches expected |
| `provider is "X"` | LLM provider configured correctly |
| `guardrails active/enabled` | All security guardrails initialized |
| `tool X available` | Required tool is in agent's tool list |
| `skill X loaded` | Skill directory exists and parses correctly |

---

## 🔌 Plugin System — Extend With Skills

Install community skills from npm to extend your agents:

```bash
aiyu-multi-agent add skill postgres          # Install aiyu-multi-agent-skill-postgres
aiyu-multi-agent add skill @org/custom       # Scoped packages supported
```

Skills add new capabilities — database helpers, cloud APIs, testing frameworks, and more. Each skill declares its required permissions, and you approve before installation.

<details>
<summary><b>📝 Publish Your Own Skill</b></summary>

1. Create npm package `aiyu-multi-agent-skill-<name>`:

```
aiyu-multi-agent-skill-my-skill/
├── SKILL.md          # Required: metadata + guidelines
├── config.json       # Optional: plugin manifest with permissions
├── scripts/          # Optional: tool functions
└── references/       # Optional: templates, docs
```

2. Publish: `npm publish`
3. Users install: `aiyu-multi-agent add skill my-skill`

</details>

---

## 🔧 Customize and Extend

<details>
<summary><b>➕ Add a New Agent</b></summary>

Create `.agent/agents/your-agent.md`:

```markdown
---
name: your-agent
description: What this AI agent specializes in
tools: fs.read, search.grep, fs.glob, shell.exec, fs.edit, fs.write
skills: clean-code, architecture
provider: openai
guardrails: true
---

# Your Agent Instructions

Write detailed instructions here for the LLM...
```
</details>

<details>
<summary><b>📝 Add a New Skill</b></summary>

```bash
aiyu-multi-agent add skill your-skill
```

Or create manually in `.agent/skills/your-skill/SKILL.md`.
</details>

<details>
<summary><b>📜 Add a New Rule</b></summary>

Create `.agent/rules/your-rules.md`:

```markdown
---
trigger: on_request
keywords: [keyword1, keyword2]
---

# Your Rule Title

Guidelines that auto-trigger when keywords match...
```
</details>

---

## 🤝 Contributing

We welcome contributions from the community! Whether it's bug fixes, new agents, skills, or documentation improvements.

[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-ff69b4?style=for-the-badge&logo=git&logoColor=white)](https://github.com/teeprakorn1/aiyu-multi-agent/pulls)

| 📄 Document | 🔍 Description |
|:---|:---|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development setup, code style, testing guide |
| [SECURITY.md](SECURITY.md) | Vulnerability reporting and security policy |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Community standards (Contributor Covenant 2.1) |
| [CHANGELOG.md](CHANGELOG.md) | Full version history and release notes |
| [CODEBASE.md](CODEBASE.md) | Architecture overview and module documentation |

**Quick contribution workflow:**

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_NAME/aiyu-multi-agent.git

# 2. Create a feature branch
git checkout -b feature/my-awesome-feature

# 3. Make changes and test
npm test

# 4. Commit with conventional commits
git commit -m "feat(agents): add kubernetes-orchestrator agent"

# 5. Push and open a Pull Request
git push origin feature/my-awesome-feature
```

---

<div align="center">

<br>

**[MIT License](LICENSE)** © 2026 Aiyu MultiAgent Contributors

<p>
  <a href="https://github.com/teeprakorn1"><b>@teeprakorn1</b></a> ·
  <a href="https://github.com/FrameHandsomez"><b>@FrameHandsomez</b></a>
</p>

<p>
  <a href="https://github.com/teeprakorn1/aiyu-multi-agent/stargazers">⭐ Star us on GitHub</a> ·
  <a href="https://github.com/teeprakorn1/aiyu-multi-agent/issues">🐛 Report Issues</a> ·
  <a href="https://www.npmjs.com/package/aiyu-multi-agent">📦 npm Package</a>
</p>

<br>

</div>
