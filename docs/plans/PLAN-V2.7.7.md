# Plan V2.7.7 — Multi-CLI PATH Scanner + Question-Form + Quality Gate + Artifact Parser

> Port 4 pending features from ROADMAP-V2.6.md Phase 1-3 into aiyu-multi-agent, starting with CLI Scanner infrastructure.

---

## Overview

| # | Feature | Branch | Est. | Status |
|---|---|---|---|---|
| 1 | Multi-CLI PATH Scanner | `feat/cli-scanner` | 6-8h | ⏳ Pending |
| 2 | Question-Form Guardrail | `feat/question-form` | 2-3h | ⏳ Pending |
| 3 | Anti-Slop Quality Gate | `feat/quality-gate` | 4-5h | ⏳ Pending |
| 4 | Artifact Output Format | `feat/artifact-parser` | 6h | ⏳ Pending |

**Version:** v2.7.7 (minor — new features, no breaking changes)
**Pre-requisite:** Sprint 1 (v2.7.6) committed

---

## Feature 1: Multi-CLI PATH Scanner

### Goal

Scan `$PATH` for AI CLIs (claude, codex, gemini, cursor-agent, copilot, qwen, deepseek, aider) and spawn them as alternative engines alongside LLM API providers.

### New Files

| File | Purpose |
|---|---|
| `lib/core/cli-scanner.js` | `scanPath()`, `detectVersion()`, `buildCliRegistry()` — cached 5min |
| `lib/core/cli-adapters/claude-adapter.js` | `claude --print -p <prompt>` → stdout |
| `lib/core/cli-adapters/codex-adapter.js` | `codex --quiet -a <prompt>` → stdout |
| `lib/core/cli-adapters/generic-adapter.js` | Fallback: `<bin> <prompt>` → stdout (configurable) |

### Modified Files

| File | Change |
|---|---|
| `lib/core/llm-providers.js` | Add `case "cli:<name>":` dispatcher |
| `lib/core/failover.js` | CLI adapters after API providers, before mock |
| `lib/core/config.js` | `loadCliEngineConfig()` — reads `cliEngines:` from config.yaml |
| `lib/core/health-check.js` | Report available CLI engines |
| `bin/cli.js` | Add `--engine cli:<name>` option + `engines` subcommand |

### CLI Interface

```bash
aiyu-multi-agent run "hello" --engine cli:claude
aiyu-multi-agent run "hello" --engine cli:codex
aiyu-multi-agent engines                          # list detected CLIs
```

### Safety

- Spawn timeout: 120s (configurable via `CLI_TIMEOUT_MS`)
- Circuit breaker: `cli:<name>` per-adapter
- No `shell: true` — direct spawn only
- Max output: 1MB (same as API providers)
- No env passthrough beyond `PATH`, `HOME`, `TERM`

### Tests (5)

- `scanPath` detects mock binary in PATH
- `scanPath` handles missing binary gracefully
- `generic-adapter.call` spawns process, returns stdout
- `callLLM("cli:mock")` dispatches to adapter
- `buildFailoverChain` includes CLI engines when available

---

## Feature 2: Question-Form Guardrail

### Goal

Force agents to ask structured discovery questions in turn 1 before generating code, when triggered by matching keywords.

### New Files

| File | Purpose |
|---|---|
| `.windsurf/rules/question-form.md` | Rule definition with keywords + form template |

### Modified Files

| File | Change |
|---|---|
| `lib/core/prompt-builder.js` | If `question-form` rule matches AND step === 1 → inject form |
| `lib/core/react-loop.js` | Pass `stepNumber` to prompt builder |
| `lib/core/chat-session.js` | Pass turn number |

### Form Template (5 questions)

1. **Purpose** — What problem does this solve?
2. **Users** — Who will use this?
3. **Scope** — MVP or full feature?
4. **Constraints** — Tech stack, timeline?
5. **Success criteria** — How do we know it works?

### Bypass

- `--no-form` CLI flag skips injection
- User answering "skip" / "default" proceeds directly

### Tests (4)

- Rule triggers on matching keywords in first turn
- Rule does NOT trigger on turn 2+
- `--no-form` bypasses injection
- Non-matching keywords do not trigger

---

