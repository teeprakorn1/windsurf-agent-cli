/**
 * Handoff & Intervene API — Agent-to-agent handoff + inline feedback
 *
 * POST /handoff         → Run agent A, create bundle, run agent B with enriched input
 * POST /agents/intervene → Inject feedback into a running agent
 * GET  /handoff/:id     → Retrieve a stored handoff bundle
 */

const agentRuntime = require("../core/agent-runtime");
const handoff = require("../core/handoff");
const usage = require("../core/usage");
const utils = require("../utils");
const circuitBreaker = require("../core/circuit-breaker");
const logger = require("../core/logger");

const STORED_BUNDLES = new Map();
const MAX_STORED_BUNDLES = 100;

function mountHandoffRoutes(app) {
  // POST /handoff — Run agent A → bundle → run agent B
  app.post("/handoff", async (req, res, next) => {
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

      if (!circuitBreaker.canExecute("llm")) {
        const err = new Error("LLM circuit breaker open");
        err.code = "CIRCUIT_OPEN";
        return next(err);
      }

      // Step 1: Run source agent
      const sourceResult = await agentRuntime.runAgent({
        input,
        agentName: from_agent,
        projectDir: process.cwd(),
        provider: provider || undefined,
        model: model || undefined,
        maxSteps: max_steps || undefined,
        json: true,
        noCache: true,
      });

      usage.trackCommand(process.cwd(), "run", { via: "handoff", agent: from_agent });

      // Step 2: Create handoff bundle
      const bundle = handoff.createHandoffBundle(from_agent, sourceResult);

      // Step 3: Convert bundle to enriched input for target agent
      const enrichedInput = handoff.bundleToInput(bundle) + "\n\n## Original Task\n" + input;

      // Step 4: Run target agent with enriched input
      const targetResult = await agentRuntime.runAgent({
        input: enrichedInput,
        agentName: to_agent,
        projectDir: process.cwd(),
        provider: provider || undefined,
        model: model || undefined,
        maxSteps: max_steps || undefined,
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
    const { PENDING_INTERVENTIONS } = require("./ws");
    PENDING_INTERVENTIONS.set(run_id, { message, _ts: Date.now() });

    logger.info(`Intervention queued for run ${run_id}: ${message.slice(0, 100)}`);
    res.json({ queued: true, run_id });
  });
}

module.exports = { mountHandoffRoutes };
