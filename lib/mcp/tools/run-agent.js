/**
 * MCP Tool: run_agent — Execute an agent with input and return the result
 */

const agentRuntime = require("../../core/agent-runtime");
const utils = require("../../utils");

async function runAgent(params) {
  const { agent_name, input, provider, model, max_steps, projectDir } = params;

  if (!agent_name) {
    return { error: "agent_name is required" };
  }
  if (!input) {
    return { error: "input is required" };
  }
  if (!utils.isValidAgentName(agent_name)) {
    return { error: `Invalid agent name: "${agent_name}" — cannot contain: / \\ : * ? " < > |` };
  }

  try {
    const state = await agentRuntime.runAgent({
      input,
      agentName: agent_name,
      projectDir,
      provider: provider || undefined,
      model: model || undefined,
      maxSteps: max_steps || undefined,
      json: true,
      noCache: true,
    });

    const result = {
      agent: agent_name,
      output: state.output || "",
      steps: state.steps ? state.steps.length : 0,
      status: state.status,
    };

    if (state.steps) {
      const toolCalls = [];
      for (const step of state.steps) {
        if (step.toolCalls) {
          for (const tc of step.toolCalls) {
            toolCalls.push(tc.tool || tc.name || "unknown");
          }
        }
      }
      if (toolCalls.length > 0) result.toolCalls = toolCalls;
    }

    if (state.usage) {
      result.usage = {
        promptTokens: state.usage.promptTokens || 0,
        completionTokens: state.usage.completionTokens || 0,
        totalTokens: state.usage.totalTokens || 0,
      };
    }

    if (state.error) {
      result.error = state.error;
    }

    // Truncate output if too large for MCP message
    const MAX_OUTPUT_CHARS = 50000;
    if (result.output && result.output.length > MAX_OUTPUT_CHARS) {
      result.output = result.output.slice(0, MAX_OUTPUT_CHARS) + "\n... [truncated]";
      result.truncated = true;
    }

    return result;
  } catch (err) {
    return { agent: agent_name, error: err.message, status: "error" };
  }
}

module.exports = { runAgent };
