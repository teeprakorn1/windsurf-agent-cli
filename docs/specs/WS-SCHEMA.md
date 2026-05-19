# WebSocket Event Schema — Aiyu MultiAgent

> Contract for all messages exchanged over `/ws`.
> Dashboard clients MUST conform to this schema. Server validates inbound; clients validate outbound.

## Connection

| Item | Value |
|------|-------|
| **Path** | `/ws` |
| **Protocol** | `ws://` or `wss://` |
| **Auth** | API key via `wsApiKeyAuth` (if `AIYU_API_KEY` set) |
| **Max payload** | 1MB |
| **Compression** | Disabled (`perMessageDeflate: false`) |
| **Heartbeat** | Server pings every 30s; client MUST respond with `pong` frame. Stale connections are terminated. |
| **Message format** | JSON (`Content-Type: application/json`) |

---

## Client → server messages

### `ping`

Keep-alive. Server responds with `pong`.

```json
{ "type": "ping" }
```

### `run`

Start a one-shot agent execution. Server streams `step` events, then `complete`.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `agentName` | string | no | default agent | Agent to run. Validated against agent names. |
| `input` | string | **yes** | — | Task description. Max 100,000 chars. |
| `provider` | string | no | config default | `openai`, `claude`, `groq`, `local`, `mock`, `cli:<name>` |
| `model` | string | no | agent default | Model override |
| `maxSteps` | number | no | config default | Max ReAct loop steps |

```json
{
  "type": "run",
  "agentName": "cli",
  "input": "Fix the bug in auth.js",
  "provider": "openai",
  "maxSteps": 15
}
```

### `chat.create`

Create an interactive chat session. Server responds with `chat.created`.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `agentName` | string | no | default agent | Agent for the session |
| `provider` | string | no | config default | LLM provider |
| `model` | string | no | agent default | Model override |

```json
{
  "type": "chat.create",
  "agentName": "cli",
  "provider": "claude"
}
```

### `chat.send`

Send a message to an existing chat session. Server streams `chat.step` events, then `chat.complete`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | **yes** | Session ID from `chat.created` |
| `input` | string | **yes** | User message. Max 100,000 chars. |

```json
{
  "type": "chat.send",
  "sessionId": "chat_a1b2c3d4",
  "input": "Now add tests for it"
}
```

### `intervene`

Inject feedback into a running agent. The intervention is picked up before the next LLM call.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `runId` | string | **yes** | Run ID from `step` or `complete` |
| `message` | string | **yes** | Feedback text. Max 10,000 chars. |

```json
{
  "type": "intervene",
  "runId": "run_x1y2z3",
  "message": "Stop after this step and summarize"
}
```

### `subscribe`

Subscribe to events for a specific run. Currently implicit — the initiating client already receives events.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `runId` | string | **yes** | Run ID to subscribe to |

```json
{
  "type": "subscribe",
  "runId": "run_x1y2z3"
}
```

---

## Server → client messages

### `pong`

Response to client `ping`.

```json
{ "type": "pong" }
```

### `step`

Emitted for each ReAct loop step during a `run`. This is the primary real-time event.

| Field | Type | Description |
|-------|------|-------------|
| `runId` | string | Unique run identifier (`run_<uuid>`) |
| `step` | number | Step index (1-based) |
| `thought` | string \| null | Agent's reasoning. Truncated to 500 chars. |
| `action` | object \| null | Action taken (tool name + args) |
| `result` | string \| null | Tool result. JSON-serialized, truncated to 2000 chars. |
| `error` | string \| null | Error message if step failed |
| `duration_ms` | number \| null | Step duration including LLM response time |
| `toolCalls` | array \| null | Tool call summaries |

**`toolCalls` item:**

| Field | Type | Description |
|-------|------|-------------|
| `tool` | string | Tool name (e.g. `fs.read`, `shell.exec`) |
| `duration_ms` | number \| null | Tool execution time |
| `error` | string \| null | Tool error if any |

```json
{
  "type": "step",
  "runId": "run_x1y2z3",
  "step": 3,
  "thought": "I need to check the auth module first",
  "action": null,
  "result": null,
  "error": null,
  "duration_ms": 1842,
  "toolCalls": [
    { "tool": "fs.read", "duration_ms": 12, "error": null }
  ]
}
```

### `complete`

Emitted when a `run` finishes (success, max_steps, or error).

