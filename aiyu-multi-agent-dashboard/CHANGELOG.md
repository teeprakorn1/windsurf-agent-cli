# Changelog

All notable changes to **aiyu-multi-agent-dashboard** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.7.5] — 2026-05-12

### Refactored — ChatPanel Component Decomposition

**ChatPanel reduced from 1026 → 599 lines (-42%)** by extracting 5 focused sub-components:

- **`chat-sidebar.tsx`** (177 lines) — Sidebar tabs (Chat/Monitor), session search + listing, monitor panels (AgentStatus, Metrics, Intervention, ExecutionTimeline, InteractionMap, MemoryViewer, LogsViewer)
- **`chat-history-panel.tsx`** (240 lines) — Chat history view with stats bar (session count, message count, token total), search filter, session grouping (Today/Yesterday/Earlier), expand/collapse per session, per-message user/assistant preview with click-to-scroll, token totals per session
- **`chat-message-bubble.tsx`** (139 lines) — Message bubble with avatar, markdown rendering, ReAct steps (expandable), handoff/delegate cards, usage badge, copy button, date separator
- **`session-header.tsx`** (84 lines) — Agent info button with avatar popup, AgentSelect/ProviderSelect dropdowns, session token usage badge, streaming indicator (Loader2 pulse), history/intervention/export toggle buttons
- **`chat-input-area.tsx`** (76 lines) — Textarea with auto-resize, send/clear buttons (Send, X icons), keyboard hint (Ctrl+Enter), character count

All components pass necessary props explicitly; no Zustand store access inside sub-components (single responsibility). Build passes (`tsc` + `next build`), 18/18 tests pass.

---

## [2.7.4] — 2026-05-11

### Changed — UI Consistency & Compact Design (Dashboard)

**LogsViewer**
- **Custom calendar picker** — Replaced native `<input type="date">` with custom calendar component (month nav, day grid, log date highlighting, today indicator). Dates with logs show blue tint, selected date shows blue background (`logs-viewer.tsx`)
- **Custom agent dropdown** — Replaced native `<select>` with custom dropdown matching panel design style. Shows agent name, status dot, step count. Selected state with blue ring (`logs-viewer.tsx`)
- **Sort toggle** — Added button to toggle between newest/oldest sort order with ArrowUpDown icon (`logs-viewer.tsx`)
- **Type filter chips** — Added filter chips for log types (step, complete, error, handoff, delegate) with icons and colors (`logs-viewer.tsx`)
- **Compact log cards** — Smaller fonts (text-[10px]), tighter spacing, date and agent name displayed in each entry (`logs-viewer.tsx`)

**ExecutionTimeline**
- **Compact header** — Icon + title + count badge (activity count) in one row (`execution-timeline.tsx`)
- **Status dot instead of icon box** — Replaced large icon boxes with small colored dots (blue pulse for running, green for completed, red for error) (`execution-timeline.tsx`)
- **Inspected state highlight** — Active activity shows blue ring + blue background tint (`execution-timeline.tsx`)
- **Smaller step entries** — Reduced font sizes (text-[9px] step number, text-[10px] message), tighter padding (`execution-timeline.tsx`)

**MemoryViewer**
- **Compact header** — Icon + title + count badge (interaction count) (`memory-viewer.tsx`)
- **Type dot + status dot** — Shows handoff (cyan) or delegate (amber) type dot + status dot (blue/green/red/amber) (`memory-viewer.tsx`)
- **Consistent card style** — Matches other panels with border, hover effect, chevron-down icon (`memory-viewer.tsx`)

**InterventionPanel**
- **Compact header** — Icon + title + running count indicator (blue pulse dot + count) (`intervention-panel.tsx`)
- **Status dots** — Activity selector shows status dot (blue pulse for running, gray for idle) (`intervention-panel.tsx`)
- **Consistent dropdown** — Custom dropdown matching panel design with selected state ring (`intervention-panel.tsx`)
- **Compact buttons** — Smaller fonts (text-[10px]), tighter padding, consistent button styles (`intervention-panel.tsx`)

