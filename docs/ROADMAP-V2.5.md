# Aiyu MultiAgent V2.5.1 — Roadmap

> **From:** v2.5.0 (Claude Design-inspired features + 31 bug fixes)
> **To:** v2.5.1 (System audit — 14 bug fixes + 4 pre-existing test fixes)
> **Timeline:** Completed

---

## ✅ V2.4 Completed (Previously)

- [x] `aiyu-multi-agent serve` → HTTP API with `/health`, `/metrics`, `/traces`
- [x] `kill` → graceful shutdown within 10s (no hang)
- [x] 20 concurrent requests → no crash, error rate < 5%
- [x] MCP `run_agent` validates host authorization
- [x] `aiyu-multi-agent publish` scans for leaked API keys
- [x] Prometheus `/metrics` endpoint
- [x] Rate limiting (10 req/s/IP)
- [x] Async job model (`/jobs`)

---

## ✅ V2.5 Completed — Claude Design-Inspired Features

### V2.5.0 — New Features

| # | Feature | Files | Status |
|---|---------|-------|--------|
| 1 | **WebSocket Streaming** — Real-time agent step events via `/ws` | `lib/api/ws.js`, `bin/server.js` | ✅ Done |
| 2 | **Agent Handoff** — `POST /handoff` chains agents with context bundles | `lib/api/handoff.js`, `lib/core/handoff.js` | ✅ Done |
| 3 | **Inline Intervention** — `POST /agents/intervene` injects mid-run feedback | `lib/api/handoff.js`, `lib/api/ws.js` | ✅ Done |
| 4 | **`fetch.url` Tool** — Agents fetch external HTTP(S) URLs | `lib/core/tool-registry.js` | ✅ Done |
| 5 | **Agent System Auto-Apply** — Auto-detects project context from package.json/rules | `lib/core/agent-system.js`, `lib/core/agent-runtime.js` | ✅ Done |

### Bug Fixes (31 bugs)

| Severity | Count | Key Fixes |
|----------|-------|-----------|
| P0 Critical | 8 | **Unauthenticated API**, **No LLM failover**, parseToolCalls escaped flag, shell.exec path-prefix bypass, fs.edit multiple occurrences, fetch.url NET_TOOLS missing, circuit breaker double-entry, **runAgent crypto.createHash crash** |
| P1 High | 9 | WebSocket memory leaks, Ollama health check 5xx, chat error continuity, cache key raw options, _isBlockedFlag over-aggressive, PENDING_INTERVENTIONS leak, **Ollama OLLAMA_HOST ignored**, **inline intervention dead code**, **sandboxExec env leak** |
| P2 Medium | 10 | search.grep async walk, cache skill hash, fs.glob character class, temperature inconsistency, kv-pair spaces, **WebSocket ID collision**, **fetch.url no redirects**, **fetch.url byte count**, **usage race condition**, **queue singleton reset** |
| P3 Low | 4 | **tracing rotation collision**, **fetch.url falsy body**, **OTel ID length**, **rule extraction first line** |

---

## ✅ V2.5.1 Completed — System Audit Bug Fixes

### Bug Fixes (25 bugs + 4 pre-existing test fixes)

| Severity | Count | Key Fixes |
|----------|-------|----------|
| P0 Critical | 6 | **Per-provider circuit breaker** (global `"llm"` key blocked failover), **Rate limit Map unbounded growth** (no hard cap for unique keys), **search.grep regex lastIndex skip** (`g` flag + forEach = missed matches), **X-Forwarded-For spoofing bypasses rate limit** (AIYU_TRUST_PROXY), **_cacheGet returns mutable reference** (Object.freeze fallback), **PENDING_INTERVENTIONS not exported** (POST /agents/intervene broken) |
| P1 High | 7 | **Chat session no provider failover**, **Chat sessions no TTL** (memory leak), **postinstall crash on malformed package.json**, **jobs.js + handoff.js stale breaker check**, **Handoff bundle file global tmpdir conflict** (project-scoped path), **truncateResult redundant deep clone** (shallow copy), **jobs.js redundant err.code assignment** |
| P2 Medium | 12 | **Cache deep clone on every hit**, **Handoff bundles lost on restart**, **truncateResult double parse**, **usage buffer not flushed on exit**, **tracing p95 index overflow**, **CORS origin unrestricted**, **fs.glob brace alternation regex metachar**, **LLM retry off-by-one** (4→3 attempts), **Queue _finishJob event order**, **Handoff extractDecisions operator precedence**, **crypto require duplicated in function body**, **Ollama health check ignores https** |
| Pre-existing | 4 | **Test async/await missing** (checkReadiness, getFullHealthReport), **Trace ID length wrong** (16→32, 8→16 per OTel spec), **Queue status "ready" not in test allowlist** |

