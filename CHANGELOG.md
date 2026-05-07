# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.7.1] - 2026-05-07

### Fixed — Dashboard Integration Bugs (2 Critical + 3 High + 2 Medium)

**P0 Critical:**
- **WS client doesn't send API key token** — Dashboard `useWebSocket` connected via `new WebSocket(url)` without `?token=` query param. When `AIYU_API_KEY` env var was set, the WS server's `wsApiKeyAuth` rejected all dashboard connections with 401. Added automatic `?token=` query param injection from `NEXT_PUBLIC_API_KEY` env (`aiyu-multi-agent-dashboard/src/lib/use-websocket.ts`)
- **`sensitiveRouteAuth` blocks Docker network** — `/metrics` and `/agents/statuses` endpoints used `sensitiveRouteAuth` which only allowed localhost when no API key was set. In Docker, dashboard → API traffic goes over Docker network (non-localhost IP), causing 403 on all metric/status requests. Replaced Next.js rewrite proxy with server-side API route (`/api/[...path]`) that injects `x-api-key` header from `AIYU_API_KEY` env, bypassing localhost restriction (`aiyu-multi-agent-dashboard/src/app/api/[...path]/route.ts`)

**P1 High:**
- **Docker port mapping mismatch** — `docker-compose.yml` mapped `3001:3000` but Dashboard Dockerfile sets `ENV PORT=3001`. Next.js listened on 3001 inside container but Docker forwarded to container port 3000, making dashboard unreachable. Fixed to `3001:3001` (`windsurf-agent-cli/docker-compose.yml`)
- **`NEXT_PUBLIC_WS_URL` not embedded at build time** — `AIYU_WS_URL` env var was used in `next.config.js` but `NEXT_PUBLIC_*` envs are only inlined during `next build`. Runtime env changes had no effect, causing wrong WS URL after build. Changed Dockerfile and next.config.js to use `NEXT_PUBLIC_WS_URL` as both build arg and env, with `AIYU_WS_URL` as fallback (`aiyu-multi-agent-dashboard/Dockerfile`, `aiyu-multi-agent-dashboard/next.config.js`)
- **Next.js rewrite doesn't forward auth headers** — Old `next.config.js` rewrite `/api/:path*` → API server didn't forward `Authorization` or `x-api-key` headers. When `AIYU_API_KEY` was set, all proxied requests got 401. Removed rewrites, replaced with server-side API route that explicitly adds `x-api-key` (`aiyu-multi-agent-dashboard/next.config.js`, `aiyu-multi-agent-dashboard/src/app/api/[...path]/route.ts`)

**P2 Medium:**
- **Dashboard missing chat WS messages** — `use-websocket.ts` had no `sendChatCreate`/`sendChatSend` functions despite server supporting `chat.create`/`chat.send` and types already defined. Added both functions to hook and return type (`aiyu-multi-agent-dashboard/src/lib/use-websocket.ts`)
- **`/agents/statuses` response missing ISO timestamp** — HTTP endpoint returned `{ status, runId, since }` with `since` as epoch ms, while WS `agent.status` event sent `timestamp` as ISO string. Dashboard merging data from both sources got inconsistent formats. Added `timestamp` ISO field to `getAgentStatuses()` response (`windsurf-agent-cli/lib/api/ws.js`)

### Added — Dashboard Integration

- **Server-side API proxy route** — `src/app/api/[...path]/route.ts` — proxies all `/api/*` requests to Aiyu API with automatic `x-api-key` header injection from `AIYU_API_KEY` env. Supports GET/POST/PUT/DELETE with proper content-type forwarding and 502 on unreachable API
- **`NEXT_PUBLIC_API_KEY` env** — Client-side API key for WebSocket token auth. Set via `NEXT_PUBLIC_API_KEY` build arg in Dockerfile, auto-appended as `?token=` to WS URL

### Changed — Monorepo Migration

- **Dashboard merged into main repo** — `aiyu-multi-agent-dashboard/` moved from separate repo (`github.com/teeprakorn1/aiyu-multi-agent-dashboard`) to subdirectory in main repo. Old repo archived on GitHub
- **`.npmignore`** — Added `aiyu-multi-agent-dashboard/` to exclude dashboard from npm package
- **`.gitignore`** — Added Next.js build artifacts (`.next/`, `out/`, `node_modules/`, `package-lock.json`) for dashboard subdirectory
- **`docker-compose.yml`** — Changed dashboard build context from `../aiyu-multi-agent-dashboard` to `./aiyu-multi-agent-dashboard`

### Changed — Dashboard Integration

- **Removed `/api/metrics` static proxy** — Deleted `src/app/api/metrics/route.ts` (replaced by catch-all proxy route)
- **Removed Next.js rewrites** — `next.config.js` no longer uses `async rewrites()`. All `/api/*` routing handled by server-side route handler
- **`docker-compose.yml`** — `aiyu-dashboard` service: port `3001:3001`, `NEXT_PUBLIC_WS_URL` build arg (browser-accessible URL), `AIYU_API_KEY` env passthrough for server-side proxy auth

### Fixed — Bug Audit 2026-05-07 Round 5 (2 Critical + 5 High + 7 Medium + 5 Low)

**P0 Critical:**
- **WS client disconnect doesn't cancel running agent** — When a WebSocket client disconnected, the agent's ReAct loop continued running indefinitely, wasting LLM tokens and CPU. Added `activeRuns` Map to track `AbortController` per client, abort all runs on `ws.close` event (`lib/api/ws.js`)
- **`PENDING_INTERVENTIONS` exported as mutable Map** — External modules could directly mutate the interventions Map, bypassing validation and timestamp tracking. Changed export from raw Map to `() => new Map(PENDING_INTERVENTIONS)` read-only snapshot, consistent with `chatSessions` export (`lib/api/ws.js`)

**P1 High:**
- **`/agents/statuses` crashes if ws module fails** — `require("./ws")` in route handler had no try/catch. If ws npm package was not installed or module failed to load, unhandled exception crashed the server. Added try/catch with 503 response (`lib/api/server.js`)
- **`jobs.js` doesn't validate input length** — `POST /jobs` only validated input existence, not length. Oversized inputs consumed queue slots before `sanitizeInput` could reject. Added `MAX_INPUT_LENGTH` check at route level (`lib/api/jobs.js`)
- **`packager.js` generated `bin/run.js` has no path traversal protection** — Published agent packages could contain filenames like `../../../.bashrc` that escape `.agent/` during copy. Added `resolvedDest.startsWith(path.resolve(dest))` guard in generated script (`lib/publish/packager.js`)
- **`plugin.js` install doesn't use `--ignore-scripts`** — `npm install` ran package lifecycle scripts (preinstall, install, postinstall), allowing malicious packages to execute arbitrary code. Added `--ignore-scripts` flag to npm install args (`lib/core/plugin.js`)
- **`agent-loader.js` no file size limit on agent `.md`** — `loadAgentSpec` used `fs.readFileSync` without size check. A maliciously large agent file could cause OOM. Added `MAX_AGENT_FILE_SIZE=200KB` with `fs.statSync` pre-check (`lib/core/agent-loader.js`)

**P2 Medium:**
- **`sandboxExec` doesn't strip env secrets when caller provides `options.env`** — Secret stripping only ran when `!options.env`. Caller-provided env with inherited `process.env` keys leaked API keys into child processes. Now always strips regardless of env source (`lib/core/guardrails.js`)
- **`cache.js` LRU eviction not true LRU** — Reading a cache entry didn't update its access time, so frequently accessed entries could be evicted. Added `lastAccess` tracking on read and use it for eviction decisions (`lib/core/cache.js`)
- **`llm-providers.js` retry has no jitter** — Retry delay was deterministic `Math.min(1000 * 2^attempt, 10000)`. Under high concurrency with simultaneous failures, all retries fired at the same instant (thundering herd). Added `+ Math.random() * 1000` jitter (`lib/core/llm-providers.js`)
- **`validator.js` secret scanning only checks agent `.md` files** — Leaked API keys in skill files, workflow files, or `config.yaml` were not detected before publishing. Changed to recursive `scanDir()` that scans all `.md`, `.yaml`, `.yml`, `.json` files under `cfgDir/` (`lib/publish/validator.js`)
- **`config.js` symlink fallback creates divergent directories** — When `fs.symlinkSync` failed, `copyRecursive` created a separate copy. Changes to `.agent/` wouldn't appear in `.windsurf/` with no warning. Added `logger.warn` when fallback is used (`lib/core/config.js`)
- **`prompt-builder.js` skill heading not counted toward truncation** — `truncateSkillContent` limited content to `MAX_SKILL_INSTRUCTION_CHARS` but `buildSystemPrompt` prepended `### name\n` heading before the truncated content, exceeding the limit. Added `headingOffset` parameter to `truncateSkillContent` (`lib/core/prompt-builder.js`)
- **`test.js` watch mode `setInterval` never cleaned up** — Polling interval had no `.unref()` and no cleanup mechanism, keeping the event loop alive unnecessarily. Added `watchTimer.unref()` (`lib/commands/test.js`)

**P3 Low:**
- **`usage.js` `.tmp` file on crash** — If process crashed between `writeFileSync` and `renameSync`, a stale `usage.json.tmp` file remained with no cleanup. Added pre-write stale `.tmp` cleanup in `_syncFlushBuffer` and periodic cleanup in guardrails timer (`lib/core/usage.js`, `lib/core/guardrails.js`)
- **`health-check.js` un-reused HTTP agent per check** — `new transport.Agent({ keepAlive: false })` was created per readiness check without `.destroy()`, causing minor GC pressure in long-running servers. Added agent reuse + destroy after use (`lib/core/health-check.js`)
- **`cli.js` dev command hardcodes `provider: "mock"`** — Dev mode always used mock provider, impossible to test with real LLM. Added `--provider` flag to dev command, defaults to mock for safety (`bin/cli.js`)
- **`compliance.js` hardcodes `agentName: "accessibility-specialist"`** — If this agent didn't exist in test environment, compliance tests failed with confusing error. Added `resolveComplianceAgent()` that dynamically finds first available agent (`lib/test/compliance.js`)
- **`search-tools.js` fallback glob doesn't respect `.gitignore`** — Fallback `fsGlob` walk only skipped `node_modules` and `.git` but not `dist/`, `build/`, `.next/`, etc. Changed to `SKIP_DIRS` Set with common build artifact directories (`lib/core/search-tools.js`)

### Changed — Bug Audit Round 5

- **`agent-loader.js`** — Exported `MAX_AGENT_FILE_SIZE` constant
- **`agent-runtime.js`** — Re-exports `MAX_AGENT_FILE_SIZE` from agent-loader
- **`ws.js`** — Added `activeRuns` Map for per-client run tracking; `PENDING_INTERVENTIONS` export changed from mutable Map to read-only snapshot function

