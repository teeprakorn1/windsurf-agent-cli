# CODEBASE.md — Aiyu MultiAgent V2.7.7

## Version History

### V2.7.7 (2026-05-19) — Cursor IDE Full Support

**v2.7.7** adds first-class Cursor IDE support via a new generator that converts `.windsurf/` artifacts into Cursor-native `.cursor/rules/*.mdc` rules and `.cursor/commands/*.md` slash commands. Coexists with `.windsurf/` — no breaking changes.

**New Module:**
- `lib/commands/cursor-generator.js` (NEW) — `generate(projectRoot, opts)` orchestrator + converters: `convertAgent`, `convertSkill`, `convertWorkflow`, `convertDomainRule`, `convertAlwaysRule`, `convertMcpConfig`, `convertProjectOverview`. Helper `extractDescription()` walks markdown body skipping code fences/tables/lists, prefers blockquote taglines, synthesizes from `keywords` as fallback. `buildCursorFrontmatter()` emits valid YAML with proper escaping. `DOMAIN_GLOB_MAP` provides heuristic globs per domain rule (code-quality → `**/*.{js,ts,py,go,rs,...}`, api-design → `**/api/**`, security → `**/auth/**` + `**/*.env*`, etc.)

**CLI Integration:**
- `bin/cli.js` — Added `--cursor-only`, `--cursor`, `--force` flags to `init` command
- `lib/commands/init.js` — `runCursorOnly(projectDir, opts)` short-circuit for `--cursor-only`; `--cursor` flag triggers generation alongside Windsurf/.agent during regular init. Source resolution: prefer existing `.agent/`/.windsurf/, fallback to package `.windsurf/`
- `lib/commands/init-inline.js` — Wired new flags through `cmdInit`

**Mapping Strategy:**
| Source | Destination | Cursor Rule Type |
|---|---|---|
| `.windsurfrules` | `.cursor/rules/00-project-overview.mdc` | `alwaysApply: true` |
| `.windsurf/rules/GEMINI.md` | `.cursor/rules/01-gemini-protocol.mdc` | `alwaysApply: true` |
| `.windsurf/rules/<domain>.md` | `.cursor/rules/domain/<name>.mdc` | Auto-Attached (globs) |
| `.windsurf/agents/<name>.md` | `.cursor/rules/agents/<name>.mdc` | Agent-Requested |
| `.windsurf/skills/<name>/SKILL.md` | `.cursor/rules/skills/<name>.mdc` | Agent-Requested |
| `.windsurf/workflows/<name>.md` | `.cursor/commands/<name>.md` | Slash command |
| `.windsurf/mcp_config.json` | `.cursor/mcp.json` | Direct copy |

**Tests:**
- `lib/test/unit/cursor-generator.test.js` (NEW) — 23 unit tests: frontmatter parsing, description extraction (code fence/table/list/blockquote handling), all converters, idempotency (`force` flag), and full `generate()` integration with minimal `.windsurf/` source
- 101 total tests passing (41 core + 25 production + 23 cursor + 12 integration)

**Generated in Repo:** 140 `.mdc` files (84 agents + 45 skills + 9 domain + 2 root), 78 commands, 1 mcp.json — all with valid YAML.

### V2.7.6 (2026-05-18) — Groq Provider + Frontmatter Task Runner

**v2.7.6** ports two features from FrameHandsomez's `agents-bot` POC (Sprint 1 of agents-bot integration):

**Groq Provider (5th LLM provider):**
- `lib/core/llm-providers.js` — `callGroq()` mirrors `callOpenAI` (keep-alive, 1MB cap, retry/backoff). OpenAI-compatible API at `api.groq.com/openai/v1/chat/completions`. Default model `llama-3.3-70b-versatile`, configurable via `GROQ_MODEL`. Free tier 14,400 req/day at console.groq.com
- `lib/core/failover.js` — Failover chain: `openai → claude → groq → ollama → mock`. `resolveProvider()` priority puts Groq after Claude. `buildFailoverChain()` filters out Groq when `GROQ_API_KEY` unset
- `lib/core/health-check.js` — Reports Groq as `configured`/`not_configured`. `hasAnyProvider` includes Groq
- `lib/commands/init.js` — Adds Groq to provider choice list + auto-detect from env

