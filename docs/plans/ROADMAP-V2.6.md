# Aiyu MultiAgent V2.6–V2.8 — Open Design Integration Roadmap

> นำแนวคิดจาก [nexu-io/open-design](https://github.com/nexu-io/open-design) มาประยุกต์ใช้กับ aiyu-multi-agent แบ่ง 3 Phase ตามลำดับความสำคัญ

---

## V2.6.0 completed — module decomposition + reliability hardening

### Phase 0 — codebase quality (completed)

| # | Change | Files | Impact |
|---|--------|-------|--------|
| 1 | **Decompose agent-runtime.js** (843 → 69 lines + 8 modules) | `react-loop.js`, `chat-session.js`, `failover.js`, `cache.js`, `agent-loader.js`, `prompt-builder.js`, `input-sanitizer.js`, `tool-parser.js` | Maintainability ⬆️ |
| 2 | **Decompose tool-registry.js** (543 → 3 modules) | `tool-definitions.js`, `search-tools.js`, `command-parser.js` | Maintainability ⬆️ |
| 3 | **Tracing async write queue** | `tracing.js` | No more `appendFileSync` blocking event loop |
| 4 | **MCP run_agent timeout + maxSteps cap** | `lib/mcp/server.js` | 2min timeout, max 20 steps — prevents runaway agents |
| 5 | **Usage flush fix** | `usage.js` | `beforeExit` + sync fallback on forced exit |
| 6 | **Docker hardening** | `Dockerfile`, `.dockerignore` | Non-root user, expanded .dockerignore, inline HEALTHCHECK |
| 7 | **Docker healthcheck fix** | `docker-compose.yml` | `http.request` with 3s timeout instead of `http.get` |
| 8 | **Dev command** | `bin/cli.js` | REPL with verbose tool logging, trace support |
| 9 | **TypeScript declarations** | `lib/core/types.d.ts` | 12 core modules typed — foundation for TS migration |

### Backward compatibility

All existing `require("./agent-runtime")` and `require("./tool-registry")` calls work unchanged — both files are now thin re-exports.

---

## Phase 1 — core infrastructure (V2.6.0)

> ขยาย runtime engine ให้รองรับ local CLI + persistence + project isolation

### 1.1 Multi-CLI PATH Scanner

**เป้าหมาย:** สแกน PATH หา AI CLI (claude, codex, gemini, cursor-agent, copilot, qwen, deepseek ฯลฯ) แล้ว spawn เป็น engine เสริมคู่กับ LLM API

**Deliverables:**
- `lib/core/cli-scanner.js` — สแกน PATH + ตรวจเวอร์ชัน + สร้าง adapter ต่อ CLI
- `lib/core/cli-adapters/` — per-CLI adapter (claude-stream, codex-stream, generic-stream)
- ขยาย `agent-runtime.js` — เพิ่มโหมด `engine: "cli"` เป็นตัวเลือกเสริมนอกจาก `engine: "api"`
- `lib/core/config.js` — เพิ่ม `cliEngines` ใน config.yaml

**ไฟล์ที่เกี่ยวข้อง:** `agent-runtime.js`, `config.js`, `llm-providers.js`, `package.json`

**เกณฑ์สำเร็จ:**
- `aiyu-multi-agent run "hello" --engine cli:claude` ทำงานได้
- Fallback ไป LLM API เมื่อ CLI ไม่พบ
- Circuit breaker ครอบ CLI engine ด้วย

---

### 1.2 SQLite Chat Persistence

**เป้าหมาย:** เก็บ chat session ใน SQLite แทน memory — ปิด terminal แล้วกลับมาทำต่อได้

**Deliverables:**
- `lib/core/session-store.js` — SQLite wrapper (better-sqlite3 / sql.js fallback) สำหรับ sessions, messages, steps
- ปรับ `lib/commands/chat.js` — load/save session จาก SQLite
- `aiyu-multi-agent chat --resume <id>` — กลับมาทำต่อ
- Schema: sessions, messages, steps, artifacts

**ไฟล์ที่เกี่ยวข้อง:** `chat.js`, `agent-runtime.js`, `package.json`

**เกณฑ์สำเร็จ:**
- ปิด terminal → เปิดใหม่ → `--resume` กลับมาทำต่อได้
- ข้อมูลไม่หาย
- TTL cleanup 30 นาที (เหมือนที่มีใน ws.js)

---

### 1.3 Per-Project Working Folder

**เป้าหมาย:** แยก cwd ตาม project ID — ป้องกันไฟล์ชนกันเมื่อรันหลาย agent

**Deliverables:**
- `.agent/projects/<id>/` — โครงสร้างโฟลเดอร์ต่อ project
- ปรับ `agent-runtime.js` — `runAgent` รับ `projectDir` แล้วใช้เป็น cwd
- ปรับ `tool-runner.js` — fork ด้วย cwd ที่ถูกต้อง
- `lib/api/jobs.js` — สร้าง project folder อัตโนมัติตอน enqueue

**ไฟล์ที่เกี่ยวข้อง:** `agent-runtime.js`, `tool-runner.js`, `jobs.js`, `config.js`

**เกณฑ์สำเร็จ:**
- รัน 2 agents พร้อมกัน → ไฟล์ไม่ชนกัน
- `shell.exec` cwd = project folder
- `fs.read/write` ยังอยู่ใน project boundary (guardrails)

---

## Phase 2 — skills & design system (V2.7.0)

> เพิ่ม design capability ผ่าน skill + design token system

### 2.1 DESIGN.md Skill

**เป้าหมาย:** สร้าง design token system เป็น Markdown ที่สลับได้ทันที (เหมือน Open Design)

**Deliverables:**
- `.windsurf/skills/design-systems/` — skill ใหม่
  - `SKILL.md` — คำสั่งสำหรับ frontend/design agent
  - `assets/` — template HTML/CSS
  - `references/` — checklist, anti-patterns
- `design-systems/` — โฟลเดอร์ DESIGN.md แต่ละระบบ (linear, stripe, vercel, notion ฯลฯ)
- ขยาย `plugin.js` — `aiyu-multi-agent add design-system <name>` ติดตั้งจาก npm
- `lib/core/design-token.js` — parser สำหรับ DESIGN.md → CSS variables

**เกณฑ์สำเร็จ:**
- `aiyu-multi-agent add design-system linear` ติดตั้งได้
- Agent อ่าน DESIGN.md → ใช้ token ใน output
- สลับ design system → output เปลี่ยนตาม

---

### 2.2 Question-Form Guardrail

**เป้าหมาย:** บังคับให้ agent ถามก่อนทำ — structured discovery form แทนการสร้าง code ทันที

**Deliverables:**
- `.windsurf/rules/question-form.md` — rule ใหม่ (keywords: design, build, create, implement)
- เพิ่มใน `agent-runtime.js` — ตรวจ rule → inject question-form prompt ใน turn 1
- รองรับทั้ง `runAgent` และ `createChatSession`

**เกณฑ์สำเร็จ:**
- Agent ถาม structured form ก่อนสร้าง code
- User เลือก default → ข้าม form ได้
- ใช้ได้กับทุก agent ที่มี rule นี้

---

## Phase 3 — quality & observability

> เพิ่ม quality gate + BYOK proxy + artifact format

### 3.1 Anti-Slop Quality Gate

**เป้าหมาย:** 5-dim self-critique + P0/P1/P2 checklist — ป้องกัน AI slop output

**Deliverables:**
- `.windsurf/skills/quality-gate/` — skill ใหม่
  - `SKILL.md` — คำสั่ง self-critique
  - `references/checklist.md` — P0/P1/P2 gates
  - `references/slop-blacklist.md` — สิ่งที่ห้ามทำ
- ขยาย `agent-runtime.js` — post-step hook ตรวจ quality ก่อนส่ง output

---

### 3.2 BYOK LLM Proxy Endpoint

**เป้าหมาย:** เพิ่ม `/api/proxy/{provider}/stream` — client อื่นเรียก LLM ผ่าน aiyu-multi-agent ได้

**Deliverables:**
- `lib/api/proxy.js` — SSE proxy route
- รองรับ anthropic, openai, azure, google
- SSRF blocking (link-local, RFC1918)
- Rate limit + circuit breaker ครอบ

---

### 3.3 Artifact Output Format

**เป้าหมาย:** `outputFormat: "artifact"` — แยก output เป็น structured artifact (HTML, CSS, JS) แทน plain text

**Deliverables:**
- ขยาย `agent-runtime.js` — parse `<artifact>` tag จาก LLM output
- `lib/core/artifact-parser.js` — streaming parser
- `lib/api/artifacts.js` — save/lint/download endpoints

---

## Timeline

| Phase | Version | Focus | ระยะเวลาแนะนำ |
|-------|---------|-------|----------------|
| **1** | V2.6.0 | CLI Scanner + SQLite + Project Folder | 2-3 สัปดาห์ |
| **2** | V2.7.0 | DESIGN.md + Question-form | 1-2 สัปดาห์ |
| **3** | V2.8.0 | Quality Gate + Proxy + Artifact | 2 สัปดาห์ |

---

## Dependencies

```
Phase 1.2 (SQLite) → Phase 1.3 (Project Folder) — project folder ใช้ session store
Phase 1.1 (CLI Scanner) → independent — ทำแยกได้
Phase 2.1 (DESIGN.md) → Phase 2.2 (Question-form) — question-form ใช้กับ design skill
Phase 3.1 (Quality Gate) → Phase 2.1 — ตรวจ design output
Phase 3.2 (Proxy) → Phase 1.1 — proxy ใช้ adapter จาก CLI scanner
Phase 3.3 (Artifact) → Phase 1.2 — artifact เก็บใน session store
```

## Risk

| Risk | Mitigation |
|------|-----------|
| better-sqlite3 native build พัง | ใช้ `sql.js` (WASM) เป็น fallback |
| CLI spawn ไม่ stable | Circuit breaker + timeout + fallback ไป API |
| DESIGN.md fragment ไม่ครบ | สร้าง default + validation schema |
| Artifact parser ซับซ้อน | เริ่มจาก HTML-only ก่อน |

---

## Source reference

แนวคิดทั้งหมดมาจากการวิเคราะห์ [nexu-io/open-design](https://github.com/nexu-io/open-design) — open-source alternative ของ Claude Design

| # | จาก Open Design | ประยุกต์ใช้ | Phase |
|---|---|---|---|
| 1 | Multi-CLI PATH Scanner (15 CLI) | `cli-scanner.js` + adapters | 1.1 |
| 2 | SQLite session persistence | `session-store.js` + `--resume` | 1.2 |
| 3 | Per-project working folder (`.od/projects/<id>/`) | `.agent/projects/<id>/` | 1.3 |
| 4 | DESIGN.md portable Markdown (9-section) | `design-systems/` skill | 2.1 |
| 5 | Question-form protocol (`<question-form>`) | rule + prompt injection | 2.2 |
| 6 | Anti-slop machinery (5-dim critique, blacklist) | `quality-gate` skill | 3.1 |
| 7 | BYOK SSE proxy (`/api/proxy/{provider}/stream`) | `lib/api/proxy.js` | 3.2 |
| 8 | Artifact streaming parser (`<artifact>`) | `artifact-parser.js` | 3.3 |