### Fixed — Bug Audit 2026-05-07 Round 4 (2 Critical + 5 High + 7 Medium + 4 Low)

**P0 Critical:**
- **WS handleRun/handleChatSend timeout timer leak** — When `runPromise` or `sendPromise` rejected (not resolved), `Promise.race` jumped to `catch` block, skipping `clearTimeout(timeoutId)`. The timeout timer continued ticking, calling `abortController.abort()` on a completed agent after 5 minutes. Added `clearTimeout` in both catch blocks (`lib/api/ws.js`)
- **agent.delegate missing _runId for WS broadcast** — `react-loop.js` passed `_currentAgent`, `_provider`, `_model` into tool args but not `_runId`, so `agent.delegate` broadcast events had no `runId` for dashboard tracking. Added `_runId: traceId` to toolArgs (`lib/core/react-loop.js`)

**P1 High:**
- **Context trim pair mismatch after splice** — `messages.splice(1, 2)` always dropped index 1+2 as a pair, but after splice the new `messages[1]` might not be `assistant` role, causing mismatched tool-call/result pairs sent to LLM. Added null/break checks before splice (`lib/core/react-loop.js`)
- **Chat tool execution ignores timeout/abort** — `chatTimedOut` flag was only checked at the start of each tool loop iteration. If a tool was mid-execution when timeout fired, `Promise.race` rejected but the tool kept running (no AbortController). Added `chatTimedOut || signal?.aborted` checks after `Promise.race` and in catch block (`lib/core/chat-session.js`)
- **Claude API missing Content-Length header** — `callClaude()` set `Content-Type` but not `Content-Length`, causing issues with some HTTP proxies/load balancers that reject chunked transfer. Added `Content-Length: Buffer.byteLength(body)` header (`lib/core/llm-providers.js`)
- **Intervene API crashes when WS not loaded** — `POST /agents/intervene` called `require("./ws")` without try/catch. In CLI-only mode (no WS), the require succeeded but intervention was silently lost with no error feedback. Added try/catch with 503 response when WS unavailable (`lib/api/handoff.js`)
- **Chat lastActivity updated before execution** — `handleChatSend` set `entry.lastActivity = Date.now()` before `session.send()`, so failed sends got a fresh timestamp preventing TTL cleanup. Moved update to after successful `Promise.race` (`lib/api/ws.js`)

**P2 Medium:**
- **Tracing _flushWriteQueue unbounded recursion** — `finally` block called `_flushWriteQueue()` recursively when queue had new items. Under high throughput, this caused stack overflow. Changed to `setImmediate(_flushWriteQueue)` for iterative scheduling (`lib/core/tracing.js`)
- **Request queue deletes jobs with pending waitFor** — `_finishJob` cleanup deleted oldest jobs regardless of status, potentially removing queued/running jobs that had `waitFor()` promises attached. Changed to only delete completed/failed jobs (`lib/core/request-queue.js`)
- **safeWrite temp file leak on crash** — If process crashed between `writeFileSync` and `renameSync`, orphaned `aiyu-multi-agent-*` temp files accumulated in `/tmp/` with no cleanup. Added periodic cleanup timer (5min interval, deletes files older than 1 hour, `.unref()` to not block exit) (`lib/core/guardrails.js`)
- **search.grep memory spike before truncation** — `matches` array grew unbounded during file scanning, only truncated via `.slice(0, 200)` after the full walk. A regex matching every line could spike memory. Added `if (matches.length >= 200) break` inside the line loop (`lib/core/search-tools.js`)
- **_broadcast uncaught error on client disconnect** — `client.send(payload)` could throw if client disconnected between `readyState` check and `send()`, crashing the process. Added try/catch around each `client.send()` (`lib/api/ws.js`)
- **SKILL.md read has no size limit** — `loadSkillInstructions` used `fs.readFileSync` on SKILL.md without size check. A 10MB+ skill file would consume RAM even though `prompt-builder` truncates to 8000 chars. Added `MAX_SKILL_FILE_SIZE=100KB` with truncated read for oversized files (`lib/core/agent-loader.js`)
- **Ollama health check socket leak** — `health-check.js` used the shared `httpAgent` (keepAlive:true) for Ollama ping, keeping sockets open in long-running servers. Created a fresh `Agent({ keepAlive: false })` for the health check request (`lib/core/health-check.js`)

**P3 Low:**
- **config.json malformed crash** — `loadConfig` used `JSON.parse` without try/catch on `config.json`, crashing the entire config system on malformed JSON. Added try/catch with warning log (`lib/core/config.js`)
- **chatSessions exported as mutable Map** — `ws.js` exported `chatSessions` Map directly, allowing external modules to `.delete()/.clear()` internal state. Changed export to `() => new Map(chatSessions)` (read-only snapshot) (`lib/api/ws.js`)
- **memory.save/load missing pathTraversal guard** — File paths constructed from `agentName` + `key` had no `pathTraversal()` check, relying only on character replacement. Added explicit `guardrails.pathTraversal(filePath, projectDir)` for both save and load (`lib/core/tool-definitions.js`)
- **callMock UTF-8 slice breaks multi-byte chars** — `lastUserMsg.slice(0, 80)` could split a multi-byte UTF-8 character (Thai, CJK), producing replacement characters. Changed to `Array.from(lastUserMsg).slice(0, 80).join("")` for character-aware slicing (`lib/core/llm-providers.js`)

### Fixed — Bug Audit 2026-05-07 Round 3 (2 Critical + 6 High + 5 Medium + 2 Low)

**P0 Critical:**
- **WS run/chat timeout doesn't cancel agent execution** — `Promise.race` with timeout only rejected the promise but the agent's ReAct loop continued running indefinitely, wasting LLM tokens and blocking resources. Added `AbortController` signal propagation: `ws.js` creates `AbortController` and calls `.abort()` on timeout; `react-loop.js` checks `signal?.aborted` at each step and tool iteration; `chat-session.js` accepts `signal` in `send()` and checks it in the ReAct loop and tool execution loop (`lib/api/ws.js`, `lib/core/react-loop.js`, `lib/core/chat-session.js`)
- **agent-loader doesn't validate agentName for path traversal** — `loadAgentSpec()` accepted any string as `agentName` without validation, allowing path traversal characters (`/ \\ : * ? " < > |`) when called as a public API (e.g., MCP, Jobs). Added `isValidAgentName()` validation at the top of `loadAgentSpec()`, reusing the existing utility from `utils.js` (`lib/core/agent-loader.js`)

**P1 High:**
- **wsApiKeyAuth crashes on malformed URL** — `new URL(info.req.url, ...)` in WebSocket auth threw `TypeError` on malformed upgrade requests (e.g., invalid characters), crashing the WS connection handler. Wrapped in `try/catch` with safe 400 rejection (`lib/api/middleware.js`)
- **prompt-builder hardcodes tool list** — `buildSystemPrompt()` listed 13 tools as a hardcoded string, missing any custom/plugin tools registered via `registerTool()`. Replaced with dynamic `toolRegistry.listTools()` + `TOOL_SCHEMAS` descriptions, so plugin tools appear in the system prompt automatically (`lib/core/prompt-builder.js`)
- **usage.js exit handler uses writeFileSync** — `_syncFlushBuffer()` wrote `usage.json` directly with `fs.writeFileSync`, which could leave a truncated file if the process was killed mid-write. Changed to atomic write pattern: write to `.tmp` file first, then `fs.renameSync` for atomic replacement (`lib/core/usage.js`)
- **search-tools uses synchronous file I/O** — `searchGrep` walk function used `fs.readdirSync`/`fs.statSync`/`fs.readFileSync`, blocking the Node.js event loop for seconds on large directories in API server mode. Converted to `fs.promises` (`fsp.readdir`/`fsp.stat`/`fsp.readFile`) for non-blocking async I/O. Same conversion for `fsGlob` fallback walk (`lib/core/search-tools.js`)
- **chat-session doesn't support intervention** — `createChatSession` had no way to inject mid-turn feedback, unlike `runAgent` which checks `state._intervention`. Added `intervene(message)` method on the session object, `_pendingIntervention` state checked at each ReAct step, and wired `handleIntervene` in `ws.js` to call `session.intervene()` for chat sessions (`lib/core/chat-session.js`, `lib/api/ws.js`)

**P2 Medium:**
- **handoff error broadcast when WS not loaded** — `broadcastHandoffComplete` was declared inside `try` block via `require("./ws")`, causing `ReferenceError` in `catch` if WS wasn't loaded. Moved WS require + broadcast resolution before `try` with graceful fallback (noop functions) when WS module unavailable (`lib/api/handoff.js`)
- **Claude API drops multiple system messages** — `callClaude()` used `messages.find(m => m.role === "system")` which only captured the first system message, silently dropping any additional ones (e.g., from intervention injection). Changed to `messages.filter()` + `.join("\n\n")` to merge all system messages into the `system` top-level field (`lib/core/llm-providers.js`)
- **request-queue timeout=0 treated as default** — `options.timeout || this.jobTimeoutMs` coerced `timeout: 0` to the default 5-minute timeout, preventing intentional no-timeout jobs. Changed to `options.timeout !== undefined ? options.timeout : this.jobTimeoutMs` for explicit undefined check. Same fix in `waitFor()` (`lib/core/request-queue.js`)
- **chat-session no context limit during tool execution** — Chat ReAct loop accumulated tool result messages without any context size limit, unlike `react-loop.js` which has `MAX_CONTEXT_CHARS` trimming. Added same `MAX_CONTEXT_CHARS` check after tool execution with oldest-message-pair eviction (`lib/core/chat-session.js`)

**P3 Low:**
- **ws.js exports mutable internal Maps** — `chatSessions` and `PENDING_INTERVENTIONS` Maps were exported directly, allowing external modules to mutate internal state. Added accessor functions (`getChatSession`, `getChatSessions`, `setPendingIntervention`, `getPendingIntervention`) and updated `handoff.js` to use `setPendingIntervention` instead of direct Map access. Legacy exports kept for backward compatibility (`lib/api/ws.js`, `lib/api/handoff.js`)
- **health-check uses HEAD for Ollama** — Ollama's `/api/tags` endpoint returns 405 Method Not Allowed for HEAD requests in some versions. Changed to GET with `res.resume()` to consume response body and free the socket (`lib/core/health-check.js`)
- **`chat.step` event missing `timestamp` field** — `handleChatSend` in `ws.js` sent `chat.step` events without a `timestamp`, causing dashboard to use `Date.now()` fallback instead of server time. Added `timestamp: _isoNow()` to match `step` and `chat.complete` events (`lib/api/ws.js`)

