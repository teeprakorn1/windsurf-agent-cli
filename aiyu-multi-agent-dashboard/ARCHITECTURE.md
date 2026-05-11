# Aiyu MultiAgent Dashboard — Architecture

> Version 2.7.4

## System Overview

```
┌──────────────────────────┐          ┌──────────────────────────┐
│     Dashboard (Next.js)  │          │    Aiyu API (Express)    │
│     Port 3001            │          │    Port 3000             │
│                          │          │                          │
│  ┌────────────────────┐  │  WS      │  ┌────────────────────┐ │
│  │ Zustand Store      │◄─┼─────────►│  │ lib/api/ws.js      │ │
│  │ (store.ts)         │  │  /ws     │  │ (broadcast,       │ │
│  │  activities,       │  │          │  │  validate types)  │ │
│  │  agent statuses,   │  │          │  └────────────────────┘ │
│  │  notifications     │  │          │                          │
│  └────────┬───────────┘  │          │  ┌────────────────────┐ │
│           │               │  HTTP    │  │ lib/api/server.js  │ │
│  ┌────────▼───────────┐  │◄────────►│  │ (/metrics,         │ │
│  │ WsProvider (React) │  │          │  │  /agents/statuses) │ │
│  │ (lifecycle only)   │  │          │  └────────────────────┘ │
│  └────────┬───────────┘  │          │                          │
│           │               │          │                          │
│  ┌────────▼───────────┐  │          │                          │
│  │ UI Components      │  │          │                          │
│  │ (18+ components)   │  │          │                          │
│  └────────────────────┘  │          │                          │
└──────────────────────────┘          └──────────────────────────┘
```

## Data Flow

### WebSocket Events (Server → Dashboard)

```
agent.status  ──► agentStatuses: Record<string, AgentStatus>
step          ──► activities[runId].steps[]        (mode: "run")
complete      ──► activities[runId].completions[]   (mode: "run")
error         ──► errors[] + notifications[]
chat.created  ──► activities[sessionId]              (mode: "chat")
chat.step     ──► activities[sessionId].steps[]      (mode: "chat")
chat.token    ──► activities[sessionId].streamingContent
chat.complete ──► activities[sessionId].completions[] (mode: "chat")
handoff.*     ──► handoffs[] + notifications[]
delegate.*    ──► delegates[] + notifications[]
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
      ├── DashboardHeader
      │   ├── Logo + Version badge
      │   ├── Export button → handleExport()
      │   ├── ThemeToggle
      │   └── Connection status badge (Live/Offline)
      │
      └── ChatPanel (src/components/chat-panel.tsx)
           │
           ├── ChatSidebar (src/components/chat/chat-sidebar.tsx)
           │   ├── Session list, search, delete
           │   └── Mobile overlay
           │
           ├── ChatMessageList (extracted)
           │   ├── MarkdownRenderer
           │   ├── StreamingIndicator
           │   └── Copy button
           │
           ├── ChatInputArea (extracted)
           │   ├── AgentSelect + ProviderSelect
           │   └── Auto-resize textarea
           │
           ├── ChatInspector (extracted)
           │   └── Unified inspection panel
           │
           ├── NotificationToast (src/components/chat/notification-toast.tsx)
           │
           └── Monitor sections (collapsible)
               ├── AgentStatusPanel
               ├── ExecutionTimeline
               ├── InterventionPanel
               ├── MetricsPanel
               ├── InteractionMap
               ├── MemoryViewer
               └── LogsViewer
```

### Full Component Inventory (18 components)

| Component | File | Purpose |
|-----------|------|---------|
| `DashboardHeader` | `dashboard-header.tsx` | Header bar, export, theme, conn status |
| `ChatPanel` | `chat-panel.tsx` | Main layout, session coordination |
| `ChatSidebar` | `chat/chat-sidebar.tsx` | Session list, search, CRUD |
| `NotificationToast` | `chat/notification-toast.tsx` | Toast notifications (auto-dismiss 5s) |
| `StreamingIndicator` | `chat/streaming-indicator.tsx` | Live token stream display |
| `AgentStatusPanel` | `agent-status-panel.tsx` | Live agent status grid |
| `ExecutionTimeline` | `execution-timeline.tsx` | ReAct step timeline |
| `InterventionPanel` | `intervention-panel.tsx` | Send feedback / stop agent |
| `MetricsPanel` | `metrics-panel.tsx` | Prometheus metrics polling |
| `InteractionMap` | `interaction-map.tsx` | Agent status grid visualization |
| `MemoryViewer` | `memory-viewer.tsx` | Agent memory display |
| `LogsViewer` | `logs-viewer.tsx` | Real-time log aggregation |
| `AgentSelect` | `agent-select.tsx` | Agent dropdown |
| `ProviderSelect` | `provider-select.tsx` | Provider dropdown (filtered by health) |
| `MarkdownRenderer` | `markdown-renderer.tsx` | Markdown + GFM + sanitize |
| `ThemeToggle` | `theme-toggle.tsx` | Dark/light switch |
| `ThemeProvider` | `theme-provider.tsx` | next-themes wrapper |
| `ErrorBoundary` | `error-boundary.tsx` | Error catching |