**Frontmatter Task Runner:**
- `lib/commands/run-from-file.js` (NEW) — `parseNoteFile()` parses YAML frontmatter + body. `runFromFile()` validates path traversal, file size (1MB cap), agent name, maxSteps (1-50). CLI flags override frontmatter values
- `bin/cli.js` — Registers `run-from-file <path>` command
- `lib/api/server.js` — `POST /agents/run-from-note` endpoint (auth via `sensitiveRouteAuth`, enqueues to request queue, 202 response). Reuses `parseNoteFile` from CLI module
- Frontmatter fields: `agent`, `provider`, `model`, `maxSteps`, `outputFormat`, `priority` (reserved)

**Tests:** 12 new unit tests (41 total in core.test.js, 78 total across all suites, 0 failures)

### V2.7.5 (2026-05-12) — Dashboard ChatPanel Refactoring

**v2.7.5** refactors the dashboard's monolithic `chat-panel.tsx` (1026 lines) into 5 focused sub-components, reducing it to 599 lines (-42%). No behavioral changes — only code organization.

- `chat-sidebar.tsx` (177 lines) — Sidebar tabs, session search/listing, monitor panels
- `chat-history-panel.tsx` (240 lines) — History view with stats, search, groupings, expand/collapse
- `chat-message-bubble.tsx` (139 lines) — Message bubble with markdown, steps, handoffs, copy
- `session-header.tsx` (84 lines) — Agent info, provider select, token/streaming badges
- `chat-input-area.tsx` (76 lines) — Textarea input, send/clear buttons, keyboard hints

All sub-components use explicit prop interfaces with no Zustand store access. Build passes (`tsc --noEmit`, `next build`), 18/18 Jest tests pass.

### V2.7.4 (2026-05-11) — Chat Mode Agent Status Broadcast

**v2.7.4** fixes a high-severity bug where Chat mode did not broadcast `agent.status` WebSocket events, causing the dashboard's `AgentStatusPanel` to show "No agents running" during active chat sessions. Also fixes `ExecutionTimeline` and `LogsViewer` showing no data during chat sessions.

- **High**: Chat mode does not broadcast `agent.status` — `handleChatCreate` and `handleChatSend` in `ws.js` did not call `setAgentStatus()`. Added status broadcasts at session creation (`"idle"`), chat send start (`"running"`), and chat send completion (`"completed"`/`"error"`). Now both Run and Chat modes update `AgentStatusPanel` in real-time (`lib/api/ws.js`)
- **High**: ExecutionTimeline empty during chat sessions — only read from `runs`/`completedRuns`. Fixed by merging `chatSteps`/`chatCompletions` into timeline data (`execution-timeline.tsx`)
- **High**: LogsViewer empty during chat sessions — same root cause. Fixed by including chat data in log entries (`logs-viewer.tsx`)
- **High**: InterventionPanel shows "No active runs" during chat — only checked `runs`/`completedRuns`. Fixed by detecting active chat sessions from `chatSteps`/`chatCompletions` (`intervention-panel.tsx`)

### V2.7.3 (2026-05-08) — React Strict Mode WS Fix + Dashboard Chat Upgrade

**v2.7.3** fixes a critical WebSocket bug, upgrades the dashboard to a split layout with a full-featured chat panel, adds markdown rendering, fixes dropdown overflow bugs, and filters providers based on backend configuration.