### Detailed Changes

| # | Bug | File | Fix |
|---|-----|------|-----|
| 1 | Circuit breaker global `"llm"` key | `agent-runtime.js` | Per-provider keys `llm:openai`, `llm:claude` etc. + `callLLMWithFailover()` + `isAnyLlmAvailable()` |
| 2 | Rate limit Map leak for unique keys | `guardrails.js` | Hard cap 200 entries + FIFO eviction |
| 3 | search.grep regex lastIndex in forEach | `tool-registry.js` | for-loop + reset `lastIndex` before each `test()` |
| 4 | Chat session no provider failover | `agent-runtime.js` | Uses `callLLMWithFailover()` like `runAgent` |
| 5 | Cache deep clone on every hit | `agent-runtime.js` | Clone only object/array + try-catch for circular refs |
| 6 | Handoff bundles lost on restart | `api/handoff.js` | Persist to temp file + load on startup |
| 7 | Chat sessions no TTL | `api/ws.js` | 30min TTL + periodic cleanup every 5min |
| 8 | postinstall crash on malformed package.json | `bin/postinstall.js` | try-catch around `JSON.parse` |
| 9 | truncateResult double parse | `tool-registry.js` | Reuse `JSON.stringify` result instead of `JSON.parse(JSON.stringify())` |
| 10 | Usage buffer not flushed on exit | `usage.js` | `process.on("exit", _flushBuffer)` |
| 11 | Tracing p95 index overflow | `tracing.js` | `Math.min(index, length-1)` |
| 12 | CORS origin unrestricted | `api/server.js` | `AIYU_CORS_ORIGIN` env var |
| 13 | jobs.js + handoff.js stale breaker check | `api/jobs.js`, `api/handoff.js` | Use `isAnyLlmAvailable()` from agent-runtime |
| 14 | fs.glob brace alternation regex metachar | `tool-registry.js` | Escape each alternative individually + placeholder restore |
| 15 | X-Forwarded-For spoofing bypasses rate limit | `rate-limit.js`, `server.js` | `req.ip` primary + `AIYU_TRUST_PROXY` env var + Express trust proxy |
| 16 | `_cacheGet` returns mutable reference | `agent-runtime.js` | `Object.freeze()` shallow copy fallback for circular refs |
| 17 | `PENDING_INTERVENTIONS` not exported from ws.js | `ws.js` | Added to module.exports |
| 18 | Handoff bundle file global tmpdir conflict | `api/handoff.js` | Project-scoped path (`cfgDir/handoff-bundles.json`) + PID fallback |
| 19 | `truncateResult` redundant deep clone | `tool-registry.js` | Shallow copy `{...result}` instead of `JSON.parse(JSON.stringify())` |
| 20 | `jobs.js` redundant `err.code` assignment | `api/jobs.js` | Removed no-op assignment |
| 21 | LLM retry off-by-one | `llm-providers.js` | `attempt < maxRetries` instead of `attempt <= maxRetries` |
| 22 | Queue `_finishJob` event order | `request-queue.js` | Emit events before `_processNext()` |
| 23 | Handoff `extractDecisions` operator precedence | `handoff.js` | Added explicit parentheses |
| 24 | `crypto` require duplicated in function body | `agent-runtime.js` | Moved to top-level require |
| 25 | Ollama health check ignores https | `health-check.js` | Select http/https transport based on URL protocol |

---

## 🔮 Future (V3.0)

- TypeScript migration (`.d.ts` first, full TS for new modules)
- Plugin sandboxing (V8 vm module instead of forked processes)
- Shared cache (Redis/file for multi-process)
- Agent composition (agents calling other agents at runtime)
- Streaming MCP (SSE transport + streaming `run_agent`)
- Docker + load test (moved to V3 backlog)

