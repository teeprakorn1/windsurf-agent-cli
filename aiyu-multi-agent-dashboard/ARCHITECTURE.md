# Aiyu MultiAgent Dashboard — Architecture

> Version 2.7.1

## System Overview

```
┌──────────────────────────┐          ┌──────────────────────────┐
│     Dashboard (Next.js)  │          │    Aiyu API (Express)    │
│     Port 3001            │          │    Port 3000             │
│                          │          │                          │
│  ┌────────────────────┐  │  WS      │  ┌────────────────────┐ │
│  │ useWebSocket hook  │◄─┼─────────►│  │ lib/api/ws.js      │ │
│  │ (connect, parse,   │  │  /ws     │  │ (broadcast, validate│ │
│  │  state management) │  │          │  │  client types)     │ │
│  └────────┬───────────┘  │          │  └────────────────────┘ │
│           │               │          │                          │
│  ┌────────▼───────────┐  │  HTTP     │  ┌────────────────────┐ │
│  │ WsContext (React)  │  │◄────────►│  │ lib/api/server.js  │ │
│  │ (provider + hook)  │  │          │  │ (/metrics,          │ │
│  └────────┬───────────┘  │          │  │  /agents/statuses) │ │
│           │               │          │  └────────────────────┘ │
│  ┌────────▼───────────┐  │          │                          │
│  │ UI Components      │  │          │                          │
│  │ (9 components,     │  │          │                          │
│  │  all React.memo)   │  │          │                          │
│  └────────────────────┘  │          │                          │
└──────────────────────────┘          └──────────────────────────┘
```

## Data Flow

### WebSocket Events (Server → Dashboard)

```
agent.status  ──► agentStatuses: Record<string, AgentStatus>
step          ──► runs: Record<string, RunStep[]>
complete      ──► completedRuns: Record<string, CompletedRun>
error         ──► errors: { message: string; time: number }[]
chat.created  ──► chatSessions: Record<string, ChatSession>
chat.step     ──► chatSteps: ChatStep[]
chat.complete ──► chatCompletions: Record<string, ChatCompletion>
handoff.*     ──► handoffs: HandoffRecord[]
delegate.*    ──► delegates: DelegateRecord[]
pong          ──► (no state update)
intervene.ack ──► (no state update)
subscribe.ack ──► (no state update)
```

### WebSocket Messages (Dashboard → Server)

```
run          ──► { type: "run", agentName?, input, provider?, maxSteps? }
intervene    ──► { type: "intervene", runId, message }
chat.create  ──► { type: "chat.create", agentName?, provider?, model? }
chat.send    ──► { type: "chat.send", sessionId, input }
ping         ──► { type: "ping" }
```

## Component Architecture

```
WsProvider (src/lib/ws-context.tsx)
 │
 └── DashboardContent (src/app/page.tsx)
      │
      ├── Header
      │   ├── Logo + Version badge
      │   ├── Export button → handleExport()
      │   ├── ThemeToggle
      │   └── Connection status badge (Live/Offline)
      │
      ├── Left Column (lg:col-span-4)
      │   ├── New Run card
      │   │   ├── Agent name input
      │   │   ├── Task textarea
      │   │   ├── Provider select (mock/openai/claude/ollama)
      │   │   └── Run button
      │   ├── Stats cards (agent count, active runs)
      │   ├── AgentStatusPanel
      │   ├── InterventionPanel
      │   └── MetricsPanel
      │
      ├── Right Column (lg:col-span-8)
      │   ├── InteractionMap
      │   ├── ExecutionTimeline
      │   └── Grid: MemoryViewer | LogsViewer
      │
      └── Error toast (fixed bottom-right)
```

## State Management

All state lives in `useWebSocket` hook, distributed via React context:

| State | Type | Updated By |
|-------|------|-----------|
| `connected` | `boolean` | WS onopen/onclose |
| `agentStatuses` | `Record<string, AgentStatus>` | `agent.status` event (TTL 30min cleanup) |
| `runs` | `Record<string, RunStep[]>` | `step` event (deduplicated append) |
| `completedRuns` | `Record<string, CompletedRun>` | `complete` event |
| `errors` | `{message, time}[]` | `error` event + send failures |
| `chatSessions` | `Record<string, ChatSession>` | `chat.created` event |
| `chatSteps` | `ChatStep[]` | `chat.step` event |
| `chatCompletions` | `Record<string, ChatCompletion>` | `chat.complete` event |
| `handoffs` | `HandoffRecord[]` | `handoff.started/complete` events (synthetic on race) |
| `delegates` | `DelegateRecord[]` | `delegate.started/complete` events (synthetic on race) |

## Memory Management

| Resource | Limit | Strategy |
|----------|-------|----------|
| `runs` | 50 entries | Evict oldest when limit reached |
| `steps per run` | 100 | Sliding window, deduplicated by step number |
| `chatSteps` | 500 | Sliding window |
| `handoffs` / `delegates` | 500 | Sliding window, synthetic entry on race condition |
| `agentStatuses` | No hard limit | TTL cleanup every 60s (30min expiry) |
| `completedRuns` | 50 entries | Oldest-first eviction in periodic cleanup (60s) |
| `errors` | 50 | Sliding window |

## Reconnection Strategy

```
Delay = min(1000ms × 2^attempt, 30000ms)
Max attempts: 5

Attempt 1: 1s
Attempt 2: 2s
Attempt 3: 4s
Attempt 4: 8s
Attempt 5: 16s
→ "Please refresh the page"
```

## Theming

CSS variables in `globals.css` under `:root` (light) and `.dark` (dark):

- `--bg-primary` / `--bg-card` / `--border-color`
- `--text-primary` / `--text-secondary` / `--text-muted`
- `--glow-blue` / `--glow-green` / `--glow-purple` / `--glow-red`

Toggle via `next-themes` with `attribute="class"` strategy.

## Performance

- **Context memoization:** `WsProvider` uses `useMemo` on context value — only re-renders consumers when actual state slices change
- **Component memoization:** All 7 leaf components wrapped with `React.memo` — prevents cascading re-renders from unrelated state changes
- **Reduced motion:** `prefers-reduced-motion` media query disables all animations/transitions

## Accessibility

- Semantic HTML: `<main role="main">`, `<section aria-label="Controls">`, `<section aria-label="Activity">`
- Confirmation dialogs: Custom modal dialogs for destructive actions (Reset, Stop) instead of `window.confirm()`
- ARIA attributes: `role="dialog"`, `aria-modal="true"`, `aria-label` on interactive elements

## File Dependencies

```
page.tsx → ws-context.tsx (useMemo) → use-websocket.ts → types.ts
page.tsx → all components (React.memo) → ws-context.tsx
metrics-panel.tsx → fetch /api/metrics → API proxy route → AIYU_API_URL/metrics
api/[...path]/route.ts → AIYU_API_URL + AIYU_API_KEY (server-side proxy)
theme-toggle.tsx → theme-provider.tsx → next-themes
```