**MetricsPanel**
- Already compact from prior session (p-3, text-[10px] header, grid-cols-2 stat cards) — no changes needed

### Fixed

**High**
- **[H1] Chat mode does not broadcast `agent.status` events** — `handleChatCreate` and `handleChatSend` in `ws.js` did not call `setAgentStatus()`, so `AgentStatusPanel` showed "No agents running" during chat sessions. Added `setAgentStatus()` at session creation (`"idle"`), chat send start (`"running"`), and chat send completion (`"completed"`/`"error"`). Agent status now updates in real-time for both Run and Chat modes (`lib/api/ws.js`)
- **[H2] ExecutionTimeline empty during chat sessions** — Component only read from `runs`/`completedRuns` (Run mode events). Fixed by merging `chatSteps`/`chatCompletions` into timeline data using `useMemo` (`execution-timeline.tsx`)
- **[H3] LogsViewer empty during chat sessions** — Same root cause. Fixed by including `chatSteps` and `chatCompletions` in log entries (`logs-viewer.tsx`)
- **[H4] InterventionPanel shows "No active runs" during chat** — Only checked `runs`/`completedRuns`. Fixed by also detecting active chat sessions from `chatSteps`/`chatCompletions` (`intervention-panel.tsx`)

**Medium**
- **[M1] MetricsPanel not parsing duration/queue metrics** — `sumMetric` matched too broadly. Replaced with `findExact`/`findLabeled` helpers. Now shows: HTTP Requests, Avg Response, P95 Latency, Agent Runs, Commands, Queue, Error Rate, Days Active, Test Runs (`metrics-panel.tsx`)
- **[M2] MetricsPanel missing token usage** — Added token computation from `completedRuns` + `chatCompletions` WS data. Shows Tokens, Prompt, Completion cards (`metrics-panel.tsx`)

## [2.7.3] — 2026-05-08

### Fixed

**Critical**
- **[C1] WebSocket disconnects immediately in React Strict Mode** — `useWebSocket` cleanup called `wsRef.current?.close()` synchronously on unmount. React Strict Mode's mount→unmount→remount cycle closed the WS before it could establish, then stale `onclose` handler nulled `wsRef.current`, preventing the remounted connection from persisting. Fixed with **deferred close pattern**: cleanup sets a 100ms `closeTimer` instead of closing immediately; remount cancels the timer so WS stays alive. Added stale WS guard (`wsRef.current !== ws`) in all handlers (`src/lib/use-websocket.ts`)

**High**
- **[H1] Markdown not rendered in Execution Timeline, Agent Status, Logs** — `step.thought`, `step.result`, `completed.output`, and log entries used plain `<p>`/`<pre>` tags instead of `MarkdownRenderer`. Now all agent output renders markdown (bold, lists, code blocks, blockquotes, etc.) (`execution-timeline.tsx`, `agent-status-panel.tsx`, `logs-viewer.tsx`)
- **[H2] Global Enter handler conflicts with Chat textarea** — `page.tsx` global `keydown` handler triggered `handleRun()` on `Enter` in any `<textarea>`, causing both chat-send and run-agent to fire simultaneously. Fixed: global handler now only triggers on `Ctrl/Cmd+Enter`; plain `Enter` in chat only sends chat message (`page.tsx`)
- **[H3] Agent Status Panel hover flickers in dark mode** — Missing `dark:border` and `dark:hover:border` classes caused border to appear/disappear on hover. Added proper dark mode border variants (`agent-status-panel.tsx`)