| Field | Type | Description |
|-------|------|-------------|
| `runId` | string | Run identifier |
| `status` | string | `completed`, `max_steps`, or `error` |
| `output` | string \| null | Final output. Truncated to 5,000 chars. |
| `usage` | object \| null | Token usage `{ promptTokens, completionTokens, totalTokens }` |
| `steps` | number \| null | Total step count |

```json
{
  "type": "complete",
  "runId": "run_x1y2z3",
  "status": "completed",
  "output": "Fixed the bug in auth.js by adding null check...",
  "usage": { "promptTokens": 1200, "completionTokens": 340, "totalTokens": 1540 },
  "steps": 5
}
```

### `error`

Error event for any operation.

| Field | Type | Description |
|-------|------|-------------|
| `runId` | string \| null | Run ID if applicable |
| `sessionId` | string \| null | Session ID if applicable |
| `message` | string | Error description |

```json
{
  "type": "error",
  "runId": "run_x1y2z3",
  "message": "WS run timed out after 300s"
}
```

### `chat.created`

Confirmation that a chat session was created.

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | string | Session ID (`chat_<uuid>`) |
| `agentName` | string | Resolved agent name |
| `provider` | string | LLM provider |
| `model` | string | Model name |

```json
{
  "type": "chat.created",
  "sessionId": "chat_a1b2c3d4",
  "agentName": "cli",
  "provider": "mock",
  "model": "gpt-4"
}
```

### `chat.step`

Emitted for each step during a `chat.send`. Streamed after the full response completes (not per-token).

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | string | Session ID |
| `step` | number | Step index |
| `thought` | string \| null | Agent reasoning. Truncated to 500 chars. |
| `toolCalls` | array \| null | Tool call summaries |
| `duration_ms` | number \| null | Step duration |
| `error` | string \| null | Error if step failed |
| `timestamp` | string | ISO 8601 timestamp |

```json
{
  "type": "chat.step",
  "sessionId": "chat_a1b2c3d4",
  "step": 1,
  "thought": "Looking at the test file",
  "toolCalls": [{ "tool": "fs.read", "error": null }],
  "duration_ms": 950,
  "error": null,
  "timestamp": "2026-05-07T10:00:00.000Z"
}
```

### `chat.complete`

Emitted when a chat turn completes.

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | string | Session ID |
| `content` | string \| null | Response content. Truncated to 5,000 chars. |
| `usage` | object \| null | Token usage |
| `traceId` | string \| null | Distributed trace ID |

```json
{
  "type": "chat.complete",
  "sessionId": "chat_a1b2c3d4",
  "content": "I've added 3 unit tests for the auth module...",
  "usage": { "promptTokens": 800, "completionTokens": 200, "totalTokens": 1000 },
  "traceId": "trace_abc123"
}
```

### `chat.token`

Emitted during chat response streaming. Provides incremental token chunks for real-time display.

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | string | Chat session ID |
| `turnId` | string | Turn identifier |
| `token` | string | Token chunk (typically 4 chars) |
| `timestamp` | string | ISO 8601 timestamp |

```json
{
  "type": "chat.token",
  "sessionId": "chat_a1b2c3d4",
  "turnId": "chat_a1b2c3d4:turn:1",
  "token": "I've",
  "timestamp": "2026-05-11T03:00:00.000Z"
}
```

### `intervene.ack`

Acknowledgement that an intervention was queued.

| Field | Type | Description |
|-------|------|-------------|
| `runId` | string | Run ID the intervention targets |

```json
{
  "type": "intervene.ack",
  "runId": "run_x1y2z3"
}
```

### `subscribe.ack`

Acknowledgement of a subscription request.

| Field | Type | Description |
|-------|------|-------------|
| `runId` | string | Subscribed run ID |

```json
{
  "type": "subscribe.ack",
  "runId": "run_x1y2z3"
}
```

---

## Planned events

These events are not yet implemented. They are defined here as a contract for the dashboard.

### `agent.status` (server → client) — ✅ Implemented in v2.7.0

Broadcast when an agent's status changes. Emitted for both `run` and `chat` modes (chat support added in v2.7.4).

| Field | Type | Description |
|-------|------|-------------|
| `agentName` | string | Agent identifier |
| `status` | string | `idle`, `running`, `error`, `completed` |
| `runId` | string \| null | Run ID (run mode) or session ID (chat mode) |
| `timestamp` | string | ISO 8601 timestamp |

**Run mode**: broadcast on run start (`running`), completion (`completed`), and error (`error`).

