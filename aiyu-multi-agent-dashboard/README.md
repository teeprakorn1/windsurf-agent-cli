# Aiyu MultiAgent Dashboard

> Real-time monitoring dashboard for [Aiyu MultiAgent](https://github.com/teeprakorn1/aiyu-multi-agent) — v2.7.1

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
| `NEXT_PUBLIC_API_KEY` | `""` | API key for WS auth (auto-appended as `?token=` param) |
| `NEXT_PUBLIC_API_URL` | derived from `AIYU_API_URL` | API URL (client-side, auto-set) |
| `PORT` | `3001` | Dashboard HTTP port |
| `NEXT_PUBLIC_APP_VERSION` | `package.json` version | App version shown in header |

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
  --build-arg NEXT_PUBLIC_WS_URL=ws://localhost:3000/ws \
  --build-arg NEXT_PUBLIC_API_KEY=${AIYU_API_KEY:-} \
  .
docker run -p 3001:3001 \
  -e AIYU_API_URL=http://host.docker.internal:3000 \
  -e AIYU_API_KEY=${AIYU_API_KEY:-} \
  aiyu-dashboard
```

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

### Performance & Accessibility (v2.7.1)
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
│   :3001             │     /ws?token=      │  :3000            │
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
      ├── <section aria-label="Controls">
      │   ├── New Run (input + provider select)
      │   ├── Stats Cards (agent count, active runs)
      │   ├── AgentStatusPanel (React.memo)
      │   ├── InterventionPanel (React.memo, Stop confirmation)
      │   └── MetricsPanel (React.memo)
      └── <section aria-label="Activity">
          ├── InteractionMap (React.memo)
          ├── ExecutionTimeline (React.memo)
          └── Grid: MemoryViewer (React.memo) | LogsViewer (React.memo)
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
│   │   └── [...path]/route.ts  # Server-side API proxy (auth injection)
│   ├── globals.css          # Tailwind + custom CSS variables
│   ├── layout.tsx           # Root layout with ThemeProvider
│   └── page.tsx             # Main dashboard page
├── components/
│   ├── agent-status-panel.tsx
│   ├── execution-timeline.tsx
│   ├── intervention-panel.tsx
│   ├── interaction-map.tsx
│   ├── memory-viewer.tsx
│   ├── metrics-panel.tsx
│   ├── logs-viewer.tsx
│   ├── theme-provider.tsx
│   └── theme-toggle.tsx
└── lib/
    ├── types.ts             # WS event type definitions
    ├── use-websocket.ts     # WebSocket hook (connect, parse, state, chat)
    └── ws-context.tsx       # React context wrapper
```

---

## Development

```bash
# Run dev server with hot reload
npm run dev

# Lint
npm run lint

# Type check
npx tsc --noEmit

# Production build
npm run build
```

---

## License

MIT — same as [aiyu-multi-agent](https://github.com/teeprakorn1/aiyu-multi-agent)