### Fixed — Bug Audit 2026-05-07 Rounds 1-2 (2 Critical + 3 High + 5 Medium + 3 CI)

**P0 Critical:**
- **Failover chain mutation during `.filter()`** — `buildFailoverChain()` used `chain.splice()` + `chain.push()` inside `.filter()` callback, mutating the array during iteration. This caused "local" provider to appear twice and "mock" to be skipped entirely. Replaced with 2-phase approach: pure `.filter()` first, then deprioritize Ollama via splice on the filtered result (`lib/core/failover.js`)
- **Handoff catch block `ReferenceError`** — `broadcastHandoffComplete` was declared with `const` inside the `try` block but referenced in the `catch` block. If the error occurred before the `require("./ws")` line, the catch block threw a `ReferenceError` masking the original error. Moved declarations outside `try` with null check in catch (`lib/api/handoff.js`)

**P1 High:**
- **`AIYU_ENABLE_MOCK` not set in tests** — Production unit test `checkReadiness` and integration/compliance tests expected mock provider to be available, but `AIYU_ENABLE_MOCK` was never set. `buildFailoverChain()` filtered out "mock" when the env var was missing, causing all mock-provider agent runs to fail. Added `process.env.AIYU_ENABLE_MOCK = "1"` to `production.test.js`, `flow.test.js`, and `compliance.js` (`lib/test/unit/production.test.js`, `lib/test/integration/flow.test.js`, `lib/test/compliance.js`)
- **`agent.delegate` no context size limit** — The delegate's ReAct loop accumulated messages without any context size limit, unlike the main `react-loop.js` which has `MAX_CONTEXT_CHARS = 200000`. Long-running delegates with many tool calls could exhaust memory. Added `DELEGATE_MAX_CONTEXT = 100000` with content trimming and oldest-message-pair eviction (`lib/core/tool-definitions.js`)
- **Chat session no overall timeout** — `createChatSession.send()` ran a ReAct loop with `maxChatSteps` but no overall timeout. A slow LLM provider could run indefinitely in CLI mode. Added `CHAT_TURN_TIMEOUT_MS = 300000` (5 minutes) with `chatTimedOut` flag checked each step and tool iteration (`lib/core/chat-session.js`)

**P2 Medium:**
- **Circuit breaker Map never cleaned** — `breakers` Map accumulated entries forever; `removeBreaker()` was never called anywhere. Added `cleanupStaleBreakers()` that removes CLOSED breakers with zero failures and no recent activity (>2x resetTimeoutMs idle), called automatically from `getAllBreakerStatuses()` (`lib/core/circuit-breaker.js`)
- **Tracing Map only cleaned on new trace** — `traces` Map cleanup only ran inside `startTrace()`, leaving stale traces in memory during idle periods. Added periodic cleanup timer (`setInterval` with `.unref()`) that removes expired traces every 30 minutes (`lib/core/tracing.js`)
- **Cache key delimiter collision** — `_cacheKey()` used pipe-delimited string (`input|agentName|...`), which could produce identical keys for different inputs (e.g. input `"a|b"` + agentName `""` = input `"a"` + agentName `"b"`). Changed to `JSON.stringify([components])` for collision-free key generation (`lib/core/cache.js`)
- **WS run errors silently dropped** — When a WebSocket client disconnected before the agent run completed or errored, the result/error was silently dropped with no server-side logging. Added `logger.info`/`logger.warn` for dropped results and errors (`lib/api/ws.js`)

**CI Fixes:**
- **Integration test mock status mismatch** — `flow.test.js` expected `readiness.checks.llmProviders.mock === "available"` but `health-check.js` uses `"enabled"/"disabled"`. Fixed assertion to match actual values (`lib/test/integration/flow.test.js`)

### Changed

- **`chat-session.js`** — Exported `CHAT_TURN_TIMEOUT_MS` constant for module consumers
- **`circuit-breaker.js`** — Exported `cleanupStaleBreakers` function for manual cleanup
- **`ws.js`** — `getAgentStatuses()` now includes `timestamp` ISO field alongside `since` epoch ms

---

## [2.6.0] - 2026-05-06

### Changed — Module Decomposition + Production Hardening

**Module Decomposition (Backward Compatible):**
- **`agent-runtime.js` decomposed** (843 → 69 lines + 8 focused modules) — `react-loop.js` (ReAct loop), `chat-session.js` (interactive chat), `failover.js` (per-provider circuit breaker + failover chain), `cache.js` (LRU cache), `agent-loader.js` (agent spec + skill loading), `prompt-builder.js` (system prompt construction), `input-sanitizer.js` (input validation + prompt injection detection), `tool-parser.js` (tool call parsing from LLM responses). `agent-runtime.js` is now a thin re-export for backward compatibility.
- **`tool-registry.js` decomposed** (543 → 3 modules) — `tool-definitions.js` (builtin tools, schemas, registry, truncation), `search-tools.js` (search.grep + fs.glob), `command-parser.js` (shell arg parsing + ReDoS-safe regex). `tool-registry.js` is now a thin re-export for backward compatibility.

**Production Fixes:**
- **Tracing async write queue** — `_appendTraceToFile()` replaced `fs.appendFileSync` (sync, blocks event loop) with async batched write queue (`fs.promises.appendFile`). Traces are buffered and flushed in batches, preventing event loop stalls under high trace volume.
- **MCP `run_agent` timeout + maxSteps cap** — Added 2-minute timeout and maxSteps cap of 20 for MCP tool calls. Prevents runaway agent execution from blocking MCP clients. Returns `isError: true` on timeout.
- **Usage flush fix** — `process.on("exit", _flushBuffer)` (sync-only, no async) replaced with `process.on("beforeExit")` (allows async) + `_syncFlushBuffer` fallback on forced exit. Prevents data loss on graceful and forced termination.
- **Docker healthcheck fix** — `docker-compose.yml` healthcheck changed from `http.get` to `http.request` with explicit 3s timeout, preventing indefinite hang on unresponsive server.

### Added

- **`aiyu-multi-agent dev` command** — REPL-based dev mode with `--agent`, `--verbose` (per-step tool call logging), and `--trace` (persistent trace output). Runs agent with `noCache: true` and mock provider by default.
- **TypeScript declarations** — `lib/core/types.d.ts` with type definitions for 12 core modules (agent-runtime, circuit-breaker, tracing, guardrails, request-queue, health-check, config, cache, failover, tool-registry, llm-providers, usage).
- **Docker non-root user** — Dockerfile now creates `aiyu` user/group, `chown -R aiyu:aiyu /app`, runs as `USER aiyu`. Includes inline `HEALTHCHECK` directive.
- **Expanded `.dockerignore`** — 8 → 25 entries, excluding `.agent/`, `.windsurf/`, `.env.*`, `*.pem`, `coverage/`, `docs/`, `test/`, etc.
- **Karpathy Behavioral Principles** — Integrated Andrej Karpathy's 4 LLM coding principles into the platform: (1) **THINK FIRST** — state assumptions explicitly, ask when uncertain; (2) **SIMPLICITY** — minimum code that solves the problem, no speculative features; (3) **SURGICAL** — touch only what you must, every changed line traces to user request; (4) **GOAL-DRIVEN** — define success criteria before implementing, write tests first. Applied across 10 locations: `prompt-builder.js` (system prompt behavioral rules), `react-loop.js` (large-change guardrail for fs.write/fs.edit), `clean-code/SKILL.md` (senior engineer + surgical self-checks), `plan-writing/SKILL.md` (Goal-Driven Verification principle), `GEMINI.md` (tradeoff note for trivial tasks), `init.js` (default agent template), **all 84 agent `.md` files** (Karpathy reference line in Philosophy/Mindset section).
- **Agent System Quality Audit** — Comprehensive audit and fix of all 84 agent definitions: (1) Added `clean-code` skill to `incident-responder` and `threat-modeler` (now 84/84 have it); (2) Fixed `cli.md` tools from legacy names (`fs.read`, `search.grep`) to standard (`Read`, `Grep`, `Glob`, `Bash`, `Edit`, `Write`); (3) Added Interaction Maps to 35 agents missing them (now 84/84 have them); (4) Extracted `frontend-specialist.md` design process (26KB → 11KB) into new `frontend-design-process` skill; (5) Added Philosophy + Mindset to `cli.md`; (6) Removed non-existent `ViewCodeItem`, `FindByName` tools from `explorer-agent.md`.
- **7 New Tools** — Expanded tool registry from 7 → 14 tools: (1) `agent.delegate` — Delegate tasks to other agents with max depth 3, 60s timeout, self-delegation prevention; (2) `memory.save` / `memory.load` — File-based agent memory (`.agent/memory/<agent>/<key>.json`), keyed by agent name; (3) `web.search` — Multi-provider web search (SearXNG self-hosted, Serper Google API, Tavily AI-optimized), configurable via `config.yaml` `webSearch.provider` + `webSearch.apiKey`; (4) `plan.create` / `plan.update` / `plan.list` — Structured task planning with status tracking (pending/in_progress/completed/blocked/skipped), stored in `.agent/plans/`. Added `Agent` → `agent.delegate` legacy alias. Updated `prompt-builder.js` to list all 14 tools in system prompt.
- **Agent Frontmatter Audit** — Comprehensive upgrade of all 84 agent `.md` frontmatter: (1) Added `When to Activate` section to 75 agents (now 84/84 have it); (2) Added `Core Philosophy` to 3 agents missing it — `explorer-agent`, `orchestrator`, `project-planner` (now 84/84); (3) Added `memory` field to all 84 agents — 73 `session` + 11 `persistent` (orchestrators/planner/explorer); (4) Added new tools to frontmatter — `memory.save`/`memory.load` (84/84), `web.search` (17 researchers), `plan.create`/`update`/`list` (15 planners); (5) Added `Available Orchestration Tools` table to 9 orchestration workflows.

### Fixed — Bug Audit 2026-05-06 Round 1 (2 Critical + 5 High + 4 Medium)

**P0 Critical:**
- **LLM retry off-by-one (maxRetries+1 attempts)** — `callLLM()` retry loop used `attempt < maxRetries` as the retry condition on the last attempt, causing an extra loop iteration before throwing. Changed to `isLastAttempt = attempt >= maxRetries - 1` for exactly `MAX_RETRIES` total attempts (`lib/core/llm-providers.js`)
- **fetch.url SSRF vulnerability** — No protection against fetching internal/private IPs. Added DNS resolution + private IP block (RFC1918, loopback, link-local, unique-local IPv6). Blocks `127.x`, `10.x`, `172.16-31.x`, `192.168.x`, `169.254.x`, `::1`, `fe80:`, `fd/fc` before HTTP request. Also checks redirect targets (`lib/core/tool-definitions.js`)