## State Management

All state lives in **Zustand store** (`src/lib/store.ts`), distributed via React context (`useWs` re-exports `useDashboardStore`):

| State | Type | Updated By |
|-------|------|-----------|
| `connected` | `boolean` | WS onopen/onclose |
| `activities` | `Record<string, Activity>` | `step`, `complete`, `chat.created`, `chat.step`, `chat.token`, `chat.complete` events |
| `agentStatuses` | `Record<string, AgentStatus>` | `agent.status` event (TTL 30min cleanup) |
| `notifications` | `Notification[]` | Auto-created on: complete, error, disconnect, handoff, delegate |
| `handoffs` | `HandoffRecord[]` | `handoff.started/complete` events |
| `delegates` | `DelegateRecord[]` | `delegate.started/complete` events |
| `errors` | `{message, time}[]` | `error` event + send failures |

### Unified Activity Model

`Activity` replaces the old split-state (`runs` / `completedRuns` / `chatSessions` / `chatSteps` / `chatCompletions`):

```typescript
interface Activity {
  id: string;                    // runId or sessionId
  mode: "run" | "chat";          // discriminates run vs chat
  agentName: string;
  provider: string;
  model: string;
  status: "idle" | "running" | "completed" | "error" | "max_steps";
  steps: ActivityStep[];         // ReAct steps (deduplicated by step/turnId)
  completions: ActivityCompletion[];
  userMessages: UserMessage[];   // Chat turns only
  streamingContent: string;      // Live token buffer
  isStreaming: boolean;
  createdAt: number;
  completedAt: number | null;
  usage: TokenUsage | null;
}
```

## Memory Management

| Resource | Limit | Strategy |
|----------|-------|----------|
| `activities` | 50 entries | Evict oldest by `completedAt` / `createdAt` |
| `steps per activity` | 100 | Sliding window, deduplicated by step number (run) or turnId+step (chat) |
| `handoffs` / `delegates` | 500 | Sliding window, synthetic entry on race condition |
| `agentStatuses` | No hard limit | TTL cleanup every 60s (30min expiry) |
| `errors` | 50 | Sliding window |
| `notifications` | 100 | Sliding window, dismissed + 5min expiry |
| `chat history (localStorage)` | 50 sessions | Trim oldest sessions |

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

- **Zustand selectors:** All components use `useWs(s => s.xxx)` — only re-renders when the selected slice changes
- **Component memoization:** Leaf components wrapped with `React.memo` — prevents cascading re-renders from unrelated state changes
- **Module-level WS refs:** `wsRef`, `reconnectAttemptsRef`, etc. live outside Zustand state to prevent re-renders on connection ref changes. Known trade-off: not SSR-safe, dashboard-only browser context.
- **Reduced motion:** `prefers-reduced-motion` media query disables all animations/transitions

## Accessibility

- Semantic HTML: `<main role="main">`, `<section aria-label="Controls">`, `<section aria-label="Activity">`
- Confirmation dialogs: Custom modal dialogs for destructive actions (Reset, Stop) instead of `window.confirm()`
- ARIA attributes: `role="dialog"`, `aria-modal="true"`, `aria-label` on interactive elements

## File Dependencies

```
page.tsx → ws-context.tsx (WsProvider) → store.ts (Zustand) → types.ts
page.tsx → all components → ws-context.tsx (useWs)
chat-panel.tsx → chat/chat-sidebar.tsx, chat/notification-toast.tsx
chat-panel.tsx → agent-select.tsx, provider-select.tsx, markdown-renderer.tsx
metrics-panel.tsx → fetch /api/metrics → API proxy route → AIYU_API_URL/metrics
api/[...path]/route.ts → AIYU_API_URL + AIYU_API_KEY (server-side proxy)
theme-toggle.tsx → theme-provider.tsx → next-themes
```