- **Critical**: WebSocket disconnects immediately in React Strict Mode — deferred close pattern + stale WS guard in all handlers (`aiyu-multi-agent-dashboard/src/lib/use-websocket.ts`)
- **High**: Markdown not rendered in Execution Timeline, Agent Status, Logs — replaced `<p>`/`<pre>` with `MarkdownRenderer` (`execution-timeline.tsx`, `agent-status-panel.tsx`, `logs-viewer.tsx`)
- **High**: Global Enter handler conflicts with Chat textarea — global handler now only triggers on `Ctrl/Cmd+Enter` (`page.tsx`)
- **High**: Agent Status Panel hover flickers in dark mode — added `dark:border` and `dark:hover:border` variants (`agent-status-panel.tsx`)
- **Medium**: Dropdown menus clipped by parent overflow — removed `overflow-hidden`, raised z-index to `z-[999]` (`chat-panel.tsx`, `agent-select.tsx`, `provider-select.tsx`)
- **Medium**: AgentSelect dropdown hidden behind ProviderSelect — removed `z-50` from wrappers (`agent-select.tsx`, `provider-select.tsx`)
- **Medium**: ProviderSelect shows unavailable providers — filter now includes `"configured"` and `"ok"` statuses, defaults `availableProviders` to `["mock"]`, auto-switches to `mock` if selected provider unavailable, applied to both `RunPanel` and `ChatPanel` (`chat-panel.tsx`, `page.tsx`, `run-panel.tsx`, `provider-select.tsx`)
- **Added**: `react-markdown` + `remark-gfm` dependencies missing from v2.7.2
- **Added**: Mock provider returns markdown-formatted responses (`lib/core/llm-providers.js`)
- **Added**: Chat auto-create session on Enter with pending message queue (`chat-panel.tsx`)
- **Added**: Provider filtering from `/api/health` endpoint, auto-switch to `mock` if unavailable, applied to `RunPanel` + `ChatPanel` (`provider-select.tsx`, `chat-panel.tsx`, `run-panel.tsx`, `page.tsx`)
- **Added**: Chat UX upgrade — scroll-to-bottom button, bouncing dots typing indicator, sender name + timestamp, hover copy on assistant messages, token usage in session header (`chat-panel.tsx`)
- **Added**: Session sidebar search/filter, message count per session (`chat-panel.tsx`)
- **Added**: Avatar detail dialog (agent/user), agent info popup in session header with resolved provider/model (`chat-panel.tsx`)
- **Changed**: Split layout — left sidebar (420px) for dashboard, right panel (flex-1) for chat (`page.tsx`)
- **Changed**: Chat panel rewrite — session sidebar, inline steps, handoff viz, intervention bar (`chat-panel.tsx`)
- **Changed**: New Chat dropdown with Agent/Provider selection (`chat-panel.tsx`)

### V2.7.2 (2026-05-07) — Mock Provider Default + Core Logic Bug Audit

**v2.7.2** makes `mock` the default provider when no API keys are configured, eliminating the "No LLM provider detected" error on `init`. A warning is shown so users know they're in mock mode.

- **Critical**: init no longer requires API keys — falls back to `mock` provider with warning
- **High**: failover chain accepts `mock` without requiring `AIYU_ENABLE_MOCK`
- **High**: health-check reports `mock: enabled` instead of `limited`

**System-Wide Bug Audit (3 Critical + 3 High + 1 Medium fixed):**
- **Critical**: `react-loop.js` tool timeout timer never cleared after `Promise.race` — wrapped in `try/finally` with `clearTimeout(toolTimer)` to prevent memory leak under high tool-call load
- **Critical**: `chat-session.js` same tool timeout leak pattern — fixed with matching `try/finally` + `clearTimeout`
- **Critical**: `health-check.js` dead ternary `hasAnyProvider ? "ok" : "ok"` — changed to `"not_configured"` with actionable message when no LLM keys are set
- **High**: `failover.js` `isAnyLlmAvailable()` hardcoded `"openai"` starting point — now uses `resolveProvider()` for correct failover chain
- **High**: Dashboard API proxy `agents/` prefix allowed `agents/intervene` — added `BLOCKED_SUBPATHS` set to block sensitive endpoints
- **Medium**: `failover.js` `_isOllamaLikelyAvailable` returned `true` for `openai`/`claude` — changed `default` to `false` for semantic correctness