**Chat mode** (v2.7.4+): broadcast on session creation (`idle`), chat send start (`running`), and chat send completion (`completed`/`error`).

```json
{
  "type": "agent.status",
  "agentName": "cli",
  "status": "running",
  "runId": "run_x1y2z3",
  "timestamp": "2026-05-06T12:00:00.000Z"
}
```

### `handoff.started` (server → client)

Broadcast when a handoff between agents begins.

| Field | Type | Description |
|-------|------|-------------|
| `handoffId` | string | Handoff bundle ID |
| `fromAgent` | string | Source agent name |
| `toAgent` | string | Target agent name |
| `timestamp` | string | ISO 8601 |

```json
{
  "type": "handoff.started",
  "handoffId": "h_abc123",
  "fromAgent": "explorer",
  "toAgent": "backend-specialist",
  "timestamp": "2026-05-06T12:00:00.000Z"
}
```

### `handoff.complete` (server → client)

Broadcast when a handoff completes.

| Field | Type | Description |
|-------|------|-------------|
| `handoffId` | string | Handoff bundle ID |
| `status` | string | `completed` or `error` |
| `artifacts` | number | Artifact count from source agent |
| `pendingTasks` | number | Pending tasks passed to target agent |
| `timestamp` | string | ISO 8601 |

```json
{
  "type": "handoff.complete",
  "handoffId": "h_abc123",
  "status": "completed",
  "artifacts": 3,
  "pendingTasks": 1,
  "timestamp": "2026-05-06T12:00:05.000Z"
}
```

### `delegate.started` (server → client)

Broadcast when an agent delegates work to another agent via `agent.delegate` tool.

| Field | Type | Description |
|-------|------|-------------|
| `runId` | string | Parent run ID |
| `parentAgent` | string | Delegating agent |
| `childAgent` | string | Delegated agent |
| `depth` | number | Delegation depth (max 3) |
| `timestamp` | string | ISO 8601 |

```json
{
  "type": "delegate.started",
  "runId": "run_x1y2z3",
  "parentAgent": "orchestrator",
  "childAgent": "backend-specialist",
  "depth": 1,
  "timestamp": "2026-05-06T12:00:01.000Z"
}
```

### `delegate.complete` (server → client)

Broadcast when a delegated agent completes.

| Field | Type | Description |
|-------|------|-------------|
| `runId` | string | Parent run ID |
| `childAgent` | string | Delegated agent |
| `status` | string | `completed`, `max_steps`, or `error` |
| `timestamp` | string | ISO 8601 |

```json
{
  "type": "delegate.complete",
  "runId": "run_x1y2z3",
  "childAgent": "backend-specialist",
  "status": "completed",
  "timestamp": "2026-05-06T12:00:04.000Z"
}
```

---

## Constraints

| Constraint | Value | Source |
|-----------|-------|--------|
| Input max length | 100,000 chars | `input-sanitizer.MAX_INPUT_LENGTH` |
| Intervention max length | 10,000 chars | `ws.MAX_INTERVENTION_LENGTH` |
| Step thought truncation | 500 chars | `ws.js handleRun` |
| Step result truncation | 2,000 chars | `ws.js handleRun` |
| Complete output truncation | 5,000 chars | `ws.js handleRun` |
| Chat content truncation | 5,000 chars | `ws.js handleChatSend` |
| Run timeout | 300s (5min) | `ws.WS_RUN_TIMEOUT_MS` |
| Chat session TTL | 30min | `ws.CHAT_SESSION_TTL_MS` |
| Max payload | 1MB | `ws.WS_MAX_PAYLOAD` |
| Heartbeat interval | 30s | `ws.WS_HEARTBEAT_INTERVAL_MS` |

---

## HTTP API endpoints (complementary)

The WebSocket is for real-time streaming. For request/response operations, use the HTTP API:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | none | System health report |
| GET | `/metrics` | API key or localhost | Prometheus metrics |
| GET | `/traces` | API key or localhost | Recent distributed traces |
| GET | `/traces/:id` | API key or localhost | Specific trace detail |
| POST | `/jobs` | API key | Enqueue async agent run |
| GET | `/jobs` | API key | List recent jobs |
| GET | `/jobs/:id` | API key | Job status + result |
| POST | `/handoff` | API key | Agent-to-agent handoff |
| GET | `/handoff/:id` | API key | Retrieve handoff bundle |
| POST | `/agents/intervene` | API key | Inject feedback (HTTP equivalent of WS `intervene`) |
