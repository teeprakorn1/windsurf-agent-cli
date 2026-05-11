# Aiyu MultiAgent Dashboard

> Real-time monitoring dashboard for [Aiyu MultiAgent](https://github.com/teeprakorn1/aiyu-multi-agent) — v2.7.4

Live agent status, execution timeline, intervention panel, metrics, and logs — all streaming via WebSocket from the Aiyu API server.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js) ![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript) ![Tailwind](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?logo=tailwindcss)

---

## Quick Start

```bash
# Install dependencies
npm install

# Development (connects to aiyu API at localhost:3000)
NEXT_PUBLIC_WS_URL=ws://localhost:3000/ws npm run dev

# Production build
npm run build
npm start
```

The dashboard runs on **port 3001** by default. The API server must be running on **port 3000**.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AIYU_API_URL` | `http://localhost:3000` | Backend API URL (build-time + server-side proxy) |
| `AIYU_API_KEY` | `""` | API key for server-side proxy auth (injected as `x-api-key` header) |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:3000/ws` | WebSocket URL (client-side, embedded at build time) |
| `NEXT_PUBLIC_API_KEY` | `""` | API key for WS auth via `Sec-WebSocket-Protocol` (create `.env.local`) |
| `NEXT_PUBLIC_API_URL` | derived from `AIYU_API_URL` | API URL (client-side, auto-set) |
| `PORT` | `3001` | Dashboard HTTP port |
| `NEXT_PUBLIC_APP_VERSION` | `package.json` version | App version shown in header |

> **Note on `NEXT_PUBLIC_API_KEY`**: Create `.env.local` with `NEXT_PUBLIC_API_KEY=<your-aiyu-key>` so the dashboard can authenticate WebSocket connections. This key is sent via `Sec-WebSocket-Protocol` header (never exposed in URL query params).

## Docker

Run alongside the aiyu API server:

```bash
# From the aiyu-multi-agent repo root
docker compose up
```

Standalone:

```bash
docker build -t aiyu-dashboard \
  --build-arg AIYU_API_URL=http://host.docker.internal:3000 \
  --build-arg NEXT_PUBLIC_WS_URL=ws://host.docker.internal:3000/ws \
  --build-arg NEXT_PUBLIC_API_KEY=${AIYU_API_KEY:-} \
  .
docker run -p 3001:3001 \
  -e AIYU_API_URL=http://host.docker.internal:3000 \
  -e AIYU_API_KEY=${AIYU_API_KEY:-} \
  aiyu-dashboard