**Core Logic Bug Audit (4 Critical + 5 High + 2 Medium fixed):**
- **Critical**: `var` → `let` in `react-loop.js` and `chat-session.js` — function-scoped `var result` leaked tool results across iterations; changed to block-scoped `let`
- **Critical**: `circuit-breaker.js` `cleanupStaleBreakers` deleted active breakers — `lastFailureTime` not cleared on HALF_OPEN→CLOSED recovery; added `lastFailureTime = null` in `recordSuccess`
- **Critical**: `health-check.js` Ollama probe ran without `OLLAMA_HOST` — 2s timeout delay on every check; wrapped inside `if (process.env.OLLAMA_HOST)`
- **Critical**: `chat-session.js` `chatTimeoutId` leaked on normal exit — timer kept running after ReAct loop break; added `clearTimeout(chatTimeoutId)`
- **High**: `failover.js` used `indexOf` inside loop — changed to `for (let i = 0; ...)` with index-based last-provider check
- **High**: `llm-providers.js` `callClaude` didn't receive resolved model — changed to `callClaude(messages, { ...options, model })`
- **High**: `request-queue.js` job timeout race — added `settled` flag guard in `_executeJob`
- **High**: `health-check.js` queue error message vague — changed to `Queue health check failed: ${err.message}`
- **High**: `handoff.js` naive `includes("decided")` — changed to sentence-boundary regex for decision extraction
- **Medium**: `cache.js` `Object.freeze` on fallback copy — prevented `_fromCache` mutation; changed to mutable shallow copy
- **Medium**: `circuit-breaker.js` `halfOpenMaxAttempts` default 1→3 — single probe was too aggressive for recovery

**Deep System Bug Audit Round 3 (3 Critical + 4 High + 1 Medium fixed):**
- **Critical**: `react-loop.js:204` tool result `let result` scoped inside `try` block — inaccessible after `Promise.race`, making all tool results `undefined`. Moved declaration before `try`
- **Critical**: `chat-session.js:170` same tool result scoping bug — `let result` inside `try` was `undefined` outside. Moved declaration before `try`
- **Critical**: `tool-definitions.js:317` delegate timeout timer never cleared after `Promise.race` — memory leak. Added `clearTimeout(delegateTimeoutId)`
- **High**: `health-check.js:93` `_ollamaAgent.destroy()` on every successful Ollama check — removed; only destroy on error
- **High**: `tracing.js:250` p95 percentile index off-by-one — `floor(n*0.95)` → `floor((n-1)*0.95)`
- **High**: `tool-definitions.js:727` `executeToolIsolated` leaked API keys to child process — added sensitive env var stripping
- **High**: `llm-providers.js:10-11` keep-alive agents never destroyed on shutdown — added `destroyAgents()` + `process.on("exit")`
- **Medium**: `handoff.js:147,168` `broadcastHandoffComplete` passed `.length` numbers instead of arrays — changed to pass `bundle.artifacts` and `bundle.pendingTasks`

**Core Logic Bug Audit Round 2 (4 Medium fixed):**
- **Medium**: `failover.js` `_ollamaLastOk` shared state — documented single-process Node.js assumption
- **Medium**: `react-loop.js` context trimming broke tool-call/result pairs — dropped only 2 messages leaving orphaned results; changed to drop assistant + ALL consecutive user messages together
- **Medium**: `chat-session.js` sliding window split tool-result pairs — added pair-preservation: if window starts with `user` message, include preceding `assistant` message
- **Medium**: `llm-providers.js` `isRetryableError` matched partial strings — `"429"` matched `"1429"`; changed to word-boundary regex (`\b429\b`, `\btimeout\b`, etc.)

### V2.7.1 (2026-05-07) — Bug Fix Release

**Dashboard Integration Fixes (2 Critical + 3 High + 2 Medium):**
- **Critical**: WS client no API key token (auto `?token=` from `NEXT_PUBLIC_API_KEY`), `sensitiveRouteAuth` blocks Docker network (server-side API proxy with `x-api-key` injection)
- **High**: Docker port `3001:3000` → `3001:3001`, `NEXT_PUBLIC_WS_URL` build-time embedding (was `AIYU_WS_URL`), Next.js rewrite no auth forwarding (replaced with API route proxy)
- **Medium**: Dashboard missing `sendChatCreate`/`sendChatSend`, `/agents/statuses` missing ISO `timestamp` field
- **Added**: Server-side API proxy route (`/api/[...path]`), `NEXT_PUBLIC_API_KEY` env for WS auth
- **Changed**: Removed `/api/metrics` static proxy, removed Next.js rewrites, `docker-compose.yml` port + env fixes

