/**
 * WebSocket Layer — Real-time agent step streaming
 *
 * Inspired by Claude Design's live canvas pattern:
 *   - Chat panel (left) sends commands
 *   - Canvas (right) receives step events in real-time
 *
 * Mounts on the same HTTP server as Express.
 * Uses ws (WebSocket) for bidirectional communication.
 *
 * Message types (client → server):
 *   { type: "run", agentName, input, provider?, model?, maxSteps? }
 *   { type: "chat.send", sessionId, input, turnId? }
 *   { type: "chat.create", agentName, provider?, model? }
 *   { type: "intervene", runId, message }
 *   { type: "subscribe", runId }
 *   { type: "ping" }
 *
 * Message types (server → client):
 *   { type: "step", runId, step, thought, action, result, error, duration_ms, toolCalls }
 *   { type: "complete", runId, status, output, usage }
 *   { type: "error", runId?, sessionId?, message }
 *   { type: "chat.created", sessionId, agentName }
 *   { type: "chat.step", sessionId, turnId?, step, thought, toolCalls, duration_ms }
 *   { type: "chat.complete", sessionId, turnId?, content, usage, traceId }
 *   { type: "pong" }
 *   { type: "intervene.ack", runId }
 *   { type: "subscribe.ack", runId }
 *   { type: "agent.status", agentName, status, runId?, timestamp }  — v2.7.0
 *   { type: "handoff.started", handoffId, fromAgent, toAgent, timestamp }  — v2.7.0
 *   { type: "handoff.complete", handoffId, status, artifacts, pendingTasks, timestamp }  — v2.7.0
 *   { type: "delegate.started", runId, parentAgent, childAgent, depth, timestamp }  — v2.7.0
 *   { type: "delegate.complete", runId, childAgent, status, timestamp }  — v2.7.0
 */

const { WebSocketServer } = require("ws");
const agentRuntime = require("../core/agent-runtime");
const logger = require("../core/logger");
const usage = require("../core/usage");
const utils = require("../utils");
const apiConfig = require("./config");

const PENDING_INTERVENTIONS = new Map();
const MAX_INTERVENTION_LENGTH = 10000; // 10K chars — matches HTTP /agents/intervene limit
const WS_MAX_PAYLOAD = 1024 * 1024; // 1MB — prevent memory exhaustion from oversized messages
const WS_RUN_TIMEOUT_MS = 300000; // 5 minutes — matches JOB_TIMEOUT_MS default
const WS_HEARTBEAT_INTERVAL_MS = 30000; // 30s ping interval
const crypto = require("crypto");
const { wsApiKeyAuth } = require("./middleware");

const VALID_CLIENT_TYPES = new Set(["ping", "run", "chat.create", "chat.send", "intervene", "subscribe"]);

let _wss = null; // Reference for shutdown
let _heartbeatTimer = null;

// Track active runs per WS client so we can abort on disconnect
const activeRuns = new Map(); // ws → Set<{ runId, abortController }>

// Agent status tracking — maps agentName → { status, runId, since }
const agentStatuses = new Map();

function _isoNow() {
  return new Date().toISOString();
}

function _broadcast(event) {
  if (!_wss) return;
  const payload = JSON.stringify(event);
  for (const client of _wss.clients) {
    if (client.readyState === 1) {
      try {
        client.send(payload);
      } catch { /* client disconnected between readyState check and send — safe to ignore */ }
    }
  }
}

const AGENT_STATUS_TTL_MS = 30 * 60 * 1000; // 30 minutes

function setAgentStatus(agentName, status, runId) {
  agentStatuses.set(agentName, { status, runId: runId || null, since: Date.now() });
  _broadcast({ type: "agent.status", agentName, status, runId: runId || null, timestamp: _isoNow() });
  // Cleanup stale entries
  if (agentStatuses.size > 100) {
    const now = Date.now();
    for (const [name, entry] of agentStatuses) {
      if (now - entry.since > AGENT_STATUS_TTL_MS) agentStatuses.delete(name);
    }
  }
}