**P1 High:**
- **Chat session maxSteps hard-capped at 10** — `createChatSession` used `Math.min(..., 10)` instead of `MAX_ALLOWED_STEPS` (50), causing chat to hit step limit before `runAgent`. Now consistent with ReAct loop (`lib/core/chat-session.js`)
- **WebSocket intervention 1-step delay** — `onStep` callback checked `PENDING_INTERVENTIONS` AFTER the step completed, injecting intervention into the next step instead of the current one. Clarified architecture: react-loop.js checks `state._intervention` BEFORE each LLM call; ws.js only syncs pending → state without duplicate timing logic (`lib/api/ws.js`, `lib/core/react-loop.js`)
- **handoff.js unsafe write bypasses guardrails** — `saveBundlesToDisk()` used `fs.writeFileSync` directly, missing atomic write, path traversal protection, and EXDEV fallback. Changed to `guardrails.safeWrite()` (`lib/api/handoff.js`)
- **Ollama always included in failover chain** — `buildFailoverChain()` included `"local"` even when Ollama wasn't running, causing 120s timeout waste on every failover attempt. Added `_isOllamaLikelyAvailable()` with `markOllamaOk()` called on successful Ollama responses. Circular dependency (failover ↔ llm-providers) resolved by keeping `markOllamaOk` in `failover.js` only (`lib/core/failover.js`, `lib/core/llm-providers.js`)
- **fs.glob literal bracket false match** — `[` and `]` in filenames (e.g. `file[1].txt`) were treated as glob character classes, producing incorrect regex patterns. Added support for `[[]` (literal `[`) and `[]]` (literal `]`) escape sequences in glob-to-regex fallback (`lib/core/search-tools.js`)

**P2 Medium:**
- **Context trim breaks tool call/result pairs** — `messages.slice(-10)` could drop a `user` tool-result message while keeping the `assistant` tool-call message, confusing the LLM. Replaced with content-based trimming: first trims individual message contents proportionally, then drops oldest non-system messages only if still over limit (`lib/core/react-loop.js`)
- **tcRegex lastIndex state pollution** — `TOOL_CALL:` regex with `/g` flag could retain stale `lastIndex` from previous parse if `exec()` threw. Added explicit `tcRegex.lastIndex = 0` reset before each parse (`lib/core/tool-parser.js`)
- **WebSocket no input length validation** — `handleRun` and `handleChatSend` accepted arbitrarily large inputs, causing memory pressure before `sanitizeInput` could reject. Added `MAX_INPUT_LENGTH` check at WS layer, returning error to client immediately (`lib/api/ws.js`)
- **plugin.js execFileSync lacks security comment** — `npm install` used `execFileSync` directly (bypassing `sandboxExec` guardrails), but this is safe because `execFileSync` does NOT invoke a shell. Added explicit comment explaining why this is intentional and secure (`lib/core/plugin.js`)

### Fixed — Bug Audit 2026-05-06 Round 2 (3 Critical + 3 High + 2 Medium)

**P0 Critical:**
- **Ollama HTTPS regression** — `callOllama()` always used `http.request` even when `OLLAMA_HOST` was `https://`, causing 100% connection failure for HTTPS Ollama endpoints. V2.5.1 fixed this in health-check.js but the fix was lost during V2.6.0 module decomposition. Now selects `http` or `https` transport based on `ollamaUrl.protocol` (`lib/core/llm-providers.js`)
- **Test runner infinite recursion** — `npm test` script was `python3 test_runner.py .` which internally ran `npm test`, creating an infinite loop that never executed any actual tests. Changed to `node lib/test/unit/core.test.js && node lib/test/unit/production.test.js && node lib/test/integration/flow.test.js` for direct execution. Added `test:unit` and `test:integration` scripts (`package.json`)
- **Lint runner timeout** — `npm run lint` script was `python3 lint_runner.py .` which internally ran `npm run lint`, causing a 120s timeout since no actual lint script existed. Changed to `node --check` for syntax validation of all JS files (`package.json`)

**P1 High:**
- **WebSocket intervene bypasses length limit** — `handleIntervene` accepted arbitrarily large messages while the HTTP `/agents/intervene` endpoint enforced a 10K char limit. Added `MAX_INTERVENTION_LENGTH=10000` check in WS handler to match HTTP limit, preventing memory pressure via WebSocket (`lib/api/ws.js`)
- **`max_steps` falsy coercion** — `max_steps || undefined` in handoff routes coerced `max_steps=0` to `undefined`, preventing intentional step disabling via API. Changed to `max_steps != null ? max_steps : undefined` to preserve `0` as a valid value (`lib/api/handoff.js`)
- **Chat session missing maxSteps override** — `createChatSession` did not accept `maxSteps` from options, ignoring caller overrides unlike `runAgent`. Added `maxSteps: overrideMaxSteps` to options destructuring and used `overrideMaxSteps ?? agentSpec.maxSteps ?? DEFAULT_MAX_STEPS` for resolution (`lib/core/chat-session.js`)

**P2 Medium:**
- **`/metrics` exposed without auth** — Prometheus metrics endpoint required no authentication, leaking usage data and internal counters. Added `apiKeyAuth` middleware to `/metrics` route, consistent with other sensitive endpoints (`lib/api/server.js`)
- **No security headers** — Express app set no security headers (CSP, HSTS, X-Frame-Options, etc.), leaving it vulnerable to clickjacking, MIME sniffing, and XSS injection. Added `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Strict-Transport-Security` (HTTPS only) as global middleware (`lib/api/server.js`)

### Fixed — API Production Hardening (3 Critical + 3 High + 2 Medium)

