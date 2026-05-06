/**
 * ReAct Loop — Core agent execution loop (Reason + Act)
 *
 * Separated from agent-runtime.js for maintainability.
 * This is the primary execution path for `aiyu-multi-agent run`.
 */

const crypto = require("crypto");

const tracing = require("./tracing");
const agentSystem = require("./agent-system");
const { callLLMWithFailover } = require("./failover");
const { loadAgentSpec, loadSkillInstructions, DEFAULT_MAX_STEPS, MAX_ALLOWED_STEPS } = require("./agent-loader");
const { buildSystemPrompt } = require("./prompt-builder");
const { parseToolCalls } = require("./tool-parser");
const { sanitizeInput, safeStringify } = require("./input-sanitizer");
const { _cacheKey, _cacheGet, _cacheSet } = require("./cache");
const toolRegistry = require("./tool-registry");

const MAX_CONTEXT_CHARS = 200000; // ~50k tokens, prevent memory overflow
const TOOL_TIMEOUT_MS = 30000; // 30s per tool call

async function runAgent(options) {
  const {
    input,
    agentName,
    projectDir = process.cwd(),
    provider: overrideProvider,
    model: overrideModel,
    maxSteps: overrideMaxSteps,
    onStep,
    json: jsonMode = false,
    noCache = false,
  } = options;

  // Input sanitization — length limit + prompt injection warning
  const safeInput = sanitizeInput(input);

  // Start distributed trace
  const traceId = tracing.startTrace(`agent.run.${agentName}`, { agentName, provider: overrideProvider });
  const traceSpanId = tracing.startSpan(traceId, "runAgent", { agentName });

  const agentSpec = loadAgentSpec(projectDir, agentName);
  const skillInstructions = loadSkillInstructions(projectDir, agentSpec.skills);
  const provider = options.provider ?? agentSpec.provider ?? undefined;
  const model = overrideModel ?? agentSpec.model ?? "gpt-4";

  // Compute instructions hash for cache invalidation on spec changes
  const instructionsHash = crypto.createHash("sha256")
    .update(agentSpec.instructions || "")
    .update(typeof skillInstructions === "string" ? skillInstructions : JSON.stringify(skillInstructions) || "")
    .digest("hex").slice(0, 8);

  const maxSteps = Math.min(overrideMaxSteps ?? agentSpec.maxSteps ?? DEFAULT_MAX_STEPS, MAX_ALLOWED_STEPS);
  const outputFormat = options.outputFormat ?? agentSpec.outputFormat ?? "text";
  const deterministic = options.deterministic ?? agentSpec.deterministic ?? false;

  // Rebuild cache key with resolved values (not raw options) to prevent false cache hits
  const resolvedCacheKey = _cacheKey(safeInput, agentName, provider, model, outputFormat, deterministic, maxSteps, instructionsHash, projectDir);
  if (!noCache) {
    const cached = _cacheGet(resolvedCacheKey);
    if (cached) {
      cached._fromCache = true;
      tracing.addSpanEvent(traceId, traceSpanId, "cache_hit");
      tracing.endSpan(traceId, traceSpanId, { result: "cached" });
      tracing.endTrace(traceId, "ok", { fromCache: true });
      if (onStep) onStep({ step: 0, thought: "(cached)", action: null, result: null, error: null, duration_ms: 0, toolCalls: [] }, cached);
      return cached;
    }
  }

  // Auto-detect project context and inject into system prompt
  const projectProfile = agentSystem.detect(projectDir);

  // Build system prompt
  const systemPrompt = buildSystemPrompt(agentSpec, skillInstructions, projectProfile);

  // LLM options
  const llmOpts = { provider, model, outputFormat };
  if (deterministic) {
    llmOpts.temperature = 0;
  }

  // State
  const state = {
    input: safeInput,
    steps: [],
    status: "running",
    output: null,
    error: null,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    traceId,
  };

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: safeInput },
  ];

  // ReAct loop
  for (let step = 0; step < maxSteps; step++) {
    const stepSpanId = tracing.startSpan(traceId, `step.${step + 1}`, { step: step + 1 });
    const stepStart = Date.now();

    // Inline intervention: inject mid-run feedback from WebSocket/API
    if (state._intervention) {
      const interventionMsg = state._intervention;
      state._intervention = null;
      messages.push({ role: "user", content: `[Intervention] ${interventionMsg}` });
      tracing.addSpanEvent(traceId, stepSpanId, "intervention", { message: interventionMsg.slice(0, 100) });
    }

    // Call LLM with automatic per-provider failover
    let response;
    try {
      const result = await callLLMWithFailover(messages, llmOpts);
      response = result.response;
      if (result.provider !== llmOpts.provider) {
        tracing.addSpanEvent(traceId, stepSpanId, "provider_failover", { to: result.provider });
        llmOpts.provider = result.provider;
      }
    } catch (err) {
      state.status = "error";
      state.error = `LLM call failed at step ${step + 1}: ${err.message}`;
      tracing.endSpan(traceId, stepSpanId, { error: err.message, errorType: "llm_failure" });
      break;
    }

    // Track usage
    if (response.usage) {
      state.usage.promptTokens += response.usage.promptTokens || 0;
      state.usage.completionTokens += response.usage.completionTokens || 0;
      state.usage.totalTokens += response.usage.totalTokens || 0;
    }

    const assistantContent = response.content || "";

    // Parse tool calls from response (fallback chain)
    const toolCalls = parseToolCalls(assistantContent, response.toolCalls);

    // Standard step record
    const stepRecord = {
      step: step + 1,
      thought: assistantContent,
      action: null,
      result: null,
      error: null,
      duration_ms: 0,
      toolCalls: [],
    };

    // If no tool calls, agent is done — return output
    if (toolCalls.length === 0) {
      stepRecord.duration_ms = Date.now() - stepStart;
      state.output = assistantContent;
      state.status = "complete";
      state.steps.push(stepRecord);
      tracing.endSpan(traceId, stepSpanId, { result: "complete" });
      if (onStep) onStep(stepRecord, state);
      break;
    }

    // Execute tool calls
    messages.push({ role: "assistant", content: assistantContent });

    for (const toolCall of toolCalls) {
      const resolvedName = toolRegistry.resolveToolName(toolCall.tool);
      const tool = toolRegistry.getTool(resolvedName);
      if (!tool) {
        const errMsg = `Tool "${resolvedName}" not found. Available: ${toolRegistry.listTools().join(", ")}`;
        stepRecord.toolCalls.push({ tool: resolvedName, args: toolCall.args, error: errMsg, duration_ms: 0 });
        stepRecord.error = errMsg;
        messages.push({ role: "user", content: `Tool error: ${errMsg}` });
        continue;
      }

      // Validate tool args
      const validationErr = toolRegistry.validateToolArgs(resolvedName, toolCall.args || {});
      if (validationErr) {
        stepRecord.toolCalls.push({ tool: resolvedName, args: toolCall.args, error: validationErr, duration_ms: 0 });
        stepRecord.error = validationErr;
        messages.push({ role: "user", content: `Tool validation error (${resolvedName}): ${validationErr}` });
        continue;
      }

      const toolStart = Date.now();
      const toolSpanId = tracing.startSpan(traceId, `tool.${resolvedName}`, { tool: resolvedName });
      try {
        const toolArgs = { ...toolCall.args, projectRoot: projectDir, _currentAgent: agentName, _provider: provider, _model: model };
        const toolPromise = tool(toolArgs);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Tool "${resolvedName}" timed out after ${TOOL_TIMEOUT_MS / 1000}s`)), TOOL_TIMEOUT_MS)
        );
        let result = await Promise.race([toolPromise, timeoutPromise]);
        result = toolRegistry.truncateResult(result);
        const toolDuration = Date.now() - toolStart;
        stepRecord.toolCalls.push({ tool: resolvedName, args: toolCall.args, result, duration_ms: toolDuration });
        stepRecord.action = { name: resolvedName, args: toolCall.args };
        stepRecord.result = result;
        tracing.endSpan(traceId, toolSpanId, { result: "ok" });
        let toolResultStr = `Tool result (${resolvedName}): ${safeStringify(result)}`;
        // Karpathy surgical change guardrail: warn on large file mutations
        if ((resolvedName.includes("fs.write") || resolvedName.includes("fs.edit")) && safeStringify(result).length > 5000) {
          toolResultStr += `\n[Guardrail] Large change detected. Verify every changed line traces directly to the user's request. If a senior engineer would say this is overcomplicated, simplify.`;
        }
        messages.push({ role: "user", content: toolResultStr });
      } catch (err) {
        const toolDuration = Date.now() - toolStart;
        const isTimeout = err.message.includes("timed out");
        stepRecord.toolCalls.push({ tool: resolvedName, args: toolCall.args, error: err.message, duration_ms: toolDuration });
        stepRecord.error = err.message;
        tracing.endSpan(traceId, toolSpanId, { error: err.message, errorType: isTimeout ? "tool_timeout" : "tool_failure" });
        messages.push({ role: "user", content: `Tool error (${resolvedName}): ${err.message}` });
      }
    }

    stepRecord.duration_ms = Date.now() - stepStart;
    state.steps.push(stepRecord);
    if (stepSpanId) tracing.endSpan(traceId, stepSpanId, { result: stepRecord.error ? "error" : "ok" });
    if (onStep) onStep(stepRecord, state);

    // Enforce context size limit to prevent memory overflow
    // Trim message contents rather than dropping messages to preserve tool call/result pairs
    const totalChars = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
    if (totalChars > MAX_CONTEXT_CHARS) {
      const excess = totalChars - MAX_CONTEXT_CHARS;
      const trimmable = messages.filter(m => m.role !== "system");
      if (trimmable.length > 0) {
        const trimPerMsg = Math.ceil(excess / trimmable.length) + 100; // +100 buffer
        for (const m of trimmable) {
          if (m.content && m.content.length > trimPerMsg * 2) {
            m.content = m.content.slice(0, Math.max(100, m.content.length - trimPerMsg)) + "\n...[truncated for context limit]";
          }
        }
      }
      // If still over limit after trimming, drop oldest non-system messages in pairs
      // (assistant tool-call + user tool-result) to preserve conversation coherence
      while (messages.reduce((sum, m) => sum + (m.content?.length || 0), 0) > MAX_CONTEXT_CHARS && messages.length > 3) {
        // Drop the oldest pair: messages[1] (assistant) + messages[2] (user/tool-result)
        // Or just messages[1] if only one remains
        if (messages.length > 3 && messages[1].role === "assistant" && messages[2]?.role === "user") {
          messages.splice(1, 2);
        } else {
          messages.splice(1, 1);
        }
      }
    }
  }

  if (state.status === "running") {
    state.status = "max_steps";
    state.output = state.steps[state.steps.length - 1]?.thought || "Max steps reached without completion";
  }

  // End trace
  tracing.endSpan(traceId, traceSpanId, { result: state.status });
  tracing.endTrace(traceId, state.status === "complete" ? "ok" : "error", {
    steps: state.steps.length,
    tokens: state.usage.totalTokens,
  });

  // Output format enforcement
  if (outputFormat === "json" && state.output) {
    try {
      JSON.parse(state.output);
    } catch {
      state.output = JSON.stringify({ text: state.output });
    }
  }

  // Cache result (only cache successful completions)
  if (!noCache && state.status === "complete") {
    _cacheSet(resolvedCacheKey, state);
  }

  return state;
}

module.exports = {
  runAgent,
  MAX_CONTEXT_CHARS,
  TOOL_TIMEOUT_MS,
};
