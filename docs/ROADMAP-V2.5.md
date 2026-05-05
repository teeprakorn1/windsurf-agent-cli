# Aiyu MultiAgent V2.5.0 — Roadmap

> **From:** v2.4.0 (HTTP API + Operational Readiness + MCP Server + Docker)
> **To:** v2.5.0 (TypeScript Migration + Agent Composition)
> **Timeline:** 5–7 days

---

## 📋 Definition of Done

- [ ] `aiyu-multi-agent serve` → HTTP API with `/health`, `/metrics`, `/traces`
- [ ] `kill` → graceful shutdown within 10s (no hang)
- [ ] 20 concurrent requests → no crash, error rate < 5%
- [ ] `docker run` → API accessible immediately
- [ ] MCP `run_agent` validates host authorization
- [ ] `aiyu-multi-agent publish` scans for leaked API keys

---

## 🎯 Priority Order

| # | Task | Days | Files | Priority |
|---|------|------|-------|----------|
| 1 | Graceful shutdown (SIGTERM/SIGINT) | 0.5 | `lib/api/shutdown.js` | 🔴 Must |
| 2 | HTTP API skeleton + `/health` | 1 | `lib/api/server.js`, `lib/api/middleware.js`, `bin/server.js` | 🔴 Must |
| 3 | Config + Error contract | 0.5 | `lib/api/config.js` | 🔴 Must |
| 4 | Async job model (`/jobs`) | 1 | `lib/api/jobs.js` | 🔴 Must |
| 5 | Queue integration at routes | 0.5 | route handlers | 🔴 Must |
| 6 | Rate limiting (10 req/s/IP) | 0.5 | `lib/api/rate-limit.js` | 🟠 Should |
| 7 | MCP host authorization | 0.5 | `lib/mcp/server.js` | 🟠 Should |
| 8 | Secret scanning in publish | 0.5 | `lib/publish/validator.js` | 🟠 Should |
| 9 | CLI command tests (smoke) | 1 | `lib/test/smoke/` | 🟠 Should |
| 10 | Extract `cli.js` inline commands | 1 | `lib/commands/*.js` | 🟡 Nice |
| 11 | Docker + deploy | 1 | `Dockerfile`, `docker-compose.yml` | 🔴 Must |
| 12 | Load test | 1 | `scripts/load-test.js` | 🔴 Must |
| 13 | Prometheus `/metrics` endpoint | 0.5 | `lib/api/server.js` | 🟠 Should |
| 14 | Persistent traces (file) | 0.5 | `lib/core/tracing.js` | 🟡 Nice |

---

## 🧱 Phase A — Infra Minimum (Day 1–2)

### A1) Graceful Shutdown

**File:** `lib/api/shutdown.js`

- [ ] `isShuttingDown` flag + `setServer()` + `gracefulShutdown()`
- [ ] In `gracefulShutdown()`: 1) flag=true 2) `queue.destroy()` 3) `server.close()` 4) `setTimeout(() => process.exit(1), 10000)` force exit
- [ ] `process.on("SIGTERM")` + `process.on("SIGINT")`
- [ ] Express middleware: check `isShuttingDown` → 503

**Test:** `node bin/server.js & PID=$!; sleep 2; kill $PID;` → exits within 10s

### A2) HTTP API Server

**Files:** `lib/api/server.js`, `lib/api/middleware.js`, `bin/server.js`

- [ ] `middleware.js`: requestLogger, shutdownGuard(503), errorHandler (standard `{error:{code,message}}`)
- [ ] `server.js`: Express + cors + json parser + routes:
  - `GET /health` → healthCheck.getFullHealthReport()
  - `GET /metrics` → usage.formatPrometheusMetrics()
  - `GET /traces` → tracing.getRecentTraces()
  - `GET /traces/:id` → tracing.getTrace()
  - `POST /run` → placeholder (Phase B)
  - `POST /generate` → placeholder (Phase B)
- [ ] `bin/server.js`: `createApp()` + `server.listen(PORT)` + `setServer(server)`
- [ ] `package.json` script: `"start": "node bin/server.js"`

**Test:**
- `curl localhost:3000/health` → 200
- `curl localhost:3000/metrics` → text/plain
- `curl localhost:3000/nonexistent` → 404 `{error:{code:"NOT_FOUND"}}`

### A3) Config + Error Contract

**File:** `lib/api/config.js`

- [ ] Env vars: `PORT`(3000), `QUEUE_CONCURRENCY`(5), `QUEUE_MAX`(100), `LLM_TIMEOUT_MS`(30000), `JOB_TIMEOUT_MS`(300000), `LLM_PROVIDER`(mock), `MAX_STEPS`(10)