**Dashboard Security Hardening (Post-release):**
- **CSP Headers** — `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` via `next.config.js`
- **API Proxy Whitelist** — `isPathAllowed()` blocks non-whitelisted paths (`admin/*`, `secrets/*`, etc.) with 403
- **WS Auth** — Client sends token via `Sec-WebSocket-Protocol: aiyu-token.<key>` subprotocol; server `handleProtocols` selects it
- **Input Validation** — `validateInput()` / `validateIdentifier()` guards `sendRun`, `sendIntervene`, `sendChatCreate`, `sendChatSend`
- **Test Suite** — Jest + RTL (29 tests) + Playwright E2E (9 specs)

**Dashboard Refactoring (Post-release):**
- `page.tsx` 479→160 lines — extracted `DashboardHeader`, `RunPanel`, `ResetDialog`
- `chat-panel.tsx` — native `<select>` → `AgentSelect` + `ProviderSelect` custom dropdowns
- Docker standalone build verified (`output: "standalone"`)

**Round 5 (2 Critical + 5 High + 7 Medium + 5 Low):**
- **Critical**: WS disconnect doesn't cancel running agent (activeRuns Map + abort), PENDING_INTERVENTIONS mutable Map export (read-only snapshot)
- **High**: /agents/statuses crash on ws require fail (try/catch + 503), jobs.js no input length validation (MAX_INPUT_LENGTH), packager bin/run.js path traversal (resolvedDest guard), plugin.js npm install runs scripts (--ignore-scripts), agent-loader no file size limit (MAX_AGENT_FILE_SIZE 200KB)
- **Medium**: sandboxExec env secret leak with options.env (always strip), cache not true LRU (lastAccess tracking), retry no jitter (+random*1000), validator secret scan too narrow (recursive scanDir), config symlink fallback no warning (logger.warn), prompt-builder heading overflow (headingOffset param), test.js watch timer no unref (watchTimer.unref)
- **Low**: usage.js stale .tmp file (pre-write cleanup + guardrails periodic), health-check agent GC pressure (reuse+destroy), dev hardcodes mock (--provider flag), compliance hardcodes agent name (resolveComplianceAgent), search-tools SKIP_DIRS for build artifacts

**Round 4 (2 Critical + 5 High + 7 Medium + 4 Low):**
- **Critical**: WS timeout timer leak (clearTimeout in catch), agent.delegate missing _runId for broadcast
- **High**: context trim pair mismatch, chat tool timeout/abort check, Claude Content-Length header, intervene WS fallback, chat lastActivity timing
- **Medium**: tracing recursion → setImmediate, queue job deletion safety, safeWrite temp file cleanup, grep early match limit, _broadcast error handling, SKILL.md size limit (100KB), Ollama health check no keep-alive
- **Low**: config.json try/catch, chatSessions read-only export, memory.save/load pathTraversal, callMock UTF-8 safe slice

**Round 3 (2 Critical + 6 High + 5 Medium + 2 Low):**
- **Critical**: WS timeout AbortController cancellation, agent-loader `isValidAgentName` path traversal
- **High**: wsApiKeyAuth malformed URL crash, prompt-builder dynamic tool list, usage.js atomic write, search-tools async `fs.promises`, chat-session intervention support
- **Medium**: handoff WS broadcast fallback, Claude system message merge, request-queue timeout=0 falsy check, chat context limit during tool execution
- **Low**: ws.js Map accessor functions, health-check GET for Ollama

**Rounds 1-2 (2 Critical + 3 High + 5 Medium + 3 CI):**
- **Critical**: failover `.filter()` mutation (duplicate/skip providers), handoff catch `ReferenceError`
- **High**: `AIYU_ENABLE_MOCK` not set in tests, `agent.delegate` no context limit (OOM), chat no timeout
- **Medium**: circuit breaker leak, tracing idle leak, cache key collision, WS errors silently dropped
- **3 CI**: mock env var + status mismatch in integration/compliance tests