**Medium**
- **[M1] Dropdown menus clipped by parent overflow** — `glass-card` had `overflow-hidden` which clipped absolute-positioned dropdowns. Removed `overflow-hidden` from container, raised dropdown z-index to `z-[999]` (`chat-panel.tsx`, `agent-select.tsx`, `provider-select.tsx`)
- **[M2] AgentSelect dropdown hidden behind ProviderSelect** — `z-50` on wrapper divs created stacking context overlap. Removed `z-50` from wrappers, kept high z-index only on dropdown panels (`agent-select.tsx`, `provider-select.tsx`)
- **[M3] ProviderSelect shows unavailable providers** — Health endpoint uses `"configured"` status but filter only checked `"enabled"/"available"`. Fixed filter to include `"configured"` and `"ok"`. Defaults `availableProviders` to `["mock"]` so unavailable providers never appear before health responds. Auto-switches to `mock` if selected provider becomes unavailable. Applied to both `RunPanel` and `ChatPanel` (`chat-panel.tsx`, `page.tsx`, `run-panel.tsx`, `provider-select.tsx`)

### Added

- **`react-markdown` + `remark-gfm`** — Required by `markdown-renderer.tsx` (chat panel) but missing from `package.json` in v2.7.2
- **Chat auto-create session** — Pressing Enter in chat textarea auto-creates a session if none exists, with pending message queue that auto-sends once session is ready (`chat-panel.tsx`)
- **Provider filtering** — `ProviderSelect` now accepts `availableProviders` prop and only shows providers that are actually configured on the backend (fetched from `/api/health` every 30s). Auto-switches to `mock` if selected provider becomes unavailable. Applied to both `RunPanel` and `ChatPanel` (`provider-select.tsx`, `chat-panel.tsx`, `run-panel.tsx`, `page.tsx`)

### Changed

- **Split layout** — Dashboard restructured from 12-column grid to flex split: left sidebar (420px, scrollable) for Run/Status/Metrics/Timeline/Logs, right panel (flex-1, full-height) for Chat (`page.tsx`)
- **Chat panel rewrite** — Full-height chat with session sidebar (rename/export/close), collapsible inline steps, handoff visualization (purple badge), intervention bar, streaming indicator, and auto-scroll (`chat-panel.tsx`)
- **New Chat dropdown** — "+" button now opens a dropdown with Agent/Provider selection before creating session (`chat-panel.tsx`)

## [2.7.2] — 2026-05-07

### Fixed

- **Dependency sync** — Bumped `aiyu-multi-agent` dependency version to v2.7.2 (no API key required for init)

## [2.7.1] — 2026-05-07

### Added

- **Accessibility:** `prefers-reduced-motion` media query — disables all animations/transitions for users who prefer reduced motion
- **Accessibility:** Semantic HTML — `<main role="main">`, `<section aria-label>` for Controls and Activity columns
- **UX:** Confirmation dialogs — Reset and Stop Agent actions now use custom modal dialogs instead of `window.confirm()`

### Fixed

**Critical**
- **[C1]** WebSocket infinite reconnect loop on hydration — `wsUrl` now memoized with `useMemo`, preventing unstable reference triggering `useEffect` reconnect loop
- **[C2]** Docker deployment broken — `NEXT_PUBLIC_*` env vars are build-time in Next.js; added `ARG` + `ENV` in Dockerfile, `build.args` in docker-compose, and `AIYU_API_URL` for rewrites in `next.config.js`
- **[C3]** SSRF vulnerability on `/api/metrics` — server-side fetch now uses `AIYU_API_URL` (not client-exposed) with URL allowlist validation (`localhost`, `127.0.0.1`, `::1`, `0.0.0.0`)
- **[C4]** `Ctrl+Enter` shortcut blocked in task textarea — removed `tag !== "TEXTAREA"` exclusion so shortcut works while typing in the task input
- **[C5]** `import pkg from package.json` crashes in Docker standalone — replaced with `NEXT_PUBLIC_APP_VERSION` env var (package.json not available in standalone builds)
- **[C6]** Duplicate steps on WS reconnect — added step deduplication by filtering `existing.filter(s => s.step !== e.step)` before appending