| Code | HTTP | When |
|------|------|------|
| QUEUE_FULL | 429 | queue full |
| CIRCUIT_OPEN | 503 | LLM down (breaker open) |
| SHUTTING_DOWN | 503 | shutting down |
| VALIDATION_ERROR | 400 | bad input |
| NOT_FOUND | 404 | route missing |
| RATE_LIMITED | 429 | too fast (10 req/s) |
| INTERNAL_ERROR | 500 | other |

---

## ⚡ Phase B — API + Pipeline (Day 2–3)

### B1) Async Job Model

**File:** `lib/api/jobs.js`

- [ ] `POST /jobs` → enqueue agent run → `{jobId, status: "queued"}`
- [ ] `GET /jobs/:id` → status + result if completed
- [ ] `GET /jobs` → list recent jobs
- [ ] Job states: `queued → running → completed/failed`
- [ ] Integrate with `request-queue.js` (already exists)

### B2) Queue Integration

- [ ] Every `/run` and `/generate` route enqueues via `getDefaultQueue()`
- [ ] `CIRCUIT_OPEN` → 503 response
- [ ] `QUEUE_FULL` → 429 response

### B3) Rate Limiting (reuse guardrails)

**File:** `lib/api/rate-limit.js`

- [ ] Use `guardrails.rateLimit()` that already exists
- [ ] Limit: 10 req/s per IP
- [ ] Middleware: check → 429 if exceeded

### B4) MCP Host Authorization

**File:** `lib/mcp/server.js` update

- [ ] Add `allowedAgents` config in `.agent/config.yaml` → `mcp.allowedAgents: ["react-developer", "backend-specialist"]`
- [ ] If not configured → all agents allowed (backward compatible)
- [ ] `run_agent` checks allowlist before execution

### B5) Secret Scanning in Publish

**File:** `lib/publish/validator.js` update

- [ ] Scan agent markdown for API key patterns: `sk-...`, `AKIA...`, `ghp_...`
- [ ] Warn (not block) if found — `--strict` flag to block

---

## 🧪 Phase C — Testing (Day 3–4)

### C1) Smoke Tests

**File:** `lib/test/smoke/`

- [ ] `cli-commands.test.js` — test each CLI command exits correctly
- [ ] `mcp.test.js` — test MCP handshake + tool calls
- [ ] `api.test.js` — test HTTP API endpoints

### C2) Extract CLI Inline Commands

**Files:** `lib/commands/init-inline.js`, etc.

- [ ] Move `cmdInit`, `cmdUpdate`, `cmdVersion`, `cmdStatus`, `cmdList`, `cmdInfo`, `cmdChecklist`, `cmdUninstall` from `bin/cli.js` to `lib/commands/`
- [ ] `bin/cli.js` → thin router only (~100 lines)

---

## 🐳 Phase D — Docker + Deploy (Day 4–5)

### D1) Dockerfile

- [ ] Multi-stage build (node:20-slim)
- [ ] `.dockerignore`: `node_modules`, `.git`, `output/`
- [ ] `package.json` script: `"docker:build": "docker build -t aiyu-multi-agent ."`

### D2) docker-compose (optional)

- [ ] aiyu-api service + env vars
- [ ] Optional: prometheus + grafana

### D3) Load Test

**File:** `scripts/load-test.js`

- [ ] 10–30 concurrent POST `/jobs`, 2–5 min
- [ ] Measure: latency, error rate, queue depth, breaker state
- [ ] Acceptance: no crash, p95 < 5s, error rate < 5%

---

## 📊 Phase E — Monitoring (Day 5–6)

### E1) Prometheus Scrape

- [ ] `GET /metrics` in Prometheus format (already have `formatPrometheusMetrics()`)
- [ ] Add HTTP-specific metrics: `aiyu_http_requests_total`, `aiyu_http_request_duration_seconds`, `aiyu_queue_size`

### E2) Persistent Traces (optional)

- [ ] File-based trace storage: `--trace-dir .traces/`
- [ ] Append JSONL format, rotate at 10MB

---

## ⚠️ Pitfalls to Avoid

- ❌ Optimize framework before having a use case
- ❌ Add too many agents (start with 4 BA agents)
- ❌ Pretty output but unusable (focus usability)
- ❌ Monitoring before API exists (do after deploy)
- ❌ Sync `/generate` in production (must be async)
- ❌ Bypass queue (every request must enqueue)
- ❌ Forget rate limit (10 req/s/IP minimum)

---

## 📌 Dependencies to Add

| Package | Purpose |
|---------|---------|
| `express` | HTTP API framework |
| `cors` | Cross-origin support |

---

## 🔮 Future (V3.0)

- TypeScript migration (`.d.ts` first, full TS for new modules)
- Plugin sandboxing (V8 vm module instead of forked processes)
- Shared cache (Redis/file for multi-process)
- Agent composition (agents calling other agents at runtime)
- Streaming MCP (SSE transport + streaming `run_agent`)