function getAgentStatuses() {
  const result = {};
  for (const [name, entry] of agentStatuses) {
    result[name] = {
      status: entry.status,
      runId: entry.runId,
      since: entry.since,
      timestamp: new Date(entry.since).toISOString(),
    };
  }
  return result;
}

function mountWebSocket(server) {
  _wss = new WebSocketServer({
    server,
    path: "/ws",
    verifyClient: wsApiKeyAuth,
    maxPayload: WS_MAX_PAYLOAD,
    perMessageDeflate: false, // Prevent zip bomb attacks
    handleProtocols(protocols) {
      // Select aiyu-token protocol if present; otherwise accept first protocol
      for (const protocol of protocols) {
        if (protocol.startsWith("aiyu-token.")) return protocol;
      }
      return protocols[0];
    },
  });

  // Heartbeat: detect dead connections
  _heartbeatTimer = setInterval(() => {
    if (!_wss) return;
    _wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        logger.warn("WebSocket heartbeat failed — terminating stale connection");
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, WS_HEARTBEAT_INTERVAL_MS);
  _heartbeatTimer.unref();

  _wss.on("connection", (ws) => {
    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true; });
    ws.on("error", (err) => { logger.error(`WebSocket error: ${err.message}`); });
    logger.info("WebSocket client connected");

    ws.on("message", async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
        return;
      }

      // Validate message type
      if (!msg || typeof msg.type !== "string") {
        ws.send(JSON.stringify({ type: "error", message: "Missing or invalid 'type' field" }));
        return;
      }
      if (!VALID_CLIENT_TYPES.has(msg.type)) {
        ws.send(JSON.stringify({ type: "error", message: `Unknown message type: ${msg.type}` }));
        return;
      }

      switch (msg.type) {
        case "ping":
          ws.send(JSON.stringify({ type: "pong" }));
          break;

        case "run":
          await handleRun(ws, msg);
          break;

        case "chat.create":
          await handleChatCreate(ws, msg);
          break;

        case "chat.send":
          await handleChatSend(ws, msg);
          break;

        case "intervene":
          handleIntervene(ws, msg);
          break;

        case "subscribe":
          handleSubscribe(ws, msg);
          break;

        default:
          ws.send(JSON.stringify({ type: "error", message: `Unknown message type: ${msg.type}` }));
      }
    });

    ws.on("close", () => {
      logger.info("WebSocket client disconnected");
      // Abort all active runs for this client to prevent resource/token leak
      const runs = activeRuns.get(ws);
      if (runs) {
        for (const { runId, abortController } of runs) {
          abortController.abort();
          logger.info(`Aborted run ${runId} — client disconnected`);
        }
        activeRuns.delete(ws);
      }
      // Cleanup chat sessions associated with this client
      for (const [sessionId, entry] of chatSessions) {
        if (entry.ws === ws) {
          chatSessions.delete(sessionId);
        }
      }
      // Cleanup stale interventions older than 5 minutes
      const staleThreshold = Date.now() - 5 * 60 * 1000;
      for (const [runId, intervention] of PENDING_INTERVENTIONS) {
        if (intervention._ts && intervention._ts < staleThreshold) {
          PENDING_INTERVENTIONS.delete(runId);
        }
      }
    });
  });

  return _wss;
}