**P0 Critical:**
- **WebSocket no maxPayload limit** — `WebSocketServer` accepted arbitrarily large messages, enabling memory exhaustion attacks before `MAX_INPUT_LENGTH` check could reject. Added `maxPayload: 1MB` + `perMessageDeflate: false` (zip bomb prevention) to WebSocketServer options (`lib/api/ws.js`)
- **WebSocket no heartbeat — connection leak** — Dead connections (client crash, network partition) were never detected, causing `chatSessions` and `PENDING_INTERVENTIONS` to leak indefinitely. Added ping/pong heartbeat every 30s: server marks `ws.isAlive = false` before ping, `pong` handler resets it, stale connections are `terminate()`d (`lib/api/ws.js`)
- **WebSocket `handleRun` no timeout** — Agent runs via WebSocket had no timeout (unlike MCP's 2-minute cap), allowing a stuck agent to block the WS connection indefinitely. Added `Promise.race` with 5-minute timeout for both `handleRun` and `handleChatSend`, consistent with `JOB_TIMEOUT_MS` default (`lib/api/ws.js`)

**P1 High:**
- **`/traces` + `/metrics` exposed without auth boundary** — When `AIYU_API_KEY` was not set, `/traces` and `/metrics` were accessible from any network, leaking tool outputs, system prompts, and internal counters. Added `sensitiveRouteAuth` middleware: requires API key if configured, otherwise restricts to localhost (loopback) only. Prevents data exposure on untrusted networks (`lib/api/server.js`)
- **Rate limit error matching by string** — `rate-limit.js` matched rate limit errors via `err.message.includes("Rate limit")`, which would break if `guardrails.rateLimit` error message changed. Added `err.code = "RATE_LIMITED"` to guardrails error and changed rate-limit.js to match by `err.code`. Also added `Retry-After` header on 429 responses and `X-RateLimit-Limit` + `X-RateLimit-Window` headers on all responses for proper client backoff (`lib/core/guardrails.js`, `lib/api/rate-limit.js`)
- **Shutdown doesn't terminate WebSocket connections** — `gracefulShutdown()` closed the HTTP server but left WS connections open, preventing clean shutdown until clients disconnected naturally. Added `terminateAllConnections()` call in shutdown that terminates all active WS clients + clears heartbeat timer (`lib/api/ws.js`, `lib/api/shutdown.js`)

**P2 Medium:**
- **No request ID propagation** — No `X-Request-Id` header was generated or propagated, making it impossible to trace a request across API → Queue → LLM → Tool → Response. Added `requestIdMiddleware` that reads `X-Request-Id` from client or generates UUID, sets it on `req.id` and response header. Enhanced `requestLogger` to include request/response sizes and request ID (`lib/api/middleware.js`, `lib/api/server.js`)
- **`/jobs/:id` returns unbounded result** — `GET /jobs/:id` returned the full agent output without truncation, potentially exposing MB-sized tool outputs through the API. Added 10KB truncation with `_truncated` flag, consistent with tool result truncation pattern (`lib/api/jobs.js`)

### Added — API Production Hardening

- **LLM keep-alive agents** — `httpsAgent` and `httpAgent` with `keepAlive: true`, `maxSockets: 10` for OpenAI, Claude, and Ollama HTTP requests. Reuses TCP connections across LLM calls, reducing latency and preventing socket exhaustion under high concurrency (`lib/core/llm-providers.js`)
- **CORS preflight cache** — `maxAge: 86400` (24h) on CORS configuration, reducing preflight request overhead (`lib/api/server.js`)
- **WS `ws.on("error")` handler** — Uncaught WebSocket errors would crash the process. Added error handler that logs and prevents unhandled exception propagation (`lib/api/ws.js`)

---

## [2.5.1] - 2026-05-06

### Fixed — 25 Bugs + 4 Pre-existing Test Fixes (6 Critical + 7 High + 12 Medium)

**P0 Critical:**
- **Circuit breaker global `"llm"` key blocks failover** — Single breaker key `"llm"` opened when any provider failed, blocking ALL subsequent LLM calls even if other providers were healthy. Now uses per-provider keys (`llm:openai`, `llm:claude`, `llm:local`, `llm:mock`) with `callLLMWithFailover()` that iterates provider chain, skipping OPEN breakers. `isAnyLlmAvailable()` exported for API/MCP pre-checks (`lib/core/agent-runtime.js`, `lib/api/jobs.js`, `lib/api/handoff.js`)
- **Rate limit Map unbounded growth** — `rateLimits` Map could grow indefinitely from unique keys (e.g. bot scans with different IPs), causing memory leak. Added hard cap of 200 entries with FIFO eviction after expired cleanup (`lib/core/guardrails.js`)
- **search.grep regex `lastIndex` skips matches** — `regex.test()` with `/g` flag mutates `lastIndex`; using `forEach` meant `lastIndex` wasn't reliably reset between lines, causing alternating match/skip behavior. Changed to `for`-loop with explicit `regex.lastIndex = 0` before each `test()` (`lib/core/tool-registry.js`)
- **X-Forwarded-For spoofing bypasses rate limit** — `rateLimitMiddleware` used `X-Forwarded-For` header as primary IP source, allowing attackers to spoof IPs and bypass rate limits entirely. Now uses `req.ip` as primary (Express `trust proxy` setting), only reads `X-Forwarded-For` when `AIYU_TRUST_PROXY=true` is explicitly set (`lib/api/rate-limit.js`, `lib/api/server.js`)
- **`_cacheGet` returns mutable reference** — When `JSON.parse(JSON.stringify())` deep clone failed (e.g. circular refs), `_cacheGet` returned the raw cache entry reference, allowing callers to mutate cached data. Now returns `Object.freeze()` shallow copy as fallback (`lib/core/agent-runtime.js`)
- **`PENDING_INTERVENTIONS` not exported from ws.js** — `handoff.js` requires `PENDING_INTERVENTIONS` from `ws.js` for HTTP intervention API, but `ws.js` didn't export it — causing runtime `TypeError: Cannot read properties of undefined` when using `POST /agents/intervene`. Now exported (`lib/api/ws.js`)

**P1 High:**
- **Chat session no provider failover** — `createChatSession` called `llmProviders.callLLM` directly without circuit breaker or failover, unlike `runAgent`. Now uses `callLLMWithFailover()` with per-provider breaker tracking (`lib/core/agent-runtime.js`)
- **Chat sessions no TTL** — `chatSessions` Map in WebSocket server never expired idle sessions, causing memory leak from abandoned connections. Added 30-minute TTL with `lastActivity` timestamp + periodic cleanup every 5 minutes (`lib/api/ws.js`)
- **postinstall crash on malformed package.json** — `JSON.parse(fs.readFileSync(...))` in `findProjectRoot` threw on malformed `package.json`, crashing the entire postinstall script. Added `try-catch` to gracefully skip (`bin/postinstall.js`)
- **jobs.js + handoff.js stale circuit breaker check** — Both API modules used `circuitBreaker.canExecute("llm")` (old global key) which no longer exists after per-provider refactor. Now uses `isAnyLlmAvailable()` from agent-runtime (`lib/api/jobs.js`, `lib/api/handoff.js`)
- **Handoff bundle file global tmpdir conflict** — `BUNDLE_FILE` used global `os.tmpdir()` path `aiyu-handoff-bundles.json`, causing cross-instance write conflicts when multiple processes run. Now uses project-scoped path (`cfgDir/handoff-bundles.json`) with PID-based fallback (`lib/api/handoff.js`)
- **`truncateResult` redundant deep clone** — `truncateResult()` called `JSON.parse(JSON.stringify(result))` even when result was already small enough, wasting CPU on double serialization. Now uses shallow copy `{...result}` and only serializes for final size check (`lib/core/tool-registry.js`)
- **`jobs.js` redundant `err.code` assignment** — `err.code = "QUEUE_FULL"` was assigned to an error that already had `code: "QUEUE_FULL"` from the queue, a no-op that indicated possible copy-paste oversight. Removed redundant assignment (`lib/api/jobs.js`)

**P2 Medium:**
- **Cache deep clone on every hit** — `_cacheGet()` always performed `JSON.parse(JSON.stringify())` even for small/primitive results. Now only clones objects/arrays, returns primitives directly, and wraps clone in try-catch for circular refs (`lib/core/agent-runtime.js`)
- **Handoff bundles lost on restart** — `STORED_BUNDLES` Map was in-memory only, losing all bundles on server restart. Now persists to temp file (`aiyu-handoff-bundles.json`) with load-on-startup + save-after-write (`lib/api/handoff.js`)
- **truncateResult double parse** — `truncateResult()` called `JSON.parse(JSON.stringify(result))` even when result was already small enough. Now reuses the `JSON.stringify` output and only parses when truncation is actually needed (`lib/core/tool-registry.js`)
- **Usage buffer not flushed on exit** — `_flushBuffer` ran on 5-second interval but not on process exit, losing buffered usage data on crash or SIGTERM. Added `process.on("exit", _flushBuffer)` with `_exitHandlerRegistered` guard (`lib/core/usage.js`)
- **Tracing p95 index overflow** — `completed.length * 0.95` could produce index equal to array length (out of bounds) for small arrays. Added `Math.min(index, length - 1)` clamp (`lib/core/tracing.js`)
- **CORS origin unrestricted** — `cors()` middleware with no `origin` option allowed any origin. Now reads `AIYU_CORS_ORIGIN` env var to restrict origins (defaults to `undefined` = allow all for backward compatibility) (`lib/api/server.js`)
- **fs.glob brace alternation regex metachar** — `{a.c,b*}` brace alternatives weren't individually escaped before joining with `|`, allowing regex metacharacters inside braces to corrupt the pattern. Now escapes each alternative individually using placeholders to preserve alternation structure during main escaping (`lib/core/tool-registry.js`)
- **LLM retry off-by-one** — `callLLM` retry loop used `attempt <= maxRetries` causing 4 attempts instead of 3 (initial + 3 retries). Changed to `attempt < maxRetries` for exactly `MAX_RETRIES` total attempts (`lib/core/llm-providers.js`)
- **Queue `_finishJob` event order** — `_finishJob` called `_processNext()` before emitting `completed`/`failed` events, causing listeners to receive events after the next job had already started. Swapped order: emit first, then process next (`lib/core/request-queue.js`)
- **Handoff `extractDecisions` operator precedence** — `step.thought && step.thought.includes("decided") || step.thought?.includes("decision")` evaluated as `(A && B) || C` due to `&&` having higher precedence than `||`. While accidentally correct, added explicit parentheses for clarity (`lib/core/handoff.js`)
- **`crypto` require duplicated in function body** — `agent-runtime.js` required `crypto` inside `_cacheKey()` and `runAgent()` instead of at top level. Moved to top-level require (`lib/core/agent-runtime.js`)
- **Ollama health check ignores https** — `checkReadiness` always used `http.request` even when `OLLAMA_HOST` was `https://`, causing connection failures for HTTPS Ollama endpoints. Now selects `http` or `https` transport based on URL protocol (`lib/core/health-check.js`)

**Pre-existing Test Fixes:**
- **checkReadiness/getFullHealthReport not awaited** — Both functions are async but tests called them synchronously, getting Promise objects instead of results. Added `await` in both unit and integration tests (`lib/test/unit/production.test.js`, `lib/test/integration/flow.test.js`)
- **Trace ID length wrong in tests** — Tests expected `traceId.length === 16` and `spanId.length === 8`, but OTel spec (and actual code) produces 32 and 16 hex chars respectively. Fixed test assertions (`lib/test/unit/production.test.js`)
- **Queue status "ready" not in test allowlist** — Integration test allowed `["ok", "healthy", "degraded", "not_available"]` but health-check returns `"ready"` for queue. Added `"ready"` to allowlist (`lib/test/integration/flow.test.js`)
- **Integration test circuit breaker used old global key** — `circuitBreaker.resetBreaker("llm")` no longer valid. Changed to `circuitBreaker.resetBreaker("llm:mock")` for per-provider key (`lib/test/integration/flow.test.js`)

---

## [2.5.0] - 2026-05-05

### Added — Claude Design-Inspired Features

**WebSocket Real-Time Streaming (`/ws`)**
- `lib/api/ws.js` — Bidirectional WebSocket server mounted on same HTTP port
- Message types: `run`, `chat.create`, `chat.send`, `intervene`, `subscribe` (client → server)
- Push events: `step`, `complete`, `error`, `chat.step`, `chat.complete`, `pong` (server → client)
- `onStep` callback integration with `runAgent` for per-step real-time emission
- Session cleanup on disconnect: `chatSessions` Map purges orphaned entries

**Agent Handoff Bundle (A → B context passing)**
- `lib/core/handoff.js` — Bundle format v1.0 with source, context, artifacts, pendingTasks, state
- `lib/api/handoff.js` — `POST /handoff` chains two agents: from_agent runs, bundle created, to_agent receives enriched input
- `GET /handoff/:id` — Retrieve stored bundle (max 100 stored)
- Auto-extracts file writes, shell outputs, and max_steps/error tasks into artifacts/pendingTasks

**Inline Intervention (mid-run feedback)**
- `POST /agents/intervene` — Queue intervention for a running agent by `run_id`
- WebSocket `type: "intervene"` — Same mechanism via WebSocket
- `PENDING_INTERVENTIONS` Map with timestamp, cleaned up on WebSocket disconnect (5-min stale threshold)
- Injected into ReAct loop between steps via `state._intervention`

**`fetch.url` Tool (external data fetch)**
- `lib/core/tool-registry.js` — New built-in tool: `fetch.url({ url, method?, headers?, body?, timeout? })`
- Native Node.js `http`/`https` modules (no extra dependencies)
- Security: protocol restricted to `http:`/`https:` only, 15s default timeout, 1MB response size limit
- Returns `{ status, headers, body, _truncated }`

**Agent System Auto-Apply (project context detection)**
- `lib/core/agent-system.js` — Auto-detects language, framework, testRunner, packageManager from `package.json`, `tsconfig.json`, Python project files
- Reads `.windsurf/rules/` to extract active rule names
- Builds behavioral guidelines (TypeScript strict mode, Next.js App Router, React hooks, AAA pattern, etc.)
- Injected into system prompt automatically in both `runAgent` and `createChatSession`

---

### Fixed — 31 Bugs (8 Critical + 9 High + 10 Medium + 4 Low)

**P0 Critical:**
- **Unauthenticated HTTP API** — All endpoints (`/jobs`, `/handoff`, `/ws`, `/metrics`, `/traces`) had no authentication. Now supports `AIYU_API_KEY` env var: when set, requires `Authorization: Bearer <key>` or `x-api-key` header. `/health` exempt for k8s probes. WebSocket uses `?token=<key>` query param. Constant-time `crypto.timingSafeEqual` prevents timing attacks (`lib/api/middleware.js`, `lib/api/server.js`, `lib/api/ws.js`, `lib/api/config.js`)
- **No LLM provider failover** — Circuit breaker OPEN caused immediate hard failure with no recovery. Now implements failover chain `openai → claude → local → mock`, skipping providers without configured credentials. Failover triggers on both circuit breaker OPEN and LLM call failure, with tracing events for observability (`lib/core/agent-runtime.js`)
- **parseToolCalls escaped flag swallows character** — After escape sequence (`\"`), the character following the closing quote was skipped due to `escaped=false; continue` pattern. Removed premature `continue` so the character is processed normally (`lib/core/agent-runtime.js`)
- **shell.exec path-prefix command bypass** — Commands like `./node` resolved `base="node"` (passing allowlist) but executed the path-prefixed binary. Now rejects path-prefixed commands entirely and passes bare command name to `sandboxExec` (`lib/core/tool-registry.js`)
- **fs.edit silent partial edit on multiple occurrences** — `content.replace(old_string, new_string)` only replaced first match silently. Now detects multiple occurrences and rejects with error + count, enforcing unique `old_string` (`lib/core/tool-registry.js`)
- **tool-runner.js `fetch.url` missing from NET_TOOLS** — `NET_TOOLS = ["search.grep"]` excluded `fetch.url`, so `PERMISSIONS_NETWORK=false` did not block HTTP requests in isolated tool runner. Added `fetch.url` to `NET_TOOLS` (`lib/core/tool-runner.js`)
- **Circuit breaker OPEN→HALF_OPEN double-entry** — `canExecute()` set `halfOpenAttempts = 0` then returned `true`, allowing the next `canExecute()` call in the same event loop tick to also pass (incrementing from 0→1). Now atomically sets `halfOpenAttempts = 1` during transition, preventing more than `halfOpenMaxAttempts` probes (`lib/core/circuit-breaker.js`)

**P1 High:**
- **WebSocket chatSessions memory leak** — `chatSessions` Map never cleaned up on WebSocket disconnect. Now iterates and deletes sessions belonging to the disconnected client (`lib/api/ws.js`)
- **PENDING_INTERVENTIONS memory leak** — Unconsumed interventions accumulated indefinitely. Now stores interventions with timestamp `{ message, _ts }` and cleans up entries older than 5 minutes on WebSocket disconnect (`lib/api/ws.js`, `lib/api/handoff.js`)
- **Ollama health check ignores 5xx responses** — `resolve()` was called with status value but `ollamaStatus` was hardcoded to `"available"`. Now uses the resolved value so 5xx responses correctly show `"unhealthy"` (`lib/core/health-check.js`)
- **Chat session error breaks conversation continuity** — On circuit breaker or LLM failure, error was not pushed to `messages` array and `thought` was `null` in step record. Now pushes error as assistant message and sets `thought` to error content (`lib/core/agent-runtime.js`)
- **Cache key uses raw options instead of resolved values** — Cache key used `options.outputFormat`/`options.deterministic` (often `undefined`) while execution used resolved values from agent spec. Moved cache check after resolution and uses `resolvedCacheKey` (`lib/core/agent-runtime.js`)
- **_isBlockedFlag over-aggressive short flag matching** — `-ecount` (valid grep flag) was blocked because it matched `-e` + extra chars. Now only blocks when remainder contains code-indicator characters (` '"();{}`) (`lib/core/guardrails.js`)

**P2 Medium:**
- **search.grep sync I/O blocks event loop** — Recursive `walk()` used `fs.readdirSync`/`fs.statSync`/`fs.readFileSync`, blocking Node.js event loop for seconds on large directories. Made `walk` async with `setImmediate` yield every 50 files (`lib/core/tool-registry.js`)
- **Cache doesn't include skill instructions hash** — Cache key only hashed `agentSpec.instructions`, so changing skill content returned stale cached results. Now includes `skillInstructions` in the SHA-256 hash (`lib/core/agent-runtime.js`)
- **fs.glob fallback doesn't support `[...]` character class** — `globToRegex` escaped `[` and `]` as literal characters instead of preserving them as character classes. Now extracts `[...]` patterns before escaping and restores them afterward (`lib/core/tool-registry.js`)
- **Temperature handling inconsistency across providers** — OpenAI used `??` (null-coalescing) while Claude/Ollama used `!== undefined`, causing `temperature: null` to be sent to Claude but default to 0.7 for OpenAI. Now all providers use `!== undefined` consistently (`lib/core/llm-providers.js`)
- **parseToolCalls kv-pair fallback can't handle spaces in unquoted values** — Regex `[^,}\s]+` stopped at first space, so `path=/my folder/file.txt` was truncated. Changed to `[^,}]+` which matches until comma or closing brace, then `.trim()` removes surrounding whitespace (`lib/core/agent-runtime.js`)

**Elite Bug Audit — 13 Additional Bugs (1 Critical + 3 High + 5 Medium + 4 Low):**

**P0 Critical:**
- **runAgent crash — crypto.createHash receives Object** — `loadSkillInstructions()` returns Object but `crypto.Hash.update()` requires string/Buffer, causing `TypeError` crash on every execution path (run, chat, /jobs, /ws). Now stringifies before `.update()` (`lib/core/agent-runtime.js`)

**P1 High:**
- **callOllama hardcodes localhost:11434** — URL hardcoded instead of respecting `OLLAMA_HOST` env var like `health-check.js`. Now reads `process.env.OLLAMA_HOST` with localhost fallback (`lib/core/llm-providers.js`)
- **Inline Intervention dead code** — `ws.js` sets `state._intervention` but `agent-runtime.js` never reads it, making `POST /agents/intervene` and WebSocket `type: "intervene"` no-ops. Now wired into ReAct loop between steps (`lib/core/agent-runtime.js`)
- **sandboxExec leaks env vars to child processes** — `sandboxExec()` passes full `process.env` including `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, etc. Now strips keys matching `/(?:API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|PRIVATE_KEY)/i` (`lib/core/guardrails.js`)

**P2 Medium:**
- **WebSocket runId/sessionId collision risk** — IDs used `Date.now() + Math.random()` which can collide under high throughput. Now uses `crypto.randomUUID()` (`lib/api/ws.js`)
- **fetch.url doesn't follow HTTP redirects** — 301/302/307/308 responses returned redirect HTML instead of content. Now follows up to 3 redirects with protocol validation (`lib/core/tool-registry.js`)
- **fetch.url response size counts string length not bytes** — `data.length` counts UTF-16 code units, allowing multi-byte content to exceed 1MB limit. Now uses `Buffer.concat` + `chunk.length` for byte-accurate measurement (`lib/core/tool-registry.js`)
- **usage.json read-modify-write race condition** — `trackCommand()` reads, modifies, writes synchronously on every call; concurrent API requests overwrite each other's stats. Now uses in-memory buffer with 5-second periodic flush (`lib/core/usage.js`)
- **Queue singleton not reset after destroy()** — `destroy()` sets `_destroyed=true` but `getDefaultQueue()` returns the same instance, causing `QUEUE_DESTROYED` errors on restart. Now resets `_defaultQueue=null` in `destroy()` (`lib/core/request-queue.js`)

**P3 Low:**
- **Tracing rotation filename collision** — Backup used `Date.now()` which can collide on rapid rotation. Now uses `crypto.randomUUID()` (`lib/core/tracing.js`)
- **fetch.url falsy body values rejected** — `args.body || null` treats `0`, `false`, `""` as null. Now uses `args.body ?? null` (`lib/core/tool-registry.js`)
- **OTel traceId/spanId too short** — `randomBytes(8)`/`randomBytes(4)` produce 16/8 hex chars, but OTel spec requires 32/16. Now uses `randomBytes(16)`/`randomBytes(8)` (`lib/core/tracing.js`)
- **agent-system.js rule extraction reads only first line** — `split("\n")[0]` misses headings not on first line after frontmatter. Now finds first markdown heading with `/^#+\s*(.+)/m` regex (`lib/core/agent-system.js`)

**Post-Release Fixes:**

**P1 High:**
- **Tool calls have no per-tool timeout** — README documented "30s per tool call" but `runAgent` and `createChatSession` called `await tool(toolArgs)` with no timeout, allowing hung tools to block the ReAct loop indefinitely. Now uses `Promise.race([toolPromise, timeoutPromise])` with `TOOL_TIMEOUT_MS=30000` (30s). Timeout errors are tagged `tool_timeout` in tracing vs `tool_failure` for regular errors (`lib/core/agent-runtime.js`)

**P2 Medium:**
- **Skill instructions hard-truncated at 2000 chars** — `content.slice(0, 2000)` in `buildSystemPrompt` cut skill content mid-sentence, losing critical instructions. New `truncateSkillContent()` function uses section-aware truncation: preserves markdown headings (`##`/`###`), keeps code blocks whole or skips them entirely, and respects `MAX_SKILL_INSTRUCTION_CHARS=8000` (4x increase). Exported for testing (`lib/core/agent-runtime.js`)

---

## [2.4.1] - 2026-05-05

### Fixed — 98 Bugs (System-wide Bug Audit, 4 rounds)

**P0 Critical:**
- **parseToolCalls undeclared `match` variable** — `match` used without `let` declaration in Strategy 3 JSON block extraction, creating implicit global. Added `let match;` declaration (`lib/core/agent-runtime.js`)
- **API /jobs missing agent_name default** — When `agent_name` omitted from POST body, `runAgent` received `undefined` causing "Agent not found: undefined" crash. Now defaults to `findDefaultAgent()` (`lib/api/jobs.js`)
- **Rate limit window mismatch** — API was 600 req/min (not 10 req/sec). Added `windowMs` parameter to `rateLimit()`, API now uses `guardrails.rateLimit(key, 10, 1000)` for true 10 req/sec with 1-second window (`lib/core/guardrails.js`, `lib/api/rate-limit.js`)
- **shell.exec duplicate validation** — Removed redundant BLOCKED_FLAGS check, `sandboxExec` is now single enforcement point (`lib/core/tool-registry.js`)
- **Chat tool resolution broken** — Legacy tool names (`Read`, `Bash`) not resolved in chat mode, causing tool lookup failures (`lib/core/agent-runtime.js`)
- **Chat tool validation inconsistent** — `validateToolArgs` used raw name while `getTool` needed resolved name (`lib/core/agent-runtime.js`)
- **search.grep crash — missing `fs` require** — `search.grep` handler used `fs.existsSync/readFileSync` without importing `fs`, causing `ReferenceError: fs is not defined` on every call (`lib/core/tool-registry.js`)
- **runAgent maxSteps no upper bound** — Agent spec could set `max_steps: 999999` causing runaway ReAct loop. Added `MAX_ALLOWED_STEPS=50` hard cap with `Math.min()` in both `loadAgentSpec` and `runAgent` (`lib/core/agent-runtime.js`)
- **fs.glob fallback stack overflow** — Fallback `walk()` function had no depth limit, causing stack overflow on deeply nested directories. Added `depth` parameter with `maxDepth=20` (`lib/core/tool-registry.js`)
- **Circuit breaker NaN in error message** — `breakerStatus.lastFailureTime` could be `null` (after `resetBreaker()` or fresh breaker), causing `null + resetMs - Date.now()` = `NaN` in retry-seconds display. Now guards with fallback to `resetMs/1000` and `Math.max(0,...)` (`lib/core/agent-runtime.js` — both `runAgent` and `createChatSession`)
- **fs.glob fallback `?` matches `/`** — Glob `?` (any single char) was converted to regex `.` which matches `/`, violating glob semantics. Changed to `[^/]` consistent with `*` → `[^/]*` (`lib/core/tool-registry.js`)

**P1 High:**
- **pathTraversal test non-deterministic** — Added explicit `projectRoot` parameter in tests (`lib/test/runner.js`, `lib/test/compliance.js`)
- **fs.edit replaces ALL occurrences** — Changed `replaceAll` → `replace` (first occurrence only) to prevent data corruption (`lib/core/tool-registry.js`)
- **Cache key missing maxSteps** — Different `maxSteps` values returned same cached result (`lib/core/agent-runtime.js`)
- **Health check always returns 503** — Compared wrong field (`report.status` → `report.readiness`) (`lib/api/server.js`)
- **queue.jobs exposed directly** — Added `getJob()` + `getRecentJobs()` public API methods (`lib/core/request-queue.js`, `lib/api/jobs.js`)
- **Chat session outputFormat not enforced** — `createChatSession.send()` didn't enforce `outputFormat: json` like `runAgent` did. Now validates JSON output and wraps text if invalid (`lib/core/agent-runtime.js`)
- **init.js generates legacy tool names** — Agent template used `Read, Grep, Glob, Bash, Edit, Write` instead of namespaced `fs.read, search.grep, fs.glob, shell.exec, fs.edit, fs.write` (`lib/commands/init.js`)
- **MCP/API agent runs not tracked** — `run_agent` MCP tool and `/jobs` API endpoint didn't call `usage.trackCommand()`, so `agentRuns` counter missed MCP/API usage. Added tracking with `{via: "mcp"}` and `{via: "api"}` metadata (`lib/mcp/tools/run-agent.js`, `lib/api/jobs.js`)
- **parseToolCalls fails on nested parentheses** — Regex `[^)]*` stopped at first `)`, breaking args like `{"path": "file(1).txt"}`. Replaced with balanced-depth parser that counts paren depth and handles string escapes (`lib/core/agent-runtime.js`)
- **API /jobs missing agent_name validation** — `agent_name` from request body wasn't validated with `isValidAgentName()`, creating defense-in-depth gap for path traversal. MCP tool already validated; API now does too (`lib/api/jobs.js`)
- **Health check llmProviders has no .status field** — `checkReadiness()` returned llmProviders without `.status`, causing health display to show `✗ undefined`. Added `status: "ok"/"limited"` + message field (`lib/core/health-check.js`)
- **parseToolCalls key=value greedy quote stripping** — `replace(/^"|"$/g, "")` removed quotes from inside values (e.g. `path="/src/my\"file"` → `/src/myfile`). Changed to `slice(1,-1)` that only strips surrounding quotes (`lib/core/agent-runtime.js`)
- **tool-runner.js missing `_truncated` flag** — Truncation in isolated tool runner didn't set `_truncated: true`, unlike `tool-registry.js`. Consumers couldn't detect truncated output (`lib/core/tool-runner.js`)
- **chat.js agent-not-found error delayed** — `createChatSession()` throws when agent doesn't exist, but error only appeared on first `session.send()`, not at session creation. Wrapped in try/catch for immediate feedback (`lib/commands/chat.js`)
- **config.saveVersion uses writeFileSync** — `saveVersion()` used `fs.writeFileSync` instead of `guardrails.safeWrite`, risking corruption on crash and missing path traversal protection. Now uses atomic write (`lib/core/config.js`)
- **packager.js bin/run.js missing --force** — Published agent's `bin/run.js` mentioned `--force` flag in error message but never implemented it. Added `process.argv.includes("--force")` check. Also replaced outdated "Windsurf IDE" reference with correct CLI usage (`lib/publish/packager.js`)
- **Health check icon doesn't recognize 'healthy' status** — Queue reports `status: "healthy"` but icon mapping only checked `ok/ready/configured/available`, showing `✗` for healthy queue. Added `"healthy"` to OK status list (`bin/cli.js`)

**P2 Medium:**
- **ReDoS vulnerability** — Added `_safeRegex()` to reject dangerous regex patterns (`lib/core/tool-registry.js`)
- **truncateResult misses edge cases** — Improved with HALF_MAX strategy + final size check (`lib/core/tool-registry.js`)
- **glob regex doesn't escape metacharacters** — Added proper escaping before glob-to-regex conversion (`lib/core/tool-registry.js`)
- **Hardcoded .windsurf/ path in checklist** — Uses `config.getConfigDir()` now (`lib/commands/init-inline.js`)
- **Skill lookup uses package dir** — Now uses project config dir for installed skills (`lib/commands/init-inline.js`)
- **Simulator only has legacy tool names** — Added namespaced names (`fs.read`, `shell.exec`, etc.) (`lib/test/simulator.js`)
- **Chat ignores outputFormat/deterministic** — Chat now passes `chatLlmOpts` with outputFormat and temperature (`lib/core/agent-runtime.js`)
- **fs.read no file size limit** — Added 1MB size check before reading (`lib/core/tool-registry.js`)
- **safeWrite temp file collision** — Uses `crypto.randomUUID()` instead of `Date.now()` (`lib/core/guardrails.js`)
- **Chat session no step records** — Chat ReAct loop didn't create step records (no `step`, `thought`, `toolCalls`, `duration_ms`). Now creates `chatSteps[]` array like `runAgent`, returned in entry.steps (`lib/core/agent-runtime.js`)
- **Circuit breaker message inconsistent** — Chat said "Retry later" while runAgent showed "Retry after Xs". Chat now shows same reset time message (`lib/core/agent-runtime.js`)
- **Cache key doesn't include agent spec** — Cache only checked input/provider/model, so changing agent instructions returned stale results. Added `agentInstructionsHash` (SHA-256 of instructions) to cache key (`lib/core/agent-runtime.js`)
- **usage.saveUses uses writeFileSync** — `saveUsage()` used `fs.writeFileSync` instead of `guardrails.safeWrite`, risking corruption on crash. Now uses atomic write (`lib/core/usage.js`)
- **search.grep regex lastIndex not reset on error** — `regex.test()` with `/g` flag mutates `lastIndex`; if `test()` throws (catastrophic backtracking edge case), `lastIndex` wasn't reset. Wrapped in try/finally to guarantee reset (`lib/core/tool-registry.js`)
- **health command doesn't call markInitialized** — `aiyu-multi-agent health` CLI command never called `healthCheck.markInitialized()`, so uptime showed time since module load, not process start. Added call (`bin/cli.js`)
- **validator.js SECRET_PATTERNS with /g flag** — Module-level regex patterns had `/g` flag but `content.match()` doesn't need it for detection. Removed `/g` to prevent future `lastIndex` bugs if patterns are ever used with `test()` (`lib/publish/validator.js`)
- **plugin.js temp dir uses Date.now()** — `aiyu-multi-agent-skill-install-${Date.now()}` had collision risk on parallel installs. Changed to `crypto.randomUUID()` (`lib/core/plugin.js`)
- **health-check _startTime on module load** — `_startTime` was set at `require()` time, not server start. `markInitialized()` existed but was never called. Now called in `bin/server.js` and `lib/mcp/server.js` on startup (`bin/server.js`, `lib/mcp/server.js`)
- **init.js safeWrite calls missing projectRoot** — `generateDefaultAgent`, `generateConfig`, `generateTestStub` called `guardrails.safeWrite()` without `projectRoot` parameter, causing pathTraversal to use `process.cwd()` instead of actual project root. Added `projectDir` param to all 3 functions and call sites (`lib/commands/init.js`)
- **tool-runner.js truncation inconsistent** — Used full `MAX_SIZE` (100KB) per field while `tool-registry.js` uses `HALF_MAX` (50KB). When both `content` and `stdout` are large, total could exceed 100KB limit. Changed to `HALF_MAX` per field (`lib/core/tool-runner.js`)
- **circuit-breaker resetBreaker doesn't clear lastFailureTime** — After `resetBreaker()`, stale `lastFailureTime` remained, which could cause instant OPEN→HALF_OPEN transition if `canExecute()` checked `Date.now() - lastFailureTime`. Now clears both `lastFailureTime` and `lastFailureError` on reset (`lib/core/circuit-breaker.js`)

**P3 Low:**
- **Tracing over-aggressive eviction** — Removed `|| traces.size > MAX_TRACES` condition, added FIFO fallback (`lib/core/tracing.js`)
- **tracing.js appendFileSync blocking** — `_appendTraceToFile()` used `fs.appendFileSync` (blocking I/O) in async context, blocking event loop under high trace volume. Changed to `fs.appendFile` (async) (`lib/core/tracing.js`)
- **getRecentJobs not sorted by time** — `slice(-limit)` relied on Map insertion order which could be non-chronological after cleanup. Now sorts by `enqueuedAt` descending (`lib/core/request-queue.js`)
- **copyRecursive uses process.cwd()** — `preserved` path calculation used `path.relative(process.cwd(), destPath)` which is fragile if cwd changes. Added explicit `rootDir` parameter with `process.cwd()` default (`lib/utils.js`)
- **Postinstall may modify wrong .gitignore** — Added `isOwnPackage` guard + try/catch (`bin/postinstall.js`)
- **Plugin symlink + safeWrite edge case** — Added documentation comment (`lib/core/plugin.js`)
- **global._wfCache memory leak risk** — Changed to module-level variable (`lib/commands/init-inline.js`)
- **request-queue waitFor timeout buffer excessive** — `waitFor()` added 5s buffer on top of job timeout (e.g. 300s job → 305s wait). Reduced to 1s buffer — sufficient for cleanup overhead (`lib/core/request-queue.js`)

**Fourth Audit — 15 Additional Bugs:**

**P0 Critical (Crash / Security):**
- **API /jobs null agent_name crash** — When `agent_name` omitted and `findDefaultAgent()` returns `null`, job crashed inside queue with "Agent not found: null". Now validates `resolvedAgentName` before enqueue, returns 400 if no agent found (`lib/api/jobs.js`)
- **shell.exec pre-check rejects full paths** — Pre-check used raw first token (e.g. `/usr/bin/node`) against `ALLOWED_COMMANDS`, but `sandboxExec` uses `path.basename()`. Full paths like `/usr/bin/node --version` were rejected despite being safe. Now applies `path.basename()` in pre-check, matching sandboxExec behavior (`lib/core/tool-registry.js`)
- **packager.js Date.now() temp dir collision** — `aiyu-multi-agent-publish-${Date.now()}` had collision risk on parallel publishes (same bug already fixed in `plugin.js`). Changed to `crypto.randomUUID()` (`lib/publish/packager.js`)

**P1 High (Logic Errors):**
- **Rate limit ignores X-Forwarded-For** — Behind reverse proxy, `req.ip` = proxy IP, so all clients were rate-limited together. Now reads `X-Forwarded-For` header first, falling back to `req.ip` (`lib/api/rate-limit.js`)
- **Health check Ollama hardcoded 'local'** — `ollama: "local"` was always reported regardless of whether Ollama was actually running. Now performs HTTP HEAD check to `/api/tags` with 2s timeout, reporting `available`/`unreachable`/`not_configured`. `checkReadiness` and `getFullHealthReport` made async (`lib/core/health-check.js`, `lib/api/server.js`, `bin/cli.js`)
- **Circuit breaker successCount never resets** — `successCount` accumulated indefinitely across OPEN/CLOSED cycles, causing `getBreakerStatus()` to return misleading values. Now resets to 1 when transitioning HALF_OPEN→CLOSED (`lib/core/circuit-breaker.js`)
- **API /jobs doesn't validate max_steps** — `max_steps: 999999` from request body passed through unchecked. Now validates range 1–50 at API layer before enqueue (`lib/api/jobs.js`)
- **fs.glob glob@10+ API break** — `glob@10+` returns Promise, not callback. Callback was never invoked, so primary path always failed silently to fallback. Now tries Promise API first, falls back to callback for glob@8 compatibility (`lib/core/tool-registry.js`)

**P2 Medium (Robustness):**
- **Tracing race condition in file rotation** — `fs.existsSync` + `fs.statSync` + `fs.renameSync` (sync) + `fs.appendFile` (async) allowed two concurrent writes to interleave after rotation. Changed to `fs.appendFileSync` for atomic write-after-rotate (`lib/core/tracing.js`)
- **parseToolCalls escape handling wrong for `\"`** — `if (ch === "\\") { endIdx++; continue; }` skipped next char unconditionally, so `\"` (escaped backslash then quote) incorrectly skipped the closing quote. Now uses `escaped` flag for proper two-state tracking (`lib/core/agent-runtime.js`)
- **_cacheGet returns mutable reference** — `runAgent` set `cached._fromCache = true` directly on cache entry, polluting future cache hits. Now returns `JSON.parse(JSON.stringify(entry.data))` deep copy (`lib/core/agent-runtime.js`)
- **API /jobs missing projectDir** — `runAgent` call in job handler didn't pass `projectDir`, defaulting to `process.cwd()` which could differ. Now passes `projectDir: process.cwd()` explicitly (`lib/api/jobs.js`)

**P3 Low (Cosmetic / Minor):**
- **Circuit breaker breakers Map no cleanup** — `breakers` Map grew without bound if new breaker names were created. Added `removeBreaker()` function and export (`lib/core/circuit-breaker.js`)
- **inspect-agent maxSteps not capped** — `parseInt(fm.max_steps, 10) || 10` showed raw value without `Math.min(_, 50)` cap that `loadAgentSpec` applies. Now capped at 50 for consistency (`lib/mcp/tools/inspect-agent.js`)
- **fs.glob fallback no `{a,b}` alternation** — `globToRegex` only handled `**`, `*`, `?`. Pattern `{src,lib}/**/*.js` failed to match. Now expands `{a,b,c}` braces to `(a|b|c)` regex group before wildcard conversion (`lib/core/tool-registry.js`)

**Second Audit — 22 Additional Bugs:**

**P0 Critical (Security / Crash):**
- **BLOCKED_FLAGS bypass via `--eval=code`** — `sandboxExec` only checked exact flag match, allowing `--eval=code`, `-ecode`, and `--eval="malicious"` to pass. Added `_isBlockedFlag()` that checks `startsWith(flag + "=")` and short-flag concatenation patterns (`lib/core/guardrails.js`)
- **sandboxExec redundant `path.basename`** — `sandboxExec` called `path.basename(cmd)` even when `cmd` was already a basename (from `tool-registry.js`). Now only calls `basename` when `cmd` contains `path.sep`, avoiding incorrect resolution of full paths (`lib/core/guardrails.js`)
- **rateLimits Map unbounded growth** — `rateLimits` Map only cleaned up when `size > 100`, but entries never expired between cleanups. Added time-based cleanup every 60 seconds via `_lastRateCleanup` tracker (`lib/core/guardrails.js`)
- **safeWrite temp file leak on writeFileSync failure** — `safeWrite()` wrapped `renameSync` in try/catch but not `writeFileSync`. If write to temp file failed, orphan temp file remained. Now wraps both operations with cleanup (`lib/core/guardrails.js`)
- **Chat session outputFormat not overridable** — `createChatSession()` only used `agentSpec.outputFormat`, ignoring `options.outputFormat`. Now accepts `outputFormat` from options parameter, consistent with `runAgent` (`lib/core/agent-runtime.js`)
- **parseToolCalls key=value only matches double quotes** — Strategy 2b regex `/"([^"]*)"/g` only matched `key="value"`, missing `key='value'` and `key=value`. New regex handles double-quoted, single-quoted, and unquoted values (`lib/core/agent-runtime.js`)
- **executeToolIsolated missing `cwd` in fork** — Child process fork didn't set `cwd` option, so `process.cwd()` in child could differ from parent's project root. Now passes `cwd: projectRoot` in fork options (`lib/core/tool-registry.js`)

**P1 High (Logic Errors):**
- **fs.glob fallback regex `?` not converted** — Glob-to-regex escaped `?` to `\?` before replacing `?` with `[^/]`, so replacement never matched. Fixed by transforming glob wildcards (`**`, `*`, `?`) to placeholders BEFORE escaping regex metacharacters (`lib/core/tool-registry.js`)
- **fs.glob fallback doesn't skip node_modules/.git** — Unlike `search.grep`, fallback `walk()` entered `node_modules` and `.git` directories, causing slow scans and excessive results. Added skip check matching `search.grep` behavior (`lib/core/tool-registry.js`)
- **truncateResult shallow copy mutates original** — `{ ...result }` spread only copies top-level; mutating `truncated.matches` (array) also mutated `result.matches`. Changed to `JSON.parse(JSON.stringify(result))` for deep clone (`lib/core/tool-registry.js`)
- **Cache key missing projectDir** — `_cacheKey()` didn't include `projectDir`, so same agent name + input in different projects returned stale cross-project cache results. Added `projectDir` to cache key hash (`lib/core/agent-runtime.js`)
- **maxSteps accepts negative values** — `parseInt("-5")` = -5 passed `Math.min(-5, 50)` = -5, causing ReAct loop to never execute (`step < -5` = false). Added `Math.max(1, ...)` to enforce minimum of 1 (`lib/core/agent-runtime.js`)
- **Claude/Ollama missing default temperature** — `callClaude` and `callOllama` only set temperature when `options.temperature !== undefined`, defaulting to provider's API default (1.0) instead of 0.7. Now uses `0.7` as default, matching `callOpenAI` (`lib/core/llm-providers.js`)
- **requestQueue _finishJob removes wrong jobs** — Cleanup used Map insertion order instead of time order, potentially removing recent jobs instead of oldest. Now sorts by `enqueuedAt` before removing (`lib/core/request-queue.js`)
- **health-check swallows require errors** — `catch {}` blocks in `checkReadiness()` silently consumed module load errors, making debugging impossible. Now logs error messages and includes them in check output (`lib/core/health-check.js`)

**P2 Medium (Robustness):**
- **fs.read ignores offset/limit from schema** — Schema declared `offset`/`limit` as optional params but implementation never used them. Now implements 1-indexed line range reading with `totalLines` and `offset` in response (`lib/core/tool-registry.js`)
- **usage.saveUses passes cfgDir instead of projectDir** — `safeWrite()` received `cfgDir` as `projectRoot`, which could fail pathTraversal if cfgDir is a symlink outside project. Now passes `projectDir` for correct scope (`lib/core/usage.js`)
- **plugin.getSkillDir not exported** — `add.js` called `plugin.getSkillDir()` but it wasn't in `module.exports`, causing `TypeError: plugin.getSkillDir is not a function` crash. Added to exports (`lib/core/plugin.js`)
- **MCP run_agent schema requires agent_name** — Schema used `z.string()` (required) but description said "omit for default". Changed to `z.string().optional()` and added default agent resolution in `run-agent.js` (`lib/mcp/server.js`, `lib/mcp/tools/run-agent.js`)
- **tool-runner.js exits 0 on errors** — Permission denied, invalid args, and tool-not-found all used `process.exit(0)` (success), misleading parent process. Changed to `process.exit(1)` (`lib/core/tool-runner.js`)
- **API server no urlencoded body limit** — `express.json({ limit: "1mb" })` limited JSON but not URL-encoded bodies. Added `express.urlencoded({ limit: "1mb", extended: true })` for defense-in-depth (`lib/api/server.js`)

---

## [2.4.0] - 2026-05-05

### Added — HTTP API + Operational Readiness

- **🔥 `aiyu-multi-agent serve`** — Start HTTP API server (Express) with `/health`, `/metrics`, `/traces`, `/jobs` endpoints
- **`POST /jobs`** — Async job model: enqueue agent run → `{jobId, status: "queued"}`, integrates with request-queue
- **`GET /jobs/:id`** — Job status + result polling
- **`GET /jobs`** — List recent jobs with queue metrics
- **Graceful shutdown** — SIGTERM/SIGINT handler with 10s drain timeout, queue destroy, 503 for new requests during shutdown
- **Rate limiting** — 10 req/s per IP (reuses `guardrails.rateLimit`), 429 response when exceeded
- **MCP host authorization** — `mcp.allowedAgents` config in `.agent/config.yaml`, `run_agent` checks allowlist before execution (backward compatible — all allowed if not configured)
- **Secret scanning in publish** — Detects leaked API keys (OpenAI `sk-`, AWS `AKIA`, GitHub `ghp_`, npm `npm_`, Slack `xoxb`) in agent markdown. Warns by default, blocks with `--strict`
- **Prometheus `/metrics`** — HTTP-specific metrics: `aiyu_http_requests_total`, `aiyu_http_request_duration_seconds` (p50/p95/p99), `aiyu_queue_size`
- **Persistent traces** — `--trace-dir .traces/` option appends completed traces as JSONL, rotates at 10MB
- **Dockerfile** — Multi-stage build (node:20-slim), `.dockerignore`, `npm run docker:build`
- **docker-compose.yml** — aiyu-api service with healthcheck
- **Load test script** — `scripts/load-test.js [concurrency] [duration_sec]`
- **Smoke tests** — `lib/test/smoke/api.test.js` for API endpoint validation
- **CLI refactor** — Extracted inline commands from `bin/cli.js` to `lib/commands/init-inline.js` (thin router pattern)
- **`publish --strict`** — Block publish if leaked secrets detected
- **`serve --trace-dir`** — Enable persistent trace storage

### Changed

- `bin/cli.js` → thin router (~300 lines, was ~560), commands in `lib/commands/init-inline.js`
- `lib/publish/validator.js` — `validate()` now accepts `options.strict` for secret scanning
- `lib/mcp/tools/run-agent.js` — Added `getAllowedAgents()` for MCP host authorization

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
