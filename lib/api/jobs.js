/**
 * Jobs API — Async job model for agent execution
 *
 * POST /jobs   → enqueue agent run → {jobId, status: "queued"}
 * GET  /jobs   → list recent jobs
 * GET  /jobs/:id → job status + result
 */

const { getDefaultQueue } = require("../core/request-queue");
const agentRuntime = require("../core/agent-runtime");
const circuitBreaker = require("../core/circuit-breaker");
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

      // Circuit breaker check
      if (!circuitBreaker.canExecute("llm")) {
        const err = new Error("LLM circuit breaker open");
        err.code = "CIRCUIT_OPEN";
        return next(err);
      }

      const queue = getDefaultQueue();

      const jobFn = async () => {
        return agentRuntime.runAgent({
          input,
          agentName: agent_name || undefined,
          provider: provider || apiConfig.LLM_PROVIDER,
          model: model || undefined,
          maxSteps: max_steps || apiConfig.MAX_STEPS,
          json: true,
          noCache: true,
        });
      };

      let jobId;
      try {
        jobId = queue.enqueue(jobFn, {
          priority: 0,
          timeout: apiConfig.JOB_TIMEOUT_MS,
        });
      } catch (err) {
        if (err.code === "QUEUE_FULL") {
          err.code = "QUEUE_FULL";
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

    // Collect job statuses from the queue's internal map
    const jobs = [];
    const entries = [...queue.jobs.entries()].slice(-limit);
    for (const [, job] of entries) {
      jobs.push({
        id: job.id,
        status: job.status,
        enqueuedAt: job.enqueuedAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
      });
    }

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

  // GET /jobs/:id — job status + result
  app.get("/jobs/:id", (req, res) => {
    const queue = getDefaultQueue();
    const status = queue.getJobStatus(req.params.id);

    if (!status) {
      return res.status(404).json({ error: { code: "JOB_NOT_FOUND", message: `Job ${req.params.id} not found` } });
    }

    // Get full job data for result
    const job = queue.jobs.get(req.params.id);
    const response = { ...status };
    if (job && job.status === "completed") {
      response.result = job.result;
    }
    if (job && job.status === "failed") {
      response.error = job.error;
    }

    res.json(response);
  });
}

module.exports = { mountJobRoutes };