async function handleRun(ws, msg) {
  const { agentName, input, provider, model, maxSteps } = msg;
  const { MAX_INPUT_LENGTH } = require("../core/input-sanitizer");

  if (input && input.length > MAX_INPUT_LENGTH) {
    ws.send(JSON.stringify({ type: "error", message: `Input too long (${input.length} chars, max ${MAX_INPUT_LENGTH})` }));
    return;
  }

  if (!input) {
    ws.send(JSON.stringify({ type: "error", message: "Missing required field: input" }));
    return;
  }

  const resolvedAgentName = agentName || utils.findDefaultAgent(process.cwd());
  if (!resolvedAgentName) {
    ws.send(JSON.stringify({ type: "error", message: "No agent_name provided and no default agent found" }));
    return;
  }

  if (agentName && !utils.isValidAgentName(agentName)) {
    ws.send(JSON.stringify({ type: "error", message: `Invalid agent name: "${agentName}"` }));
    return;
  }

  const runId = `run_${crypto.randomUUID()}`;
  setAgentStatus(resolvedAgentName, "running", runId);

  // AbortController allows cancelling the agent when WS timeout fires or client disconnects
  const abortController = new AbortController();

  // Track this run so we can abort if client disconnects
  if (!activeRuns.has(ws)) activeRuns.set(ws, new Set());
  const runEntry = { runId, abortController };
  activeRuns.get(ws).add(runEntry);

  try {
    const runPromise = agentRuntime.runAgent({
      input,
      agentName: resolvedAgentName,
      projectDir: process.cwd(),
      provider: provider ?? apiConfig.LLM_PROVIDER,
      model: model || undefined,
      maxSteps: maxSteps ?? apiConfig.MAX_STEPS,
      json: true,
      noCache: true,
      signal: abortController.signal,
      onStep: (stepRecord, state) => {
        // Intervention injection is handled by react-loop.js (checks state._intervention
        // before each LLM call). Here we only sync PENDING_INTERVENTIONS → state.
        const intervention = PENDING_INTERVENTIONS.get(runId);
        if (intervention) {
          PENDING_INTERVENTIONS.delete(runId);
          state._intervention = intervention.message || intervention;
        }

        if (ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: "step",
            runId,
            step: stepRecord.step,
            thought: stepRecord.thought?.slice(0, 500),
            action: stepRecord.action,
            result: stepRecord.result ? JSON.stringify(stepRecord.result).slice(0, 2000) : null,
            error: stepRecord.error,
            duration_ms: stepRecord.duration_ms,
            toolCalls: stepRecord.toolCalls?.map(tc => ({
              tool: tc.tool,
              duration_ms: tc.duration_ms,
              error: tc.error,
            })),
            timestamp: _isoNow(),
          }));
        }
      },
    });

    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        abortController.abort(); // Cancel the agent loop
        reject(new Error(`WS run timed out after ${WS_RUN_TIMEOUT_MS / 1000}s`));
      }, WS_RUN_TIMEOUT_MS);
    });

    const result = await Promise.race([runPromise, timeoutPromise]);
    clearTimeout(timeoutId);

    // Remove from active runs tracking
    const runs = activeRuns.get(ws);
    if (runs) { runs.delete(runEntry); if (runs.size === 0) activeRuns.delete(ws); }

    usage.trackCommand(process.cwd(), "run", { via: "websocket" });

    // Clean up any unconsumed intervention for this run
    PENDING_INTERVENTIONS.delete(runId);

    setAgentStatus(resolvedAgentName, result.status === "error" ? "error" : "completed", runId);

    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: "complete",
        runId,
        status: result.status,
        output: result.output?.slice(0, 5000),
        usage: result.usage,
        steps: result.steps?.length,
        timestamp: _isoNow(),
      }));
    } else {
      logger.info(`Run ${runId} completed (status=${result.status}) but client disconnected — result dropped`);
    }
  } catch (err) {
    clearTimeout(timeoutId);
    // Remove from active runs tracking
    const runs = activeRuns.get(ws);
    if (runs) { runs.delete(runEntry); if (runs.size === 0) activeRuns.delete(ws); }
    // Clean up any unconsumed intervention for this run
    PENDING_INTERVENTIONS.delete(runId);
    setAgentStatus(resolvedAgentName, "error", runId);
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: "error", runId, message: err.message }));
    } else {
      logger.warn(`Run ${runId} errored but client disconnected: ${err.message}`);
    }
  }
}

const chatSessions = new Map();
const CHAT_SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

function cleanupStaleChatSessions() {
  const now = Date.now();
  for (const [sessionId, entry] of chatSessions) {
    if (now - entry.lastActivity > CHAT_SESSION_TTL_MS) {
      chatSessions.delete(sessionId);
      logger.info(`Chat session ${sessionId} expired (idle > 30min)`);
    }
  }
}

