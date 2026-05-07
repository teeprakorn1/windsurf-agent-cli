/**
 * Jobs API — Async job model for agent execution
 *
 * POST /jobs   → enqueue agent run → {jobId, status: "queued"}
 * GET  /jobs   → list recent jobs
 * GET  /jobs/:id → job status + result
 */

const { getDefaultQueue } = require("../core/request-queue");
const agentRuntime = require("../core/agent-runtime");
const usage = require("../core/usage");
const utils = require("../utils");
const apiConfig = require("./config");
const logger = require("../core/logger");

function mountJobRoutes(app) {
  // POST /jobs — enqueue agent run
  app.post("/jobs", async (req, res, next) => {
    try {
      const { agent_name, input, provider, model, max_steps } = req.body;

      // Validate required fields
      if (!input) {
        const err = new Error("Missing required field: input");
        err.code = "VALIDATION_ERROR";
        return next(err);
      }

      // Validate input length (defense-in-depth — prevents oversized input from consuming queue slot)
      const { MAX_INPUT_LENGTH } = require("../core/input-sanitizer");
      if (input.length > MAX_INPUT_LENGTH) {
        const err = new Error(`Input too long (${input.length} chars, max ${MAX_INPUT_LENGTH})`);
        err.code = "VALIDATION_ERROR";
        return next(err);
      }

      // Validate agent_name (defense-in-depth against path traversal)
      if (agent_name && !utils.isValidAgentName(agent_name)) {
        const err = new Error(`Invalid agent name: "${agent_name}" — cannot contain: / \\ : * ? " < > |`);
        err.code = "VALIDATION_ERROR";
        return next(err);
      }

      // Resolve agent_name — fail early if no default found
      const resolvedAgentName = agent_name || utils.findDefaultAgent(process.cwd());
      if (!resolvedAgentName) {
        const err = new Error("No agent_name provided and no default agent found. Run `aiyu-multi-agent init` first.");
        err.code = "VALIDATION_ERROR";
        return next(err);
      }

      // Validate max_steps (defense-in-depth)
      if (max_steps !== undefined && (typeof max_steps !== "number" || max_steps < 1 || max_steps > 50)) {
        const err = new Error("max_steps must be a number between 1 and 50");
        err.code = "VALIDATION_ERROR";
        return next(err);
      }

      // Circuit breaker check — use per-provider check via isAnyLlmAvailable
      const { isAnyLlmAvailable } = require("../core/agent-runtime");
      if (!isAnyLlmAvailable()) {
        const err = new Error("All LLM circuit breakers open");
        err.code = "CIRCUIT_OPEN";
        return next(err);
      }

      const queue = getDefaultQueue();

      const jobFn = async () => {
        const result = await agentRuntime.runAgent({
          input,
          agentName: resolvedAgentName,
          projectDir: process.cwd(),
          provider: provider || apiConfig.LLM_PROVIDER,
          model: model || undefined,
          maxSteps: max_steps || apiConfig.MAX_STEPS,
          json: true,
          noCache: true,
        });
        usage.trackCommand(process.cwd(), "run", { via: "api" });
        return result;
      };

      let jobId;
      try {
        jobId = queue.enqueue(jobFn, {
          priority: 0,
          timeout: apiConfig.JOB_TIMEOUT_MS,
        });
      } catch (err) {
        if (err.code === "QUEUE_FULL") {
          return next(err);
        }
        throw err;
      }

      res.status(202).json({ jobId, status: "queued" });
    } catch (err) {
      next(err);
    }
  });

  // GET /jobs — list recent jobs
  app.get("/jobs", (req, res) => {
    const queue = getDefaultQueue();
    const metrics = queue.getMetrics();
    const limit = parseInt(req.query.limit, 10) || 20;

    // Use public API instead of accessing internal map
    const jobs = queue.getRecentJobs(limit);

    res.json({
      jobs,
      metrics: {
        running: metrics.running,
        queued: metrics.queued,
        totalCompleted: metrics.totalCompleted,
        totalFailed: metrics.totalFailed,
      },
    });
  });

  // GET /jobs/:id — job status + result (truncated)
  app.get("/jobs/:id", (req, res) => {
    const queue = getDefaultQueue();
    const job = queue.getJob(req.params.id);

    if (!job) {
      return res.status(404).json({ error: { code: "JOB_NOT_FOUND", message: `Job ${req.params.id} not found` } });
    }

    // Truncate result to prevent leaking large agent outputs through API
    const MAX_RESULT_CHARS = 10000; // 10KB
    const response = { ...job };
    if (response.result && typeof response.result === "object") {
      const serialized = JSON.stringify(response.result);
      if (serialized.length > MAX_RESULT_CHARS) {
        response.result = { _truncated: true, preview: serialized.slice(0, MAX_RESULT_CHARS) };
      }
    } else if (typeof response.result === "string" && response.result.length > MAX_RESULT_CHARS) {
      response.result = response.result.slice(0, MAX_RESULT_CHARS) + "\n...[truncated]";
    }

    res.json(response);
  });
}

module.exports = { mountJobRoutes };