### V2.7.0 (2026-05-07) — Dashboard Release

- **Dashboard** — Next.js 14 real-time monitoring (`aiyu-multi-agent-dashboard/`)
- **Monorepo** — Dashboard merged into main repo as subdirectory (previously separate repo)
- **Features** — Agent Status, Execution Timeline, Intervention, Interaction Map, Memory Viewer, Metrics, Logs
- **P3 Polish** — Dark mode, export trace, keyboard shortcuts, WS auto-reconnect, mobile responsive
- **WS Schema** — `docs/WS-SCHEMA.md` (6 client→server, 10 server→client, 5 planned)
- **Broadcasts** — `agent.status`, `handoff.started/complete`, `delegate.started/complete`
- **Docker** — `aiyu-dashboard` service on port 3001
- **11 Bug fixes** — path traversal, timer leak, Ollama deprioritize, sensitiveRouteAuth, etc.

### V2.6.0 (2026-05-06) — Module Decomposition + Reliability Hardening

- **Decomposition** — `agent-runtime.js` (843→69+8 modules), `tool-registry.js` (543→3 modules)
- **Karpathy Principles** — 4 behavioral rules across 84 agents + 10 locations
- **Quality Audit** — 84/84 clean-code, 84/84 Interaction Maps, frontend-specialist 26KB→11KB
- **19 Bug fixes** — Round 1 (2C+5H+4M), Round 2 (3C+3H+2M)
- **8 API Hardening** — WS maxPayload, heartbeat, timeout, sensitiveRouteAuth, security headers, keep-alive

### V2.5.1 (2026-05-06) — System Audit

- **25 Bug fixes** (6C+7H+12M) + 4 pre-existing test fixes
- Per-provider circuit breaker, rate limit cap, SSRF fix, chat failover, handoff persistence

### V2.5.0 — Claude Design Features

- WebSocket streaming, handoff bundles, fetch.url, inline intervention, agent system auto-apply
- 16 bug fixes (5C+6H+5M)

### V2.4.2 — CI Fix

- 98 bugs fixed across 4 audit rounds

## System Overview

AI Agent Platform — Smart Init, Plugin System, Agent Testing, and Publishing.

### V2.4.1 — Bug Fix Release

- 98 bugs fixed across 4 audit rounds (45 + 16 + 22 + 15)
- API /jobs null crash + max_steps validation, shell.exec path.basename pre-check
- ReDoS protection, truncateResult deep clone, glob regex metacharacter escaping
- Circuit-breaker successCount reset + removeBreaker, secret scanning in publish

### V2.4.0 — HTTP API + Docker

- HTTP API (Express), MCP Server, security hardening, Docker support

### V2.2 — Production Upgrade

- Circuit breaker, request queue, distributed tracing, health check
- Structured logging, Prometheus metrics, context size limits, integration tests

## Architecture V2