```

> **Standalone Build**: Uses `output: "standalone"` in `next.config.js`. The Dockerfile copies `.next/standalone`, `public/`, and `.next/static/` into the final image. Verified working with Node 20 Alpine.

---

## Features

### Core (P0)
- **Agent Status Panel** — live status grid (running, idle, error, completed)
- **Execution Timeline** — ReAct step timeline with thoughts, tool calls, results, duration
- **Intervention Panel** — send feedback or stop a running agent mid-execution
- **Run Input** — start new agent runs with provider selection (mock/openai/claude/ollama)

### Monitoring (P2)
- **Interaction Map** — visual agent graph with status colors
- **Memory Viewer** — agent memory browser (placeholder, pending `/memory` API)
- **Metrics Panel** — Prometheus metrics with offline indicator
- **Logs Viewer** — searchable, filtered event logs with type filters

### Polish (P3)
- **Dark Mode** — toggle between dark/light themes (dark default)
- **Export Traces** — download full run data (including chat, handoffs, delegates) as JSON
- **Keyboard Shortcuts** — `Ctrl+Enter` to run (works in textarea), `Esc` to clear
- **Auto-Reconnect** — WebSocket reconnects with exponential backoff (5 attempts, 1s–30s), step deduplication on reconnect
- **Mobile Responsive** — optimized for all screen sizes

### Chat & UI Upgrade (v2.7.3)
- **Unified ChatPanel** — Run mode merged into ChatPanel; full-width with internal sidebar for sessions and monitor
- **Session sidebar** — Search/filter sessions, message count per session, rounded cards with avatar, active ring, provider badge
- **Sidebar tabs** — Underline-style tabs (Chat=blue, Monitor=cyan) with icon labels
- **Compact header** — Pill-style AgentSelect/ProviderSelect with token usage badge and streaming indicator
- **New Chat dialog** — Gradient icon header, Agent/Provider selection before creating session
- **Chat UX** — Auto-create session on Enter, bouncing dots typing indicator, sender name + timestamp, hover copy button
- **Avatar dialog** — Click agent/user avatar for details (name, description, provider, model)
- **Markdown rendering** — All panels render markdown (bold, lists, code blocks, blockquotes)
- **Responsive mobile** — Sidebar slides in as overlay on mobile (<1024px), floating toggle button, auto-closes on select

### Performance & Accessibility (v2.7.2)
- **Context Memoization** — `WsProvider` memoizes context value with `useMemo`; all 7 leaf components wrapped with `React.memo`
- **Memory Safety** — `completedRuns` capped at 50 entries with oldest-first eviction
- **Reduced Motion** — `prefers-reduced-motion` media query disables animations for accessibility
- **Semantic HTML** — `<main role="main">`, `<section aria-label>` for screen readers
- **Confirmation Dialogs** — Reset and Stop Agent use custom modal dialogs instead of `window.confirm()`

---

## Architecture

```
┌─────────────────────┐     WebSocket      ┌──────────────────┐
│   Dashboard (Next)  │ ◄────────────────► │  Aiyu API Server │
│   :3001             │  Sec-WebSocket-   │  :3000            │
│                     │   Protocol: token   │                   │
│                     │                    │                   │
│  ┌───────────────┐  │  HTTP (server)     │  Express + WS    │
│  │ API Proxy     │──┼──────────────────►│  /metrics         │
│  │ /api/* → API  │  │  x-api-key header │  /agents/statuses │
│  └───────────────┘  │                    │                   │
│   React + Tailwind  │                    │   Node.js         │
│   TypeScript        │                    │                   │
└─────────────────────┘                    └──────────────────┘
```

All real-time data flows through the WebSocket connection defined in [WS-SCHEMA.md](../docs/WS-SCHEMA.md).

### Component Tree

```
WsProvider (context, useMemo)
 └── DashboardContent
      ├── Header (Export, Reset dialog, ThemeToggle, Connection badge)
      └── ChatPanel (full-width, flex split)
           ├── Session Sidebar (280px)
           │   ├── Tab Switcher (Chat | Monitor)
           │   ├── Chat Tab — Session list (search, cards, actions)
           │   └── Monitor Tab — AgentStatusPanel, MetricsPanel, InterventionPanel, ExecutionTimeline, InteractionMap, MemoryViewer, LogsViewer
           └── Main Chat Area
               ├── Session Header (agent, provider, token usage, streaming indicator)
               ├── Message List (user + assistant, markdown rendered, copy button)
               └── Input Bar (textarea, send button, auto-create session)
```

### WebSocket Events (Server → Client)

| Event | State Update |
|-------|-------------|
| `agent.status` | `agentStatuses` |
| `step` | `runs` (deduplicated append) |
| `complete` | `completedRuns` |
| `error` | `errors` (with stable timestamp) |
| `chat.created` | `chatSessions` |
| `chat.step` | `chatSteps` |
| `chat.complete` | `chatCompletions` |
| `handoff.started/complete` | `handoffs` (synthetic entry if started missed) |
| `delegate.started/complete` | `delegates` (synthetic entry if started missed) |

### WebSocket Messages (Client → Server)

| Message | Fields |
|---------|--------|
| `run` | `agentName?`, `input`, `provider?`, `maxSteps?` |
| `intervene` | `runId`, `message` |
| `chat.create` | `agentName?`, `provider?`, `model?` |
| `chat.send` | `sessionId`, `input` |
| `ping` | — |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` / `Cmd+Enter` | Start run |
| `Esc` | Clear input and agent name fields |

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── [...path]/route.ts  # Server-side API proxy (auth injection, path whitelist)
│   ├── globals.css          # Tailwind + custom CSS variables
│   ├── layout.tsx           # Root layout with ThemeProvider
│   └── page.tsx             # Main dashboard page (160 lines, refactored)
├── components/
│   ├── chat-panel.tsx        # Unified chat + monitor panel (v2.7.3)
│   ├── markdown-renderer.tsx # ReactMarkdown wrapper for agent output
│   ├── agent-status-panel.tsx
│   ├── execution-timeline.tsx
│   ├── intervention-panel.tsx
│   ├── interaction-map.tsx
│   ├── memory-viewer.tsx
│   ├── metrics-panel.tsx
│   ├── logs-viewer.tsx
│   ├── theme-provider.tsx
│   ├── theme-toggle.tsx
│   ├── agent-select.tsx      # Custom searchable dropdown with provider badges
│   ├── provider-select.tsx   # Custom LLM provider dropdown
│   ├── dashboard-header.tsx  # App info, export, reset, connection status
│   ├── run-panel.tsx         # New Run input panel
│   └── reset-dialog.tsx      # Confirmation modal
└── lib/
    ├── types.ts             # WS event type definitions
    ├── use-websocket.ts     # WebSocket hook (connect, parse, state, chat, validation)
    └── ws-context.tsx       # React context wrapper
```

---

## Security

| Feature | Implementation |
|---------|---------------|
| **CSP Headers** | `default-src 'self'`, `frame-ancestors 'none'`, `X-Frame-Options: DENY` via `next.config.js` |
| **API Proxy Whitelist** | Only `agents/*`, `jobs/*`, `health`, `metrics` allowed — 403 for everything else |
| **WS Auth** | Token sent via `Sec-WebSocket-Protocol: aiyu-token.<key>` (no query param exposure) |
| **Input Validation** | `validateInput()` / `validateIdentifier()` with length limits (10K chars, 256 id) |
| **No API Key Leak** | `AIYU_API_KEY` injected server-side as `x-api-key` header; never exposed to client |

---

## Development

```bash
# Run dev server with hot reload
npm run dev

# Lint
npm run lint

# Type check
npx tsc --noEmit

# Unit + integration tests (Jest + RTL)
npm test

# E2E tests (Playwright)
npm run test:e2e

# Production build
npm run build

# Production server
npm start
```

---

## License

MIT — same as [aiyu-multi-agent](https://github.com/teeprakorn1/aiyu-multi-agent)
