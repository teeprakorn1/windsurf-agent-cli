/**
 * Handoff & Intervene API — Agent-to-agent handoff + inline feedback
 *
 * POST /handoff         → Run agent A, create bundle, run agent B with enriched input
 * POST /agents/intervene → Inject feedback into a running agent
 * GET  /handoff/:id     → Retrieve a stored handoff bundle
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const agentRuntime = require("../core/agent-runtime");
const handoff = require("../core/handoff");
const usage = require("../core/usage");
const utils = require("../utils");
const logger = require("../core/logger");

const STORED_BUNDLES = new Map();
const MAX_STORED_BUNDLES = 100;

function getBundleFilePath() {
  // Use project-scoped path to avoid cross-instance conflicts
  const config = require("../core/config");
  const cfgDir = config.getConfigDir(process.cwd());
  if (cfgDir) return path.join(cfgDir, "handoff-bundles.json");
  return path.join(os.tmpdir(), `aiyu-handoff-bundles-${process.pid}.json`);
}

function loadBundlesFromDisk() {
  try {
    const bundleFile = getBundleFilePath();
    if (fs.existsSync(bundleFile)) {
      const data = JSON.parse(fs.readFileSync(bundleFile, "utf-8"));
      if (Array.isArray(data)) {
        for (const bundle of data.slice(-MAX_STORED_BUNDLES)) {
          if (bundle.id) STORED_BUNDLES.set(bundle.id, bundle);
        }
      }
    }
  } catch { /* ignore read errors */ }
}

function saveBundlesToDisk() {
  try {
    const data = [...STORED_BUNDLES.values()].slice(-MAX_STORED_BUNDLES);
    const bundleFile = getBundleFilePath();
    const guardrails = require("../core/guardrails");
    guardrails.safeWrite(bundleFile, JSON.stringify(data), "utf-8", process.cwd());
  } catch { /* ignore write errors */ }
}

loadBundlesFromDisk();

function mountHandoffRoutes(app) {
  // POST /handoff — Run agent A → bundle → run agent B
  app.post("/handoff", async (req, res, next) => {
    let bundle = null;

    // Resolve WS broadcast functions upfront (graceful fallback when WS not loaded)
    let broadcastHandoffStarted = () => {};
    let broadcastHandoffComplete = () => {};
    try {
      const ws = require("./ws");
      broadcastHandoffStarted = ws.broadcastHandoffStarted || broadcastHandoffStarted;
      broadcastHandoffComplete = ws.broadcastHandoffComplete || broadcastHandoffComplete;
    } catch { /* WS module not loaded — no dashboard broadcasts */ }

    try {
      const { from_agent, to_agent, input, provider, model, max_steps } = req.body;

      if (!input) {
        const err = new Error("Missing required field: input");
        err.code = "VALIDATION_ERROR";
        return next(err);
      }

      if (!from_agent || !to_agent) {
        const err = new Error("Missing required fields: from_agent, to_agent");
        err.code = "VALIDATION_ERROR";
        return next(err);
      }

      // Validate agent names
      for (const name of [from_agent, to_agent]) {
        if (!utils.isValidAgentName(name)) {
          const err = new Error(`Invalid agent name: "${name}"`);
          err.code = "VALIDATION_ERROR";
          return next(err);
        }
      }

      // Circuit breaker check — use per-provider check via isAnyLlmAvailable
      const { isAnyLlmAvailable } = require("../core/agent-runtime");
      if (!isAnyLlmAvailable()) {
        const err = new Error("All LLM circuit breakers open");
        err.code = "CIRCUIT_OPEN";
        return next(err);
      }

      // Step 1: Run source agent
      const sourceResult = await agentRuntime.runAgent({
        input,
        agentName: from_agent,
        projectDir: process.cwd(),
        provider: provider ?? undefined,
        model: model || undefined,
        maxSteps: max_steps != null ? max_steps : undefined,
        json: true,
        noCache: true,
      });

      usage.trackCommand(process.cwd(), "run", { via: "handoff", agent: from_agent });

      // Step 2: Create handoff bundle
      bundle = handoff.createHandoffBundle(from_agent, sourceResult);

      // Broadcast handoff started (v2.7.0 — dashboard support)
      broadcastHandoffStarted(bundle.id, from_agent, to_agent);

      // Step 3: Convert bundle to enriched input for target agent
      const enrichedInput = handoff.bundleToInput(bundle) + "\n\n## Original Task\n" + input;

      // Step 4: Run target agent with enriched input
      const targetResult = await agentRuntime.runAgent({
        input: enrichedInput,
        agentName: to_agent,
        projectDir: process.cwd(),
        provider: provider ?? undefined,
        model: model || undefined,
        maxSteps: max_steps != null ? max_steps : undefined,
        json: true,
        noCache: true,
      });

      usage.trackCommand(process.cwd(), "run", { via: "handoff", agent: to_agent });

      // Store bundle
      if (STORED_BUNDLES.size >= MAX_STORED_BUNDLES) {
        const firstKey = STORED_BUNDLES.keys().next().value;
        STORED_BUNDLES.delete(firstKey);
      }
      STORED_BUNDLES.set(bundle.id, bundle);
      saveBundlesToDisk();

      // Broadcast handoff complete (v2.7.0 — dashboard support)
      broadcastHandoffComplete(bundle.id, targetResult.status === "error" ? "error" : "completed", bundle.artifacts.length, bundle.pendingTasks.length);

      res.json({
        handoffId: bundle.id,
        from: {
          agent: from_agent,
          status: sourceResult.status,
          steps: sourceResult.steps?.length,
          usage: sourceResult.usage,
        },
        to: {
          agent: to_agent,
          status: targetResult.status,
          output: targetResult.output?.slice(0, 5000),
          steps: targetResult.steps?.length,
          usage: targetResult.usage,
        },
        artifacts: bundle.artifacts.length,
        pendingTasks: bundle.pendingTasks.length,
      });
    } catch (err) {
      broadcastHandoffComplete(bundle?.id || "unknown", "error", [], []);
      next(err);
    }
  });

  // GET /handoff/:id — Retrieve stored bundle
  app.get("/handoff/:id", (req, res) => {
    const bundle = STORED_BUNDLES.get(req.params.id);
    if (!bundle) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: `Handoff bundle ${req.params.id} not found` } });
    }
    res.json(bundle);
  });

  // POST /agents/intervene — Inject feedback into a running agent
  app.post("/agents/intervene", (req, res) => {
    const { run_id, message } = req.body;

    if (!run_id || !message) {
      const err = new Error("Missing required fields: run_id, message");
      err.code = "VALIDATION_ERROR";
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: err.message } });
    }

    if (message.length > 10000) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Message too long (max 10000 chars)" } });
    }

    // Store intervention — the WebSocket layer's onStep callback will pick it up
    try {
      const { setPendingIntervention } = require("./ws");
      setPendingIntervention(run_id, { message, _ts: Date.now() });
    } catch {
      // WS module not loaded — CLI-only mode. Intervention will be stored but not delivered.
      return res.status(503).json({ error: { code: "WS_NOT_AVAILABLE", message: "Intervene requires WebSocket server to be running. Start the API server first." } });
    }

    logger.info(`Intervention queued for run ${run_id}: ${message.slice(0, 100)}`);
    res.json({ queued: true, run_id });
  });
}

module.exports = { mountHandoffRoutes };
