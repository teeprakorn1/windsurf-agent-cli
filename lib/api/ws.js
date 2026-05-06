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
 *   { type: "chat.send", sessionId, input }
 *   { type: "chat.create", agentName, provider?, model? }
 *   { type: "intervene", runId, message }
 *   { type: "subscribe", runId }
 *
 * Message types (server → client):
 *   { type: "step", runId, step, thought, action, result, error, duration_ms, toolCalls }
 *   { type: "complete", runId, status, output, usage }
 *   { type: "error", runId, message }
 *   { type: "chat.created", sessionId, agentName }
 *   { type: "chat.step", sessionId, step, thought, toolCalls, duration_ms }
 *   { type: "chat.complete", sessionId, content, usage }
 *   { type: "pong" }
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

let _wss = null; // Reference for shutdown
let _heartbeatTimer = null;

function mountWebSocket(server) {
  _wss = new WebSocketServer({
    server,
    path: "/ws",
    verifyClient: wsApiKeyAuth,
    maxPayload: WS_MAX_PAYLOAD,
    perMessageDeflate: false, // Prevent zip bomb attacks
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

  try {
    const runPromise = agentRuntime.runAgent({
      input,
      agentName: resolvedAgentName,
      projectDir: process.cwd(),
      provider: provider || apiConfig.LLM_PROVIDER,
      model: model || undefined,
      maxSteps: maxSteps || apiConfig.MAX_STEPS,
      json: true,
      noCache: true,
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
          }));
        }
      },
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`WS run timed out after ${WS_RUN_TIMEOUT_MS / 1000}s`)), WS_RUN_TIMEOUT_MS)
    );

    const result = await Promise.race([runPromise, timeoutPromise]);

    usage.trackCommand(process.cwd(), "run", { via: "websocket" });

    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: "complete",
        runId,
        status: result.status,
        output: result.output?.slice(0, 5000),
        usage: result.usage,
        steps: result.steps?.length,
      }));
    }
  } catch (err) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: "error", runId, message: err.message }));
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
      provider: provider || apiConfig.LLM_PROVIDER,
      model: model || undefined,
    });

    const sessionId = `chat_${crypto.randomUUID()}`;
    chatSessions.set(sessionId, { session, ws, lastActivity: Date.now() });

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
  const { sessionId, input } = msg;
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
  entry.lastActivity = Date.now();

  try {
    const sendPromise = entry.session.send(input);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`WS chat timed out after ${WS_RUN_TIMEOUT_MS / 1000}s`)), WS_RUN_TIMEOUT_MS)
    );

    const result = await Promise.race([sendPromise, timeoutPromise]);

    // Stream each step
    if (result.steps) {
      for (const step of result.steps) {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: "chat.step",
            sessionId,
            step: step.step,
            thought: step.thought?.slice(0, 500),
            toolCalls: step.toolCalls?.map(tc => ({
              tool: tc.tool,
              error: tc.error,
            })),
            duration_ms: step.duration_ms,
            error: step.error,
          }));
        }
      }
    }

    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: "chat.complete",
        sessionId,
        content: result.content?.slice(0, 5000),
        usage: result.usage,
        traceId: result.traceId,
      }));
    }

    usage.trackCommand(process.cwd(), "chat", { via: "websocket" });
  } catch (err) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: "error", sessionId, message: err.message }));
    }
  }
}

function handleIntervene(ws, msg) {
  const { runId, message } = msg;
  if (!runId || !message) {
    ws.send(JSON.stringify({ type: "error", message: "Missing runId or message" }));
    return;
  }
  if (message.length > MAX_INTERVENTION_LENGTH) {
    ws.send(JSON.stringify({ type: "error", message: `Intervention message too long (${message.length} chars, max ${MAX_INTERVENTION_LENGTH})` }));
    return;
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

module.exports = { mountWebSocket, chatSessions, PENDING_INTERVENTIONS, terminateAllConnections };
