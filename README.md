<div align="center">

<pre style="background:none;border:none;">
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🤖  AIYU MULTIAGENT  —  AI Agent Platform for Developers   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
</pre>

<h1>Aiyu MultiAgent — AI Agent Platform</h1>

<p>
  <strong>Build, test, and deploy AI agents with 84 specialized agents, MCP integration, WebSocket streaming, and multi-LLM support.</strong>
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
    <td align="center"><b>84</b><br>🎯 Agents</td>
    <td align="center"><b>46</b><br>📚 Skills</td>
    <td align="center"><b>78</b><br>⚡ Workflows</td>
    <td align="center"><b>10</b><br>🛡️ Rules</td>
    <td align="center"><b>4</b><br>🧠 LLM Providers</td>
  </tr>
</table>

</div>

---

**Aiyu MultiAgent** is an open-source AI agent platform that helps developers automate software engineering tasks using large language models (LLMs). It features a **ReAct execution engine**, **MCP server integration** for Claude Code / Cursor / Windsurf, **WebSocket real-time streaming**, **agent handoff orchestration**, and a **plugin system** for extensible AI capabilities. Supports OpenAI GPT-4, Anthropic Claude, Ollama local models, and mock mode for testing.

> **Latest Release: v2.7.5** — Dashboard `chat-panel.tsx` refactored into 5 focused sub-components (599 lines, down from 1026). No behavioral changes. V2.7.4 had Chat mode `agent.status` broadcast fix. V2.7.3 had React Strict Mode WebSocket fix, dashboard UI upgrade, markdown rendering. V2.7.2 had mock provider default + 56 bug fixes. All changes backward compatible.

---

## 📑 Table of Contents