## Feature 3: Anti-Slop Quality Gate

### Goal

Post-step hook that checks LLM output for quality issues before returning to user: banned phrases, hallucinated APIs, security violations.

### New Files

| File | Purpose |
|---|---|
| `lib/core/quality-gate.js` | `checkQuality(output, options)` → `{ pass, score, violations[] }` |
| `.windsurf/skills/quality-gate/SKILL.md` | 5-dimension self-critique protocol |
| `.windsurf/skills/quality-gate/references/checklist.md` | P0/P1/P2 gates |
| `.windsurf/skills/quality-gate/references/slop-blacklist.md` | Banned patterns |

### Modified Files

| File | Change |
|---|---|
| `lib/core/react-loop.js` | After final step → `checkQuality()` before return |
| `lib/core/prompt-builder.js` | Inject quality instructions when skill loaded |

### 5-Dimension Scoring

| Dim | Check | Priority |
|---|---|---|
| Accuracy | No hallucinated APIs/functions | P0 |
| Completeness | All requirements addressed | P1 |
| Conciseness | No filler, no unnecessary comments | P1 |
| Safety | No hardcoded secrets, no eval() | P0 |
| Style | Follows project conventions | P2 |

### Slop Blacklist (examples)

- "I'd be happy to help"
- "Let me know if you need anything else"
- Comments restating what code says
- `console.log("here")` in production

### Tests (4)

- `checkQuality` detects blacklisted phrases
- `checkQuality` passes clean output
- Final step triggers quality gate
- Quality gate failure → retry with feedback (or warn)

---

## Feature 4: Artifact Output Format

### Goal

Parse `<artifact>` tags from LLM responses into structured file objects (HTML, CSS, JS, etc.) for direct-to-disk writing.

### New Files

| File | Purpose |
|---|---|
| `lib/core/artifact-parser.js` | `parseArtifacts(text)` → `{ artifacts[], text[] }` |

### Modified Files

| File | Change |
|---|---|
| `lib/core/react-loop.js` | If `outputFormat === "artifact"` → parse final output |
| `lib/core/prompt-builder.js` | Artifact mode → inject format instructions |
| `lib/api/server.js` | `GET /artifacts/:jobId` — retrieve parsed artifacts |
| `bin/cli.js` | `--output-format artifact` flag + write to disk |

### Tag Spec

```xml
<artifact type="html" filename="index.html">
<!DOCTYPE html>...
</artifact>

<artifact type="css" filename="styles.css">
body { ... }
</artifact>
```

Supported types: `html`, `css`, `js`, `ts`, `json`, `yaml`, `md`, `python`, `shell`

### Parser Rules

- Streaming-safe: accumulate until `</artifact>`
- Multiple artifacts per response
- Non-artifact text → `{ type: "text", content }`
- Unclosed tags → graceful fallback to plain text

### Tests (5)

- Parse single artifact
- Parse multiple artifacts
- Handle unclosed tag (graceful fallback)
- No artifacts → passthrough
- CLI `--output-format artifact` writes files

---

## Execution Strategy

Each feature: **branch → implement → test → review → commit → merge**

```
feat/cli-scanner ──────────> review ──> merge
                                          │
feat/question-form ────────> review ──> merge
                                          │
feat/quality-gate ─────────> review ──> merge
                                          │
feat/artifact-parser ──────> review ──> merge
                                          │
                                    v2.7.7 tag + npm publish
```

All 4 features merge into single version bump (v2.7.7).

---

## Done Criteria (All Features)

- [ ] `npm run lint` passes
- [ ] `npm test` passes (all existing + ~18 new tests)
- [ ] CHANGELOG.md updated (v2.7.7 entry)
- [ ] CODEBASE.md updated
- [ ] README.md sections added
- [ ] package.json version = 2.7.7

---

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| CLI spawn hangs | High | 120s timeout + circuit breaker |
| CLI output format varies per tool | Medium | generic-adapter normalizes |
| Quality gate over-rejects good output | Medium | Configurable threshold + `--no-quality-gate` |
| Artifact parser edge cases | Low | Graceful fallback to plain text |
| better-sqlite3 conflict (if SQLite later) | Low | Features are independent |

---

*Created: 2026-05-18*