**High**
- **[H1]** Unbounded memory growth in `chatSteps`, `handoffs`, `delegates` arrays — capped at `MAX_ARRAY_SIZE=500` with sliding window
- **[H2]** `useCallbackRef` render-time ref assignment — moved to `useEffect` to avoid React concurrent mode issues
- **[H3]** `handleExport` duplicate code path + resource leak — refactored to single path with `safeReplacer` for BigInt serialization
- **[H4]** Type narrowing in WS event switch — removed all `as any` casts, added proper `timestamp?` field to `StepEvent`, `CompleteEvent`, `ChatStepEvent`, `ChatCompleteEvent` in `types.ts`
- **[H5]** Backend `complete` event missing `timestamp` — added `_isoNow()` to `step`, `complete`, and `chat.complete` events in `ws.js`
- **[H6]** `completedRuns` memory leak — added periodic cleanup timer (60s) to evict orphaned entries
- **[H7]** `agentStatuses` memory leak — added TTL-based cleanup (30min) matching backend `AGENT_STATUS_TTL_MS`
- **[H8]** SSRF allowlist blocks Docker network hostnames — `METRICS_PROXY_ALLOWED_HOSTS` env var allows custom hostnames (e.g. `aiyu-api`)
- **[H9]** `/ws` rewrite in `next.config.js` is dead code — removed; Next.js rewrites don't proxy WebSocket connections
- **[H10]** `handoff.complete` / `delegate.complete` race condition — create synthetic entry when `complete` arrives before `started`

**Medium**
- **[M1]** MemoryViewer dead placeholder — now wired to WS context, shows handoff/delegate records
- **[M2]** InteractionMap duplicated AgentStatusPanel — now shows agent interaction edges (handoffs/delegates) between agent nodes
- **[M3]** LogsViewer missing handoff/delegate events — now includes them with filter options
- **[M4]** `showToast` timeout leak on unmount — cleanup via `useRef` + `useEffect` cleanup; added toast display in JSX
- **[M5]** `next.config.js` rewrites hardcoded to `localhost:3000` — now uses `AIYU_API_URL` env var
- **[M6]** Prometheus regex too strict — patterns now tolerate labels via `(?:\{[^}]*\})?`
- **[M7]** Dockerfile port 3000 conflicts with API server — changed to `EXPOSE 3001` / `ENV PORT=3001`
- **[M8]** Export trace missing chat/handoff/delegate data — `handleExport` now includes all WS state
- **[M9]** Backend `chat.step` missing `timestamp` field — added `timestamp: _isoNow()` in `ws.js`
- **[M10]** Blob URL leak on unmount — replaced `setTimeout` revoke with `useRef` + cleanup on unmount

**Low**
- **[L1]** Light mode dot pattern was `none` — now renders subtle dot grid
- **[L2]** ESLint missing TypeScript rules — added `next/typescript` to extends
- **[L3]** Log entry key collision potential — replaced composite string key with unique incrementing `id` counter via `useRef` (was global mutable, now scoped to component)
- **[L4]** Interaction Map missing agent nodes from edges — auto-add agent nodes from handoff/delegate edge data
- **[L5]** Version hardcoded as `v0.0.1` — now reads from `NEXT_PUBLIC_APP_VERSION` env var
- **[L6]** Context re-render storm — `WsProvider` now memoizes context value with `useMemo` + all 7 leaf components wrapped with `React.memo`
- **[L7]** `completedRuns` unbounded memory — capped at 50 entries with oldest-first eviction in periodic cleanup
- **[L8]** `.glass-card` duplicate CSS definitions — consolidated into single rule with `.dark` variant

### Changed

- `ws-context.tsx` — empty interface replaced with `type` alias
- `.eslintrc.json` — added `next/typescript` for TS lint rules
- `Dockerfile` — added `ARG AIYU_API_URL`, `ARG AIYU_WS_URL` for build-time env injection; port changed from 3000 to 3001
- `docker-compose.yml` — `aiyu-dashboard` now uses `build.args` for env vars
- `next.config.js` — rewrites destination derived from `AIYU_API_URL` env var; added `NEXT_PUBLIC_APP_VERSION`; removed `/ws` rewrite
- `use-websocket.ts` — added `AGENT_STATUS_TTL_MS` constant, periodic cleanup timer, step deduplication, synthetic entries for late-arriving events
- `metrics/route.ts` — `ALLOWED_HOSTS` now includes `METRICS_PROXY_ALLOWED_HOSTS` env var
- `page.tsx` — version badge reads from `NEXT_PUBLIC_APP_VERSION`, export includes all WS state, blob URL cleanup via ref, semantic HTML (`<main>`, `<section>`), custom Reset dialog
- `ws-context.tsx` — `useMemo` on context value to prevent re-render storm
- `use-websocket.ts` — `completedRuns` now capped at 50 entries
- `globals.css` — consolidated `.glass-card` CSS, added `prefers-reduced-motion` media query
- `intervention-panel.tsx` — Stop button now shows confirmation dialog before force-stopping
- All 7 components — wrapped with `React.memo` for render optimization