- [What's New in V2.7](#-whats-new-in-v27)
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

## ✨ What's New in V2.7

V2.7 brings a **real-time monitoring dashboard** and **bug fix hardening** — adding a Next.js 14 dashboard for live agent monitoring, formal WS event schema, and fixing 21 bugs across two releases.

| Area | Change | Impact |
|------|--------|--------|
| 📊 Dashboard | Next.js 14 real-time monitoring (`aiyu-multi-agent-dashboard/`) | Observability ⬆️ |
| 🌙 P3 Polish | Dark mode, export trace, keyboard shortcuts, WS auto-reconnect, mobile | UX ⬆️ |
| 📡 WS Schema | `docs/WS-SCHEMA.md` — formal contract (6 client→server, 10 server→client) | Reliability ⬆️ |
| 🔄 Broadcasts | `agent.status`, `handoff.started/complete`, `delegate.started/complete` | Dashboard ⬆️ |
| 🐛 V2.7.0 Fixes | 11 bugs — path traversal, timer leak, Ollama deprioritize, etc. | Security ⬆️ |
| 🐛 V2.7.1 Fixes | 75 bugs across 5 rounds — Dashboard integration, WS disconnect abort, mutable Map export, server crash guard, input validation, path traversal in packager, npm --ignore-scripts, agent file size limit, env secret leak, true LRU, retry jitter, recursive secret scan, symlink warning, heading truncation, watch timer cleanup, .tmp file cleanup, health-check agent reuse, dev --provider flag, dynamic compliance agent, SKIP_DIRS | Stability ⬆️ |
| 🐛 V2.7.4 Fixes | Chat mode `agent.status` broadcast — `AgentStatusPanel` now updates during chat sessions | Dashboard ⬆️ |
| 🐛 V2.7.2 Fixes | Mock provider default + Full System + Core Logic + Dashboard/API Bug Audit (56 bugs) — var→let leak, circuit-breaker stale cleanup, Ollama probe guard, chat timeout leak, failover loop-index, Claude model passthrough, queue settled flag, handoff regex, cache mutable fallback, halfOpenMaxAttempts 1→3, context trim pair fix + original task preservation, sliding window pair-preservation, isRetryableError word-boundary, Ollama model passthrough, WS reconnect re-subscribe, pendingInterventions cleanup, /health auth bypass, agent duration live refresh, chat-session context trim pair-preservation, chat error turnId, chat-panel auto-select session, completedRuns eviction, handoff artifact count, status complete→completed standardization, endTrace status check, plan pathTraversal sanitization, MCP timeout timer leak, metrics-panel AbortController, delegate context trim pair-preservation | Stability ⬆️ |
| � V2.7.3 Fixes | React Strict Mode WS disconnect, markdown rendering, keyboard shortcut conflicts, duplicate React keys, dropdown overflow, provider filtering, unified ChatPanel, responsive mobile layout | UX ⬆️ |
| � Dashboard Security | CSP headers, API proxy path whitelist, WS auth `Sec-WebSocket-Protocol`, input validation | Security ⬆️ |
| 🧪 Test Suite | Jest + React Testing Library + Playwright E2E (29 unit + 9 E2E tests) | Quality ⬆️ |
| 🏗️ Refactoring | `page.tsx` 479→160 lines, `DashboardHeader`/`RunPanel`/`ResetDialog` components | Maintainability ⬆️ |

### V2.7.4 Chat Mode Agent Status Broadcast

**v2.7.4** fixes a high-severity bug where Chat mode did not broadcast `agent.status` WebSocket events, causing the dashboard's `AgentStatusPanel` to show "No agents running" during active chat sessions.

- **Chat mode `agent.status` broadcast** — `handleChatCreate` and `handleChatSend` in `ws.js` did not call `setAgentStatus()`. Added status broadcasts at session creation (`"idle"`), chat send start (`"running"`), and chat send completion (`"completed"`/`"error"`). Now both Run and Chat modes update `AgentStatusPanel` in real-time (`lib/api/ws.js`)
- **ExecutionTimeline empty during chat** — Only read from `runs`/`completedRuns` (Run mode). Fixed by merging `chatSteps`/`chatCompletions` into timeline data (`execution-timeline.tsx`)
- **LogsViewer empty during chat** — Same root cause. Fixed by including chat data in log entries (`logs-viewer.tsx`)
- **InterventionPanel shows "No active runs" during chat** — Only checked `runs`/`completedRuns`. Fixed by detecting active chat sessions (`intervention-panel.tsx`)

### V2.7.3 Dashboard UI Upgrade + Responsive Design

**v2.7.3** polishes the dashboard ChatPanel with a unified layout, responsive mobile support, and fixes for React Strict Mode WebSocket disconnects.

**Dashboard UI Polish:**
- **Unified ChatPanel** — Run mode and Chat mode merged into a single full-width ChatPanel with internal sidebar for sessions and monitor
- **Sidebar tabs** — Underline-style tabs (Chat=blue, Monitor=cyan) replacing pill toggle
- **Compact header** — Pill-style AgentSelect/ProviderSelect with token usage badge and streaming indicator in one row
- **Session cards** — Rounded cards with avatar icon, active ring, provider badge, and color-coded action buttons
- **New Chat dialog** — Gradient icon header, stable open/close behavior (fixed conflicting outside-click listener)

**Responsive Design:**
- **Mobile sidebar** — Hidden on mobile (<1024px) with floating toggle button; slides in as overlay with dark backdrop
- **Responsive header** — Icon-only buttons on small screens, flex-wrap selectors, smaller title
- **Compact monitor panels** — Tighter spacing and smaller fonts in MetricsPanel and AgentStatusPanel for sidebar fit

**Bug Fixes:**
- **React Strict Mode WS disconnect** — Deferred close pattern: cleanup sets 100ms timer instead of immediate close; remount cancels timer
- **Markdown rendering** — All panels (ExecutionTimeline, AgentStatus, Logs) now use `MarkdownRenderer` for bold, lists, code blocks
- **Keyboard shortcut conflicts** — Global `Enter` handler restricted to `Ctrl/Cmd+Enter`; plain `Enter` only sends chat
- **Duplicate React keys** — `turnKey` now includes `timestamp` to ensure uniqueness across Fast Refresh remounts
- **Dropdown overflow** — Removed `overflow-hidden` from containers, raised dropdown z-index to prevent clipping
- **Provider filtering** — Filter now includes `"configured"` and `"ok"` statuses; defaults to `["mock"]` before health responds

### V2.7.2 Bug Fixes (Mock Provider Default + Full System + Core Logic Bug Audit)

**v2.7.2** makes `mock` the default provider when no API keys are configured, eliminating the "No LLM provider detected" error. A warning is shown so users know they're in mock mode. Also fixes failover chain and health-check to accept mock without requiring `AIYU_ENABLE_MOCK`.

**Full System Bug Audit (10 bugs fixed):**
- **Core Engine** — `chat-session.js`: aborted message no longer overwritten by timeout message; empty-string `finalContent` no longer treated as error in trace results
- **API / WS** — `ws.js`: `provider ??` and `maxSteps ??` nullish coalescing prevents `0`/`""` from incorrectly falling back to defaults; `handleChatSend` catch block now clears timeout to prevent timer leak
- **CLI / Jobs** — `jobs.js`: `provider ??` and `max_steps ??` nullish coalescing fixes
- **Handoff** — `handoff.js`: `provider ??` nullish coalescing in source/target agent calls
- **Metrics** — `server.js`: percentile index calculation fixed from `floor(n * p)` to `floor((n-1) * p)` for correct 0-indexed array percentiles
- **Output** — `react-loop.js`: JSON output enforcement now triggers on empty-string outputs (`!= null` instead of truthiness check)
- **UX Audit** — `ux_audit.py`: `has_form` regex no longer falsely matches `glass-card` CSS class, eliminating 5 false-positive "form inputs without labels" issues

**Core Logic Bug Audit (15 bugs fixed — 4C + 5H + 6M):**
- **Critical** — `var`→`let` in `react-loop.js` and `chat-session.js`: function-scoped `var result` leaked tool results across iterations
- **Critical** — `circuit-breaker.js`: `cleanupStaleBreakers` deleted recovered breakers; `lastFailureTime` now cleared on HALF_OPEN→CLOSED
- **Critical** — `health-check.js`: Ollama probe ran without `OLLAMA_HOST`, causing 2s timeout delay on every health check
- **Critical** — `chat-session.js`: `chatTimeoutId` leaked on normal ReAct loop exit; added `clearTimeout`
- **High** — `failover.js`: `indexOf` inside loop → loop-index based last-provider check
- **High** — `llm-providers.js`: `callClaude` now receives resolved model like `callOpenAI`
- **High** — `request-queue.js`: `settled` flag guard prevents job timeout/completion race
- **High** — `health-check.js`: queue error message now includes actual error
- **High** — `handoff.js`: sentence-boundary regex replaces naive `includes("decided")`
- **Medium** — `cache.js`: mutable shallow copy replaces `Object.freeze` fallback (was breaking `_fromCache` mutation)
- **Medium** — `circuit-breaker.js`: `halfOpenMaxAttempts` default 1→3 for resilient recovery
- **Medium** — `failover.js`: `_ollamaLastOk` shared state documented for single-process assumption
- **Medium** — `react-loop.js`: context trimming now drops assistant + ALL consecutive user messages (was only 2, leaving orphaned tool results)
- **Medium** — `chat-session.js`: sliding window pair-preservation — if window starts with `user`, include preceding `assistant`
- **Medium** — `llm-providers.js`: `isRetryableError` uses word-boundary regex (`\b429\b`) instead of `includes("429")`

**Dashboard + API Bug Audit Round 4 (9 bugs fixed — 1C + 2H + 6M):**
- **Critical** — `react-loop.js`: context trimming dropped `messages[1]` (original user task) instead of starting from `messages[2]`, causing LLM to receive invalid `system→assistant` sequence and lose task context. Now preserves system + original user message
- **High** — `ws.js`: `pendingInterventions` Map entry never cleaned when run completes/errors, causing unbounded memory growth. Added `PENDING_INTERVENTIONS.delete(runId)` on run completion and error
- **High** — `use-websocket.ts`: no re-subscription to active runs after WS reconnect, causing missed steps/completions. Added subscribe messages for active runIds on `ws.onopen`
- **Medium** — `llm-providers.js`: `callOllama(messages, options)` didn't receive resolved model from failover chain (unlike `callOpenAI`/`callClaude`). Changed to `callOllama(messages, { ...options, model })`
- **Medium** — `handoff.js`: decision regex required sentence boundary (`^|\n|.\s`) before keywords, missing mid-sentence patterns like "Based on this, I decided". Added `.,;!?` as boundary characters
- **Medium** — `server.js`: `apiKeyAuth` middleware ran on `/health` endpoint, breaking K8s/load balancer probes when API key is configured. Added path check to skip auth for `/health`
- **Medium** — `agent-status-panel.tsx`: `formatSince` duration computed once and never refreshed for running agents. Added 1-second interval tick when any agent is in running state
- **Medium** — `dashboard-header.tsx`: API Key row showed `••••••••` implying the key was hidden, but `NEXT_PUBLIC_*` vars are in page source. Changed to show "Configured"/"Not set" for honest labeling
- **Medium** — `tracing.js`: p95 percentile index used `Math.floor` causing low bias for small samples (e.g., length=2 → index=0 instead of 1). Changed to `Math.round`

**Deep System Bug Audit Round 5 (7 bugs fixed — 2H + 5M):**
- **High** — `chat-session.js`: context trim after tool execution had no pair-preservation — could start with orphaned `user` tool-result, producing invalid `system→user(tool result)` LLM sequence. Added pair-preservation logic
- **High** — `ws.js`: `handleChatSend` error event missing `turnId` — dashboard couldn't map error to streaming turn, leaving message stuck as "streaming" forever. Added `turnId: resolvedTurnId`
- **Medium** — `chat-panel.tsx`: `useEffect` auto-selected session only when `!activeSessionId` — creating new session while another was active wouldn't switch to it. Fixed condition
- **Medium** — `use-websocket.ts`: `completedRuns` added entries without immediate eviction — memory bloat between cleanup timer intervals. Added eviction when over `MAX_RUNS`
- **Medium** — `handoff.js`: `broadcastHandoffComplete` passed `bundle.artifacts` (array) instead of count — dashboard displayed `[object Object]`. Changed to `.length`
- **Medium** — `react-loop.js` + 4 files: `state.status = "complete"` didn't match `"completed"` in WS/API/types.ts, breaking downstream checks. Standardized to `"completed"`
- **Medium** — `react-loop.js`: `endTrace` checked `state.status === "complete"` after rename, recording successful runs as `"error"`. Updated to `"completed"`

**Deep System Bug Audit Round 6 (4 bugs fixed — 1H + 3M):**
- **High** — `tool-definitions.js`: `plan.update` and `plan.list` used `planId` directly in path without sanitization — `../` in planId allowed directory traversal. Added sanitization + `pathTraversal` guard
- **Medium** — `mcp/server.js`: MCP `run_agent` timeout timer never cleared after `Promise.race` — 2-minute timer leaked after agent completed. Added `clearTimeout`
- **Medium** — `metrics-panel.tsx`: `fetch("/api/metrics")` had no `AbortController` — in-flight requests continued after unmount, calling `setState` on unmounted component. Added abort on cleanup
- **Medium** — `tool-definitions.js`: delegate context trim `splice` assumed `messages[1]` was always `assistant` — could throw `TypeError` after prior splices. Added optional chaining + pair-preservation

### V2.7.1 Bug Fixes (10 Critical + 17 High + 19 Medium + 7 Low + 3 CI)

**Dashboard Security Hardening (Post-release):**
- **CSP Headers**: `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` via `next.config.js`
- **API Proxy Whitelist**: `isPathAllowed()` blocks non-whitelisted paths (`admin/*`, `secrets/*`, etc.) with 403
- **WS Auth**: Client sends token via `Sec-WebSocket-Protocol: aiyu-token.<key>` instead of query param; server `handleProtocols` selects subprotocol
- **Input Validation**: `validateInput()` / `validateIdentifier()` in `use-websocket.ts` guards `sendRun`, `sendIntervene`, `sendChatCreate`, `sendChatSend`
- **Component Refactoring**: `page.tsx` 479→160 lines — extracted `DashboardHeader`, `RunPanel`, `ResetDialog` components
- **Test Suite**: Jest + React Testing Library (29 tests, 4 suites) + Playwright E2E (9 specs) — API proxy, input validation, component rendering

**Dashboard Integration (2 Critical + 3 High + 2 Medium):**
- **Critical**: WS client no API key token (auto `?token=` injection), `sensitiveRouteAuth` blocks Docker network (server-side API proxy with auth)
- **High**: Docker port mapping `3001:3000` → `3001:3001`, `NEXT_PUBLIC_WS_URL` build-time embedding, Next.js rewrite no auth forwarding (API route proxy)
- **Medium**: Dashboard missing `sendChatCreate`/`sendChatSend`, `/agents/statuses` missing ISO `timestamp` field

**Server-side (8 Critical + 14 High + 17 Medium + 5 Low + 3 CI):**
- **Critical**: WS run/chat timeout doesn't cancel agent execution (AbortController), agent-loader `isValidAgentName` path traversal, WS timeout timer leak, agent.delegate missing `_runId`, failover `.filter()` mutation, handoff catch `ReferenceError`, WS disconnect doesn't cancel running agent (activeRuns Map), PENDING_INTERVENTIONS mutable Map export (read-only snapshot)
- **High**: `wsApiKeyAuth` crashes on malformed URL, prompt-builder hardcodes tool list, usage.js atomic write, search-tools async, chat-session intervention, `AIYU_ENABLE_MOCK` not set in tests, context trim pair mismatch, chat tool timeout/abort, Claude Content-Length, intervene WS fallback, chat lastActivity timing, `/agents/statuses` crash on ws require fail, jobs.js no input length validation, packager bin/run.js path traversal, plugin.js `--ignore-scripts`, agent-loader no file size limit (200KB)
- **Medium**: Handoff WS broadcast fallback, Claude system message merge, request-queue `timeout=0`, chat context limit, circuit breaker leak, tracing idle leak, cache key collision, tracing recursion → setImmediate, queue job deletion, safeWrite temp cleanup, grep early match limit, _broadcast error handling, SKILL.md size limit, Ollama health check, sandboxExec env secret leak, cache not true LRU (lastAccess), retry no jitter, validator secret scan too narrow (recursive), config symlink fallback no warning, prompt-builder heading overflow, test.js watch timer no unref
- **Low**: ws.js Map accessor functions, health-check GET for Ollama, config.json try/catch, chatSessions read-only, memory pathTraversal, callMock UTF-8 slice, usage.js stale .tmp file, health-check agent GC pressure, dev hardcodes mock (`--provider` flag), compliance hardcodes agent name, search-tools SKIP_DIRS

---

## ✨ What's New in V2.6

V2.6 brings **module decomposition** and **reliability hardening** — breaking the two largest god modules into focused, maintainable files while preserving full backward compatibility.

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

V2.5 brings **Claude Design-inspired** capabilities to the Aiyu MultiAgent platform, enabling real-time agent collaboration, external API access, and smarter project-aware AI automation. This release adds 9 major features and fixes 31 bugs for improved reliability.

**V2.5.1** adds 25 system-audit bug fixes (6C+7H+12M):

- Per-provider circuit breaker keys (`llm:openai`, `llm:claude`) with `callLLMWithFailover()`
- Rate limit hard cap (200 entries) + X-Forwarded-For spoofing fix (`AIYU_TRUST_PROXY`)
- `search.grep` lastIndex reset, chat session failover + 30-min TTL
- Handoff bundle persistence + project-scoped path, cache freeze-on-fallback
- LLM retry off-by-one fix, Ollama https transport, usage flush on exit
- CORS origin config (`AIYU_CORS_ORIGIN`), fs.glob brace alternation escape

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
- **🔒 Safety & Security** — Path traversal protection, sandboxed execution, secret scanning, and permission-based skill installation
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

aiyu-multi-agent dev                         # Dev REPL (mock provider)
aiyu-multi-agent dev --provider openai       # Dev REPL with real LLM
aiyu-multi-agent dev --verbose               # Dev REPL with step logging

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
| **Mock** | `AIYU_ENABLE_MOCK=1` | Canned responses | Testing, CI/CD pipelines, development without API keys |

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

### 🌐 Web Search Providers (`web.search`)

`web.search` supports multiple providers configured via `.agent/config.yaml`:

```yaml
webSearch:
  provider: youcom # searxng | serper | tavily | youcom
  # Optional for You.com Search API (100 free searches/day without key)
  apiKey: ${YDC_API_KEY}
  # Optional for searxng
  baseUrl: http://localhost:8080
```

You.com provider uses `GET https://api.you.com/v1/agents/search` and maps web/news results into the standard `{ title, url, snippet }` output shape.

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
│   │   ├── agent-runtime.js     # Re-export (V2.6 decomposed)
│   │   ├── react-loop.js        # ReAct loop + tool calling + timeout
│   │   ├── chat-session.js      # Interactive chat + timeout
│   │   ├── failover.js          # Per-provider circuit breaker + failover
│   │   ├── cache.js             # LRU cache
│   │   ├── agent-loader.js      # Agent spec + skill loading
│   │   ├── prompt-builder.js    # System prompt construction
│   │   ├── input-sanitizer.js   # Input validation + injection detection
│   │   ├── tool-parser.js       # Tool call parsing
│   │   ├── tool-registry.js     # Re-export (V2.6 decomposed)
│   │   ├── tool-definitions.js  # Tools + schemas + registry
│   │   ├── search-tools.js      # Grep + Glob
│   │   ├── command-parser.js    # Shell arg parse + ReDoS-safe
│   │   ├── llm-providers.js     # OpenAI, Claude, Ollama, Mock + retry
│   │   ├── circuit-breaker.js   # Prevents cascade LLM failures
│   │   ├── request-queue.js     # Concurrency control + backpressure
│   │   ├── tracing.js           # Distributed tracing (OTel export)
│   │   ├── health-check.js      # System + Ollama health status
│   │   ├── config.js            # Config loader (.agent/ + .windsurf/)
│   │   ├── plugin.js            # Plugin lifecycle + permission system
│   │   ├── guardrails.js        # Security & safety layer
│   │   ├── usage.js             # Usage stats + Prometheus metrics
│   │   ├── logger.js            # Structured JSON logging
│   │   └── types.d.ts           # TypeScript declarations
│   ├── commands/                # CLI command handlers
│   ├── test/                    # Test runner + compliance + unit tests
│   ├── mcp/                     # MCP server + tools
│   └── publish/                 # Packager + validator + registry
├── templates/                  # Agent + skill scaffolds
├── docs/                       # Architecture, runtime spec, roadmap, usage
├── .windsurf/                  # 84 Agents, 46 Skills, 78 Workflows, 10 Rules
└── aiyu-multi-agent-dashboard/ # Real-time monitoring dashboard (Next.js 14)
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
| **Env Leak Prevention** | Secret protection | Strips `API_KEY` / `TOKEN` / `SECRET` / `PASSWORD` from child process `env` regardless of env source |
| **Secret Scanning** | Pre-publish safety | Detects leaked keys on `publish`. Blocks with `--strict`. Recursive scan of all `.md`, `.yaml`, `.json` files for `ghp_`, `sk-`, `AKIA` |
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

Skills add new capabilities — database helpers, cloud APIs, testing frameworks, and more. Each skill declares its required permissions, and you approve before installation. npm install uses `--ignore-scripts` for safety.

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