// Periodic cleanup every 5 minutes
const _sessionCleanupTimer = setInterval(cleanupStaleChatSessions, 5 * 60 * 1000);
_sessionCleanupTimer.unref();

async function handleChatCreate(ws, msg) {
  const { agentName, provider, model } = msg;

  const resolvedAgentName = agentName || utils.findDefaultAgent(process.cwd());
  if (!resolvedAgentName) {
    ws.send(JSON.stringify({ type: "error", message: "No agent_name provided and no default agent found" }));
    return;
  }

  if (agentName && !utils.isValidAgentName(agentName)) {
    ws.send(JSON.stringify({ type: "error", message: `Invalid agent name: "${agentName}"` }));
    return;
  }

  try {
    const session = agentRuntime.createChatSession({
      agentName: resolvedAgentName,
      projectDir: process.cwd(),
      provider: provider ?? apiConfig.LLM_PROVIDER,
      model: model || undefined,
    });

    const sessionId = `chat_${crypto.randomUUID()}`;
    chatSessions.set(sessionId, { session, ws, lastActivity: Date.now() });

    setAgentStatus(session.agentName, "idle", null);

    ws.send(JSON.stringify({
      type: "chat.created",
      sessionId,
      agentName: session.agentName,
      provider: session.provider,
      model: session.model,
    }));
  } catch (err) {
    ws.send(JSON.stringify({ type: "error", message: err.message }));
  }
}

async function handleChatSend(ws, msg) {
  const { sessionId, input, turnId } = msg;
  const { MAX_INPUT_LENGTH } = require("../core/input-sanitizer");

  if (input && input.length > MAX_INPUT_LENGTH) {
    ws.send(JSON.stringify({ type: "error", message: `Input too long (${input.length} chars, max ${MAX_INPUT_LENGTH})` }));
    return;
  }

  if (!sessionId || !input) {
    ws.send(JSON.stringify({ type: "error", message: "Missing sessionId or input" }));
    return;
  }

  const entry = chatSessions.get(sessionId);
  if (!entry) {
    ws.send(JSON.stringify({ type: "error", message: `Chat session not found: ${sessionId}` }));
    return;
  }

  const resolvedTurnId = typeof turnId === "string" && turnId.length > 0
    ? turnId
    : `turn_${crypto.randomUUID()}`;
  // AbortController for chat timeout cancellation
  const chatAbort = new AbortController();
  const chatAgentName = entry.session.agentName;
  setAgentStatus(chatAgentName, "running", sessionId);
  try {
    const sendPromise = entry.session.send(input, {
      signal: chatAbort.signal,
      onStep: (stepRecord) => {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: "chat.step",
            sessionId,
            turnId: resolvedTurnId,
            step: stepRecord.step,
            thought: stepRecord.thought?.slice(0, 500),
            toolCalls: stepRecord.toolCalls?.map(tc => ({
              tool: tc.tool,
              error: tc.error,
            })),
            duration_ms: stepRecord.duration_ms,
            error: stepRecord.error,
            timestamp: _isoNow(),
          }));
        }
      },
      onToken: (token) => {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: "chat.token",
            sessionId,
            turnId: resolvedTurnId,
            token,
            timestamp: _isoNow(),
          }));
        }
      },
    });
    let chatTimeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      chatTimeoutId = setTimeout(() => {
        chatAbort.abort();
        reject(new Error(`WS chat timed out after ${WS_RUN_TIMEOUT_MS / 1000}s`));
      }, WS_RUN_TIMEOUT_MS);
    });

    const result = await Promise.race([sendPromise, timeoutPromise]);
    clearTimeout(chatTimeoutId);
    entry.lastActivity = Date.now();

    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: "chat.complete",
        sessionId,
        turnId: resolvedTurnId,
        content: result.content?.slice(0, 5000),
        usage: result.usage,
        traceId: result.traceId,
        timestamp: _isoNow(),
      }));
    }

    setAgentStatus(chatAgentName, "completed", sessionId);
    usage.trackCommand(process.cwd(), "chat", { via: "websocket" });
  } catch (err) {
    clearTimeout(chatTimeoutId);
    setAgentStatus(chatAgentName, "error", sessionId);
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: "error", sessionId, turnId: resolvedTurnId, message: err.message }));
    }
  }
}