## [0.0.1] — 2026-05-06

### Added

**Core Dashboard (P0)**
- Agent Status Panel — live status grid (running, idle, error, completed) with glow animations
- Execution Timeline — ReAct step timeline with thoughts, tool calls, results, duration
- Intervention Panel — send feedback or stop a running agent mid-execution
- Run Input — start new agent runs with provider selection (mock/openai/claude/ollama)
- WebSocket hook (`use-websocket.ts`) — connect, parse events, manage state
- WS Context (`ws-context.tsx`) — React context wrapper for shared WS state
- Type definitions (`types.ts`) — all WS event types mirroring WS-SCHEMA.md

**Enhanced Monitoring (P2)**
- Interaction Map — visual agent graph with status colors
- Memory Viewer — agent memory browser (placeholder, pending `/memory` API)
- Metrics Panel — Prometheus metrics polling with offline indicator
- Logs Viewer — searchable, filtered event logs with type filters

**Polish (P3)**
- Dark Mode — toggle between dark/light themes (dark default) via next-themes
- Export Traces — download run data as JSON with safe fallback for BigInt/circular
- Keyboard Shortcuts — `Ctrl+Enter` to run, `Esc` to clear
- Auto-Reconnect — WebSocket reconnects with exponential backoff (5 attempts, 1s–30s)
- Mobile Responsive — optimized for all screen sizes with touch-manipulation

**Infrastructure**
- Dockerfile + docker-compose integration (aiyu-dashboard on :3001)
- Next.js 14 + Tailwind CSS 3.4 + TypeScript 5.5
- Custom CSS variables for theming (light/dark)
- Glass-card design system with glow effects

### Fixed

- **[Critical]** Error timestamps now stable — errors stored as `{message, time}[]` instead of `string[]` with computed timestamps that shifted on every render
- **[Critical]** Execution timeline key collision — composite key `${runId}-${step}-${timestamp}` prevents duplicate keys when steps arrive in same millisecond
- **[Critical]** Export JSON crash — try/catch with fallback that nulls out `usage` field if `JSON.stringify` fails on BigInt/circular values
- **[High]** Silent WS send failure — `sendRun`/`sendIntervene`/`sendPing` now check `readyState === OPEN` before sending, push error if disconnected
- **[High]** `chat.complete` event ignored — now stored in `chatCompletions` state
- **[High]** Handoff/delegate events ignored — now stored in `handoffs`/`delegates` state arrays with proper merge on completion
- **[High]** `max_steps` badge showed as "idle" — now correctly shows error badge with "max steps" label
- **[High]** Metrics panel showed fake mock data when offline — now shows "—" values with "Offline" badge
- **[Medium]** Object URL revoked too early — delayed to 1s after click for Safari/Edge compatibility
- **[Medium]** Server timestamps overwritten — `parseServerTime()` uses server ISO timestamps when available
- **[Medium]** Empty thought string treated as falsy — `||` changed to `??` for nullish coalescing
- **[Medium]** Keyboard listener re-attached on every keystroke — stable `useCallbackRef` prevents unnecessary add/remove

### Known Limitations

- Memory Viewer is a placeholder — requires `/memory` API endpoint on the server
- No runtime validation of incoming WS events — malformed payloads may corrupt state
- `class-variance-authority`, `clsx`, `tailwind-merge` are installed but unused (dead deps)
