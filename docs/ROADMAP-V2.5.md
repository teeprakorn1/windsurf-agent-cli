# Aiyu MultiAgent V2.5.0 — Roadmap

> **From:** v2.4.1 (Bug fix release — 22 bugs fixed)
> **To:** v2.5.0 (Claude Design-inspired features + 31 bug fixes)
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

## 🔮 Future (V3.0)

- TypeScript migration (`.d.ts` first, full TS for new modules)
- Plugin sandboxing (V8 vm module instead of forked processes)
- Shared cache (Redis/file for multi-process)
- Agent composition (agents calling other agents at runtime)
- Streaming MCP (SSE transport + streaming `run_agent`)
- Docker + load test (moved to V3 backlog)
