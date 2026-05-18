# Aiyu MultiAgent V2.7.6 → V2.8.0 — Agents-Bot Integration Roadmap

> Port features from FrameHandsomez's `agents-bot` POC into `aiyu-multi-agent` across 3 sprints, culminating in V2.8.0 with Vault Watcher + Auto-detect.

**Origin:** Analysis of [FrameHandsomez/agents-bot](https://github.com/FrameHandsomez/agents-bot) (NestJS + TypeScript, 24 commits, +5,929 lines). FrameHandsomez approved integration on 2026-05-17.

---

## Progress Overview

| Sprint | Features | Version | Status | Blocked By |
|:---:|:---|:---:|:---:|:---|
| 1 | Groq Provider + Frontmatter Task Runner | v2.7.6 | ✅ Done (staged) | — |
| 2 | Skill Chain Execution (`agent.chain`) | v2.7.7 | ⏳ Pending | Hermes branch merge |
| 3 | Vault Watcher + Auto-detect Agent | v2.8.0 | ⏳ Pending | Sprint 2 + Hermes |

---

## ✅ Sprint 1 — Groq Provider + Frontmatter Task Runner (v2.7.6)

**Branch:** `feat/groq-and-frontmatter`
**Status:** Implementation complete, staged locally, ready to commit.
**Diff:** 12 files, +526 / -14 lines

### 1.1 Groq Provider (5th LLM)

| File | Change |
|---|---|
| `lib/core/llm-providers.js` | `callGroq()` — OpenAI-compatible, `api.groq.com`, 1MB cap, keep-alive agent |
| `lib/core/failover.js` | Chain: `openai → claude → groq → ollama → mock`. Per-provider circuit breaker `llm:groq` |
| `lib/core/health-check.js` | Reports `groq: configured/not_configured` |
| `lib/commands/init.js` | Groq in provider choice list + auto-detect `GROQ_API_KEY` |

- **Env vars:** `GROQ_API_KEY` (required), `GROQ_MODEL` (optional, default `llama-3.3-70b-versatile`)
- **Free tier:** 14,400 req/day at console.groq.com
- **Models:** `llama-3.3-70b-versatile`, `mixtral-8x7b-32768`, `gemma2-9b-it`

### 1.2 Frontmatter Task Runner

| File | Change |
|---|---|
| `lib/commands/run-from-file.js` | NEW — `parseNoteFile()` + `runFromFile()` |
| `bin/cli.js` | Register `run-from-file <path>` command |
| `lib/api/server.js` | `POST /agents/run-from-note` endpoint (queue + 202) |

**Frontmatter spec:**
```yaml
---
agent: backend-specialist     # required (or --agent flag)
provider: groq                # optional
model: llama-3.3-70b-versatile # optional
maxSteps: 10                  # optional (1-50)
outputFormat: json            # optional
priority: high                # reserved for future
---
Build login API with JWT...   # task body → agent input
```

**Safety:** `pathTraversal()`, 1MB file cap, `isValidAgentName()`, maxSteps range validation.

### 1.3 Tests (Sprint 1)

9 new unit tests:
- `callGroq throws when GROQ_API_KEY missing`
- `callLLM rejects unknown provider` / `lists groq in error`
- `failover.resolveProvider returns groq when only GROQ_API_KEY set`
- `failover.buildFailoverChain includes/excludes groq`
- `parseNoteFile extracts fm + body` / `handles missing fm` / `handles empty fm`

**Total:** 38 unit + 25 production + 12 integration = **75 pass, 0 fail**

### 1.4 Acceptance Criteria

- [x] `npm run lint` passes
- [x] `npm test` passes (75 tests)
- [ ] Commit + push to `feat/groq-and-frontmatter`
- [ ] Open PR → pass branch protection (`test (18/20/22)`)
- [ ] 1 approval → merge → npm publish v2.7.6

---

## ⏳ Sprint 2 — Skill Chain Execution (v2.7.7)

**Branch:** `feat/agent-chain`
**Blocked by:** Hermes branch (`feature/deveveryday-cli`) merge into `main`
**ETA:** 2–3 hours after unblock
**Risk:** 🟢 Low

### 2.1 New Tool: `agent.chain`

| File | Change |
|---|---|
| `lib/core/tool-definitions.js` | Add `agent.chain` tool schema. Args: `agents: string[]`, `initialInput: string`, `stopOnError?: boolean` |
| `lib/core/prompt-builder.js` | Inject `agent.chain` into dynamic tool list |
| `docs/RUNTIME-SPEC.md` | Document chain semantics |

**Behavior:**
```
agent.chain(["frontend", "backend", "security"], "Build login page")
  → frontend runs with input → output becomes backend's input → ...
  → Returns { results: [...], finalOutput: "..." }
```

**Constraints:**
- Max 5 agents per chain (configurable: `AIYU_MAX_CHAIN_LENGTH`)
- Each link uses `runAgent` with full guardrails
- Same agent cannot appear twice consecutively (self-chain prevention)
- `stopOnError: true` aborts chain on first failure

### 2.2 HTTP Endpoint: `POST /agents/run-chain`

| File | Change |
|---|---|
| `lib/api/server.js` | New endpoint: `{ agents: [], input, options? }` → queue → 202 |
| `lib/api/ws.js` | Broadcast `chain.step.started` / `chain.step.complete` events |
| `docs/WS-SCHEMA.md` | Add chain.* event types |

### 2.3 Tests (Sprint 2)

- `agent.chain runs 3 agents in sequence`
- `agent.chain stops on error when stopOnError=true`
- `agent.chain rejects > MAX_CHAIN_LENGTH`
- `agent.chain rejects same agent twice in row`
- Integration: `POST /agents/run-chain → 202` with WS events

### 2.4 Acceptance Criteria

- [ ] Lint + all tests pass
- [ ] `tool-definitions.js` has `agent.chain` with schema
- [ ] WS schema updated
- [ ] CHANGELOG v2.7.7 entry
- [ ] PR + merge + npm publish

---

## ⏳ Sprint 3 — Vault Watcher + Auto-detect Agent (v2.8.0)

**Branch:** `feat/vault-watcher-and-auto-detect`
**Blocked by:** Sprint 2 merged
**ETA:** 6–8 hours
**Risk:** 🟡 Medium (new dependency, runtime watcher, security surface)

### 3.1 Dependency: `chokidar ^4.0.0`

| Justification |
|---|
| `fs.watch` has cross-platform inconsistencies (recursive only on macOS/Windows, no debounce) |
| `chokidar` is ~80KB, battle-tested, used by webpack/vite/nodemon |
| aiyu already accepts deps of similar size (inquirer, ws) |

### 3.2 Vault Watcher Module

| File | Change |
|---|---|
| `lib/core/vault-watcher.js` | NEW (~200 lines) — watch dir, debounce, parse, trigger agent |
| `lib/core/tool-definitions.js` | Add `vault.watch`, `vault.unwatch`, `vault.list` tools |
| `bin/cli.js` | New command: `aiyu-multi-agent watch <vaultPath> [--agent <name>]` |
| `lib/commands/run.js` | Add `--watch <vaultPath>` flag for long-running mode |
| `lib/api/server.js` | `POST /vault/watch`, `DELETE /vault/watch/:id`, `GET /vault/watch` |
| `lib/api/ws.js` | Broadcast `vault.file.changed`, `vault.run.started`, `vault.run.completed` |
| `docs/WS-SCHEMA.md` | Add 3 vault.* event types |

**Workflow:**
```
$ aiyu-multi-agent watch ./my-vault --agent backend-specialist

# User edits: ./my-vault/tasks/build-login.md
#   ---
#   agent: backend-specialist
#   provider: groq
#   ---
#   Build a login API...

# → chokidar 'change' → debounce 500ms → parseFrontmatter → runAgent
# → Result written to ./my-vault/tasks/build-login.result.md
```

**Safety:**
- Vault path must pass `pathTraversal()` (no `/etc`, `~/.ssh`, etc.)
- Max 1 watcher per process (prevent fork bomb)
- Max 10K files in vault (reject oversized vaults)
- Debounce 500ms (prevent rapid-fire on save)
- Loop guard: ignore `*.result.md` (prevent watching own output)
- Agent name validated via `isValidAgentName()`

### 3.3 Auto-detect Agent from Content

| File | Change |
|---|---|
| `lib/core/agent-router.js` (from Hermes) | Add `detectAgentFromContent(text)` method |
| `lib/core/vault-watcher.js` | Fallback: if frontmatter `agent:` missing → auto-detect |
| `lib/commands/run-from-file.js` | Same fallback for CLI |

**Scoring algorithm:**
1. Tokenize content (lowercase, strip punctuation)
2. For each agent in `.windsurf/agents/`, parse `description` + `when-to-activate`
3. Score = (agent keywords ∩ content tokens) / unique agent keywords
4. Return highest above threshold `0.15`, else `findDefaultAgent()`

### 3.4 Skill File

| File | Content |
|---|---|
| `.windsurf/skills/vault-watcher/SKILL.md` | NEW — skill description, examples, config reference |

### 3.5 Tests (Sprint 3)

**Unit:**
- `vault.watch starts/stops chokidar cleanly`
- `vault.watch rejects path outside projectRoot`
- `vault.watch debounces rapid changes`
- `vault.watch ignores .result.md`
- `parseFrontmatter from vault uses auto-detect when agent missing`
- `detectAgentFromContent returns highest-scoring agent`
- `detectAgentFromContent falls back below threshold`

**Integration:**
- Start watcher → write .md → assert agent runs + result file created
- WS events emitted in correct order
- Stop watcher → write file → no run triggered

### 3.6 Acceptance Criteria

- [ ] All lint/test/CI checks pass
- [ ] `chokidar` in `package.json` dependencies
- [ ] 3 HTTP endpoints + 3 WS event types documented
- [ ] CHANGELOG v2.8.0 (minor bump — new public API surface)
- [ ] CODEBASE.md updated
- [ ] README.md has Vault Watcher section
- [ ] PR + merge + npm publish

---

## 🔮 Future Ideas (Post V2.8.0)

Ideas collected but **not committed** — discuss before scheduling.

### Multi-model Routing (v2.8.1?)

Route different tool calls to different models within one agent run:
- Code generation → Claude Sonnet (accuracy)
- Simple extraction → Groq llama (speed)
- Summarization → GPT-4o-mini (cost)

**Requires:** `model-router.js` with per-tool-type routing config.

### Caching Layer Enhancement (v2.8.1?)

- Semantic similarity cache — cache hits for "similar enough" prompts (embedding-based)
- Per-agent cache TTL config in frontmatter
- Cache warm-up command: `aiyu-multi-agent cache warm ./prompts/`

### Streaming Output (v2.9.0?)

- SSE endpoint for real-time token streaming
- Dashboard `ExecutionTimeline` shows tokens as they arrive
- Groq + OpenAI streaming mode in `callGroq` / `callOpenAI`

### Multi-agent Collaboration (v3.0.0?)

- Shared scratchpad between agents in chain
- Parallel agent execution (fan-out / fan-in pattern)
- Conflict resolution when 2 agents disagree

---

## 🛡️ Cross-Sprint Standards

### Branch Protection (All Sprints)
- Pass `test (18/20/22)` status checks
- 1 approval (FrameHandsomez or self if offline > 24h)
- Up-to-date with `main`

### Security Audit (After Each Merge)
```bash
python3 .windsurf/skills/vulnerability-scanner/scripts/security_scan.py .
python3 .windsurf/scripts/checklist.py .
```

### Karpathy SURGICAL Check (Before Each PR)
- "Does every changed line trace to one of the sprint's features?"
- "Is there any change >5KB in a single file that isn't a new module?"

### Documentation Contract
Each sprint updates: `CHANGELOG.md`, `CODEBASE.md`, `README.md`, `package.json` version.

---

## 📅 Timeline (Optimistic)

| Day | Activity |
|---|---|
| Day 1 | Sprint 1 commit + push + PR |
| Day 2 | FrameHandsomez returns → Hermes PR review |
| Day 3 | Sprint 1 merged + Hermes merged → Sprint 2 starts |
| Day 4 | Sprint 2 PR opened |
| Day 5 | Sprint 2 merged → Sprint 3 starts |
| Day 7–8 | Sprint 3 implementation |
| Day 9 | Sprint 3 PR opened |
| Day 11 | Sprint 3 merged → **v2.8.0 released** 🎉 |

---

## ❌ Explicitly NOT Porting from agents-bot

| agents-bot Feature | Reason to Skip |
|---|---|
| NestJS DI / `ILlmProvider` interface | aiyu's functional style is simpler + faster |
| `LlmService` wrapper class | `callLLMWithFailover` already handles CB + retry |
| Skill abstract class (TypeScript) | aiyu's markdown-based skills are richer |
| `gray-matter` npm dep | aiyu's built-in `parseFrontmatter` + YAML is enough |
| Bun-only runtime | Keep dual runtime (Node 18/20/22) |
| MongoDB persistence | SQLite (from Hermes) is lighter for CLI |

---

## 🔗 Dependencies & Coordination

| Dependency | Owner | Status | Impact |
|---|---|---|---|
| Hermes branch (`feature/deveveryday-cli`) | FrameHandsomez | 24 commits, review pending | Blocks Sprint 2-3 (agent-router.js, session-store.js) |
| GitHub PAT rotation | powersm | ⚠️ Leaked in chat | Must rotate before Sprint 1 push |
| npm publish access | powersm | Active | Required for each version bump |

---

*Last updated: 2026-05-18*
