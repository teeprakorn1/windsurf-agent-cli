/**
 * Handoff Bundle — Agent-to-agent context packaging
 *
 * Inspired by Claude Design's "Handoff Bundle → Claude Code" pattern.
 * Instead of design → code, this is agent → agent.
 *
 * When agent A completes, it can produce a handoff bundle that agent B
 * picks up as enriched input — carrying context, artifacts, and pending tasks.
 *
 * Bundle format:
 *   {
 *     version: "1.0",
 *     source: { agentName, traceId, timestamp },
 *     context: { summary, keyDecisions, openQuestions },
 *     artifacts: [{ name, type, content, path? }],
 *     pendingTasks: [{ description, priority, assignTo? }],
 *     state: { steps, usage },
 *   }
 */

const crypto = require("crypto");
const logger = require("../core/logger");

const BUNDLE_VERSION = "1.0";

function createHandoffBundle(sourceAgent, runState) {
  const bundle = {
    version: BUNDLE_VERSION,
    id: crypto.randomUUID(),
    source: {
      agentName: sourceAgent,
      traceId: runState.traceId || null,
      timestamp: new Date().toISOString(),
    },
    context: {
      summary: extractSummary(runState),
      keyDecisions: extractDecisions(runState),
      openQuestions: [],
    },
    artifacts: extractArtifacts(runState),
    pendingTasks: extractPendingTasks(runState),
    state: {
      steps: runState.steps?.length || 0,
      status: runState.status,
      usage: runState.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    },
  };

  logger.info(`Handoff bundle created: ${bundle.id} from ${sourceAgent} (${bundle.artifacts.length} artifacts, ${bundle.pendingTasks.length} tasks)`);
  return bundle;
}

function extractSummary(runState) {
  if (!runState.output) return "(no output)";
  const output = typeof runState.output === "string" ? runState.output : JSON.stringify(runState.output);
  return output.slice(0, 1000);
}

function extractDecisions(runState) {
  const decisions = [];
  if (!runState.steps) return decisions;

  for (const step of runState.steps) {
    if (step.thought && /(?:^|\n|[.,;!?]\s)(?:I\s+)?(?:have\s+)?(?:decided|decision|chose|choosing|will\s+(?:use|go|take|proceed))/i.test(step.thought)) {
      decisions.push({
        step: step.step,
        summary: step.thought.slice(0, 300),
      });
    }
    // Track tool calls as action decisions
    if (step.action) {
      decisions.push({
        step: step.step,
        action: step.action.name,
        summary: `Used ${step.action.name}`,
      });
    }
  }

  return decisions.slice(0, 20);
}

function extractArtifacts(runState) {
  const artifacts = [];
  if (!runState.steps) return artifacts;

  for (const step of runState.steps) {
    if (step.toolCalls) {
      for (const tc of step.toolCalls) {
        // File writes become artifacts
        if (tc.tool === "fs.write" && tc.result?.written) {
          artifacts.push({
            name: tc.result.path?.split("/").pop() || "unknown",
            type: "file",
            path: tc.result.path,
            producedAtStep: step.step,
          });
        }
        // File edits become artifacts
        if (tc.tool === "fs.edit" && tc.result?.edited) {
          artifacts.push({
            name: tc.result.path?.split("/").pop() || "unknown",
            type: "edit",
            path: tc.result.path,
            producedAtStep: step.step,
          });
        }
        // Shell outputs become artifacts
        if (tc.tool === "shell.exec" && tc.result?.stdout) {
          artifacts.push({
            name: `shell_output_step${step.step}`,
            type: "shell_output",
            content: tc.result.stdout.slice(0, 2000),
            producedAtStep: step.step,
          });
        }
      }
    }
  }

  return artifacts;
}

function extractPendingTasks(runState) {
  const tasks = [];

  // If agent hit max_steps, remaining work becomes pending tasks
  if (runState.status === "max_steps") {
    tasks.push({
      description: "Agent reached max steps — continue from where it left off",
      priority: "high",
      lastThought: runState.steps?.[runState.steps.length - 1]?.thought?.slice(0, 500) || null,
    });
  }

  // If agent errored, the error becomes a task
  if (runState.status === "error" && runState.error) {
    tasks.push({
      description: `Fix error from previous agent: ${runState.error}`,
      priority: "high",
    });
  }

  return tasks;
}

function bundleToInput(bundle) {
  const parts = [];

  parts.push(`## Handoff from Agent: ${bundle.source.agentName}`);
  parts.push(`Timestamp: ${bundle.source.timestamp}`);
  if (bundle.source.traceId) parts.push(`Trace ID: ${bundle.source.traceId}`);

  parts.push(`\n## Summary\n${bundle.context.summary}`);

  if (bundle.context.keyDecisions.length > 0) {
    parts.push(`\n## Key Decisions`);
    for (const d of bundle.context.keyDecisions) {
      parts.push(`- Step ${d.step}: ${d.summary}`);
    }
  }

  if (bundle.artifacts.length > 0) {
    parts.push(`\n## Artifacts Produced`);
    for (const a of bundle.artifacts) {
      const loc = a.path ? ` at ${a.path}` : "";
      parts.push(`- ${a.name} (${a.type})${loc}`);
    }
  }

  if (bundle.pendingTasks.length > 0) {
    parts.push(`\n## Pending Tasks`);
    for (const t of bundle.pendingTasks) {
      const assign = t.assignTo ? ` → @${t.assignTo}` : "";
      parts.push(`- [${t.priority}] ${t.description}${assign}`);
    }
  }

  if (bundle.context.openQuestions.length > 0) {
    parts.push(`\n## Open Questions`);
    for (const q of bundle.context.openQuestions) {
      parts.push(`- ${q}`);
    }
  }

  return parts.join("\n");
}

function validateBundle(bundle) {
  if (!bundle || typeof bundle !== "object") return "Bundle must be an object";
  if (bundle.version !== BUNDLE_VERSION) return `Unsupported bundle version: ${bundle.version} (expected ${BUNDLE_VERSION})`;
  if (!bundle.source?.agentName) return "Bundle missing source.agentName";
  if (!bundle.context?.summary) return "Bundle missing context.summary";
  return null;
}

module.exports = {
  createHandoffBundle,
  bundleToInput,
  validateBundle,
  BUNDLE_VERSION,
};