```
┌─────────────────────────────────────────┐
│           CLI (Commander.js)            │
│  bin/cli.js — windsurf <command>        │
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
│   chat.js      — aiyu-multi-agent chat       │
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
- `lib/core/agent-runtime.js` — **Re-export** (V2.6): thin re-export of decomposed modules for backward compatibility. All `require("./agent-runtime")` calls work unchanged.
- `lib/core/react-loop.js` — ReAct loop execution (`runAgent`, **accepts AbortSignal for timeout cancellation**, **passes _runId to tool args for WS broadcast tracking**), per-provider failover, tracing, context trimming (**null/break-safe pair eviction**), output format enforcement, **Karpathy large-change guardrail** (fs.write/fs.edit >5KB triggers surgical change warning)
- `lib/core/chat-session.js` — Interactive chat (`createChatSession`, **accepts maxSteps override**, **intervene() method for mid-turn feedback**, **signal support for timeout cancellation**, **chatTimedOut/signal checks after tool Promise.race**), sliding window, char-based context limit, step records
- `lib/core/failover.js` — Per-provider circuit breaker (`llm:openai`, `llm:claude`, `llm:local`, `llm:mock`) with `callLLMWithFailover()` chain (**loop-index based last-provider check** instead of indexOf) + `isAnyLlmAvailable()` check
- `lib/core/cache.js` — LRU cache (100 entries, 5min TTL, deep-copy-on-read, **mutable shallow copy fallback** for circular refs (was Object.freeze — broke `_fromCache` mutation))
- `lib/core/agent-loader.js` — Load agent specs (frontmatter parsing, runtime spec version enforcement, **isValidAgentName path traversal validation**) + skill instructions (**MAX_SKILL_FILE_SIZE=100KB with truncated read for oversized files**)
- `lib/core/prompt-builder.js` — Build system prompts (agent spec + skills + project profile + guardrails + **Karpathy Behavioral Rules**), section-aware skill truncation (MAX_SKILL_INSTRUCTION_CHARS=8000), **dynamic tool list from registry** (no hardcoded tools)
- `lib/core/input-sanitizer.js` — Input validation (100K char limit) + heuristic prompt injection detection
- `lib/core/tool-parser.js` — Parse tool calls from LLM responses (4 strategies: API structured → TOOL_CALL regex → JSON blocks → final answer), balanced-depth paren parser
- `lib/core/tool-registry.js` — **Re-export** (V2.6): thin re-export of decomposed tool modules for backward compatibility
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

### Runtime Correctness
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

### Production (V2.2)
- **Circuit Breaker**: LLM calls protected by **per-provider** circuit breaker (`llm:openai`, `llm:claude`, `llm:local`, `llm:mock`) with failureThreshold=5, resetTimeout=30s. Prevents cascade failures when a single provider is down without blocking other providers. `callLLMWithFailover()` iterates provider chain, skipping OPEN breakers. `isAnyLlmAvailable()` for API-level pre-check. Applied in both `runAgent` and `createChatSession`
- **Request Queue**: Concurrency control (default 5 concurrent, 100 queue). Priority ordering, job timeout (5min), backpressure (QUEUE_FULL error), metrics tracking. `destroy()` clears all timers for clean shutdown
- **Distributed Tracing**: Every agent run and chat turn gets a traceId. Spans for each step and tool call. OpenTelemetry export format. Trace metrics (avg/p95 duration). Stored in-memory (max 500 traces, 30min TTL)
- **Health Check**: `aiyu-multi-agent health` — liveness, readiness, component-level checks (config, memory, queue, breakers, LLM providers with status+message). JSON output with --json. Config not_configured → not_ready; LLM not_configured → limited. Icon recognizes 'healthy' status
- **Traces CLI**: `aiyu-multi-agent traces` — view recent traces, specific trace details, trace metrics, OpenTelemetry export
- **Structured Logging**: JSON log format via LOG_FORMAT=json env var. Meta field for structured context. setJsonOutput() API
- **Prometheus Metrics**: `usage.formatPrometheusMetrics()` — gauge format for aiyu_* metrics (agent_runs, total_commands, error_rate, etc.)
- **Context Size Limit**: MAX_CONTEXT_CHARS=200000 (~50k tokens). Prevents memory overflow from unbounded context growth. Applied in both runAgent and chat session. Trim preserves last 10 messages (~5 exchanges)
- **Step Duration**: `duration_ms` now includes LLM response time (stepStart measured before LLM call)

### Security (V2.1)
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

## Dashboard (v2.7.0)

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

### Features by Phase

- **P0 (Core)**: Agent Status, Execution Timeline, Intervention, Run Input
- **P2 (Enhanced)**: Interaction Map, Memory Viewer, Metrics Panel, Logs Viewer
- **P3 (Polish)**: Dark Mode, Export JSON, Keyboard Shortcuts (Ctrl+Enter/Esc), Auto-Reconnect, Mobile Responsive

### Connections

- **Dashboard → WS**: Real-time events via `/ws` (agent.status, step, complete, error)
- **Dashboard → HTTP**: Poll `/agents/statuses` for initial state, `/metrics` for stats
- **Dashboard → Export**: Download JSON with runs, completedRuns, agentStatuses