function handleIntervene(ws, msg) {
  const { runId, message, sessionId } = msg;
  if (!runId || !message) {
    ws.send(JSON.stringify({ type: "error", message: "Missing runId or message" }));
    return;
  }
  if (message.length > MAX_INTERVENTION_LENGTH) {
    ws.send(JSON.stringify({ type: "error", message: `Intervention message too long (${message.length} chars, max ${MAX_INTERVENTION_LENGTH})` }));
    return;
  }

  // Chat intervention: prefer explicit sessionId. Keep backward compatibility:
  // if runId looks like a chat session id (chat_*), treat it as sessionId.
  const resolvedSessionId = (typeof sessionId === "string" && sessionId.length > 0)
    ? sessionId
    : (typeof runId === "string" && runId.startsWith("chat_") ? runId : null);
  if (resolvedSessionId) {
    const chatEntry = chatSessions.get(resolvedSessionId);
    if (chatEntry && chatEntry.session.intervene) {
      chatEntry.session.intervene(message);
      ws.send(JSON.stringify({ type: "intervene.ack", runId }));
      return;
    }
  }

  PENDING_INTERVENTIONS.set(runId, { message, _ts: Date.now() });
  ws.send(JSON.stringify({ type: "intervene.ack", runId }));
}

function handleSubscribe(ws, msg) {
  const { runId } = msg;
  if (!runId) {
    ws.send(JSON.stringify({ type: "error", message: "Missing runId" }));
    return;
  }
  // Subscription is implicit — the ws that initiated the run already receives events
  ws.send(JSON.stringify({ type: "subscribe.ack", runId }));
}

function terminateAllConnections() {
  if (_heartbeatTimer) {
    clearInterval(_heartbeatTimer);
    _heartbeatTimer = null;
  }
  if (_wss) {
    for (const ws of _wss.clients) {
      ws.terminate();
    }
    logger.info(`WebSocket: terminated ${_wss.clients.size} connections`);
  }
}

function broadcastHandoffStarted(handoffId, fromAgent, toAgent) {
  _broadcast({ type: "handoff.started", handoffId, fromAgent, toAgent, timestamp: _isoNow() });
}

function broadcastHandoffComplete(handoffId, status, artifacts, pendingTasks) {
  _broadcast({ type: "handoff.complete", handoffId, status, artifacts, pendingTasks, timestamp: _isoNow() });
}

function broadcastDelegateStarted(runId, parentAgent, childAgent, depth) {
  _broadcast({ type: "delegate.started", runId, parentAgent, childAgent, depth, timestamp: _isoNow() });
}

function broadcastDelegateComplete(runId, childAgent, status) {
  _broadcast({ type: "delegate.complete", runId, childAgent, status, timestamp: _isoNow() });
}

function getChatSession(sessionId) {
  return chatSessions.get(sessionId) || null;
}

function setPendingIntervention(runId, intervention) {
  PENDING_INTERVENTIONS.set(runId, intervention);
}

function getPendingIntervention(runId) {
  return PENDING_INTERVENTIONS.get(runId) || null;
}

module.exports = {
  mountWebSocket,
  // Read-only accessors instead of mutable Map exports
  getChatSession,
  getChatSessions: () => [...chatSessions.keys()],
  getChatSessionIds: () => [...chatSessions.keys()], // clearer alias
  setPendingIntervention,
  getPendingIntervention,
  // Legacy compat — read-only snapshot instead of mutable Map export
  chatSessions: () => new Map(chatSessions),
  PENDING_INTERVENTIONS: () => new Map(PENDING_INTERVENTIONS),
  terminateAllConnections,
  setAgentStatus,
  getAgentStatuses,
  broadcastHandoffStarted,
  broadcastHandoffComplete,
  broadcastDelegateStarted,
  broadcastDelegateComplete,
};
