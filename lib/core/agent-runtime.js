/**
 * Agent Runtime — ReAct loop execution engine
 * The core that makes this a real platform, not just a CLI tool.
 *
 * Pattern: ReAct (Reason + Act)
 *   1. Observe input + state
 *   2. Think — LLM generates thought + action
 *   3. Act — execute tool call or return output
 *   4. Observe result → loop back to 2
 *
 * Modules split out for maintainability:
 *   - tool-registry.js — Tool definitions, schemas, namespace resolution
 *   - llm-providers.js — OpenAI, Claude, Ollama, Mock providers
 */

const fs = require("fs");
const path = require("path");

const config = require("./config");
const guardrails = require("./guardrails");
const logger = require("./logger");
const toolRegistry = require("./tool-registry");
const llmProviders = require("./llm-providers");
const circuitBreaker = require("./circuit-breaker");
const tracing = require("./tracing");
const { parseFrontmatter } = require("../utils");

// Initialize circuit breaker for LLM calls
circuitBreaker.createBreaker("llm", { failureThreshold: 5, resetTimeoutMs: 30000 });

function safeStringify(obj) {
  try { return JSON.stringify(obj, null, 2); }
  catch { return "[unserializable result]"; }
}

const DEFAULT_MAX_STEPS = 10;
const MAX_ALLOWED_STEPS = 50; // Hard cap to prevent runaway loops
const DEFAULT_LOOP = "react";
const MAX_CONTEXT_CHARS = 200000; // ~50k tokens, prevent memory overflow
const MAX_INPUT_LENGTH = 100000; // ~25k tokens — prevent oversized input

// Prompt injection indicators (heuristic, not foolproof)
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /disregard\s+(all\s+)?previous/i,
  /you\s+are\s+now\s+/i,
  /system\s*:\s*/i,
  /\<\/?system\>/i,
];

function sanitizeInput(input) {
  if (typeof input !== "string") throw new Error("Input must be a string");
  if (input.length > MAX_INPUT_LENGTH) {
    throw new Error(`Input too long (${input.length} chars, max ${MAX_INPUT_LENGTH}). Trim or split your request.`);
  }
  // Heuristic prompt injection warning (not a block — LLM should handle it, but log it)
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      logger.warn(`Possible prompt injection detected in input (pattern: ${pattern.source})`);
      break;
    }
  }
  return input;
}

// ── Simple Cache ──────────────────────────────────────────────────────

const _cache = new Map();
const CACHE_MAX = 100;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function _cacheKey(input, agentName, provider, model, outputFormat, deterministic, maxSteps, agentInstructionsHash, projectDir) {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(`${input}|${agentName}|${provider}|${model}|${outputFormat || "text"}|${deterministic || false}|${maxSteps || DEFAULT_MAX_STEPS}|${agentInstructionsHash || ""}|${projectDir || ""}`).digest("hex").slice(0, 16);
}

function _cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { _cache.delete(key); return null; }
  // Return deep copy to prevent callers from mutating cache entry
  return JSON.parse(JSON.stringify(entry.data));
}

function _cacheSet(key, data) {
  if (_cache.size >= CACHE_MAX) {
    // LRU eviction — delete oldest entry by timestamp
    let oldestKey = null;
    let oldestTs = Infinity;
    for (const [k, v] of _cache) {
      if (v.ts < oldestTs) { oldestTs = v.ts; oldestKey = k; }
    }
    if (oldestKey) _cache.delete(oldestKey);
  }
  _cache.set(key, { data, ts: Date.now() });
}

// ── Agent Loader ──────────────────────────────────────────────────────

function loadAgentSpec(projectDir, agentName) {
  const cfgDir = config.getConfigDir(projectDir);
  if (!cfgDir) throw new Error("No config directory found. Run `aiyu-multi-agent init` first.");

  // Enforce runtime spec version
  const specConfig = config.loadConfig(projectDir);
  if (specConfig) {
    const specVersion = specConfig.workspace?.version || specConfig.version;
    if (specVersion && parseInt(specVersion, 10) > 2) {
      throw new Error(`Unsupported runtime spec version: v${specVersion}. This CLI supports v1-v2. Please update aiyu-multi-agent.`);
    }
  }

  const agentPath = path.join(cfgDir, "agents", `${agentName}.md`);
  if (!fs.existsSync(agentPath)) {
    throw new Error(`Agent not found: ${agentName}`);
  }

  const content = fs.readFileSync(agentPath, "utf-8");
  const fm = parseFrontmatter(content);
  if (!fm || Object.keys(fm).length === 0) throw new Error(`Agent ${agentName} missing frontmatter`);

  const instructions = content.replace(/^---\r?\n[\s\S]*?\r?\n---/, "").trim();

  return {
    name: fm.name || agentName,
    description: fm.description || "",
    tools: Array.isArray(fm.tools) ? fm.tools : (fm.tools ? fm.tools.split(",").map(t => t.trim()) : []),
    skills: Array.isArray(fm.skills) ? fm.skills : (fm.skills ? fm.skills.split(",").map(s => s.trim()) : []),
    provider: fm.provider || "inherit",
    model: fm.model || "inherit",
    memory: fm.memory || "none",
    guardrails: fm.guardrails !== false,
    maxSteps: Math.max(1, Math.min(parseInt(fm.max_steps, 10) || DEFAULT_MAX_STEPS, MAX_ALLOWED_STEPS)),
    loop: fm.loop || DEFAULT_LOOP,
    outputFormat: fm.output_format || fm.outputFormat || "text",
    deterministic: fm.deterministic === true || fm.deterministic === "true",
    instructions,
  };
}

// ── Skill Loader ─────────────────────────────────────────────────────

function loadSkillInstructions(projectDir, skillNames) {
  const cfgDir = config.getConfigDir(projectDir);
  if (!cfgDir) return {};

  const instructions = {};
  const skillDirs = [
    path.join(cfgDir, "skills", "installed"),
    path.join(cfgDir, "skills", "core"),
    path.join(cfgDir, "skills"),
  ];

  for (const skillName of skillNames) {
    for (const dir of skillDirs) {
      const skillPath = path.join(dir, skillName, "SKILL.md");
      if (fs.existsSync(skillPath)) {
        instructions[skillName] = fs.readFileSync(skillPath, "utf-8");
        break;
      }
    }
  }

  return instructions;
}

// ── ReAct Loop ────────────────────────────────────────────────────────

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
  const provider = overrideProvider ?? agentSpec.provider ?? "mock";
  const model = overrideModel ?? agentSpec.model ?? "gpt-4";

  // Cache check — include agent instructions hash to invalidate on spec changes
  const crypto = require("crypto");
  const instructionsHash = crypto.createHash("sha256").update(agentSpec.instructions || "").digest("hex").slice(0, 8);
  const cacheKey = _cacheKey(safeInput, agentName, provider, model, options.outputFormat, options.deterministic, overrideMaxSteps, instructionsHash, projectDir);
  if (!noCache) {
    const cached = _cacheGet(cacheKey);
    if (cached) {
      cached._fromCache = true;
      tracing.addSpanEvent(traceId, traceSpanId, "cache_hit");
      tracing.endSpan(traceId, traceSpanId, { result: "cached" });
      tracing.endTrace(traceId, "ok", { fromCache: true });
      if (onStep) onStep({ step: 0, thought: "(cached)", action: null, result: null, error: null, duration_ms: 0, toolCalls: [] }, cached);
      return cached;
    }
  }
  const maxSteps = Math.min(overrideMaxSteps ?? agentSpec.maxSteps ?? DEFAULT_MAX_STEPS, MAX_ALLOWED_STEPS);
  const outputFormat = options.outputFormat ?? agentSpec.outputFormat ?? "text";
  const deterministic = options.deterministic ?? agentSpec.deterministic ?? false;

  // Build system prompt
  const systemPrompt = buildSystemPrompt(agentSpec, skillInstructions);

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

    // Circuit breaker check before LLM call
    if (!circuitBreaker.canExecute("llm")) {
      const breakerStatus = circuitBreaker.getBreakerStatus("llm");
      state.status = "error";
      const breaker = circuitBreaker.getBreaker("llm");
      const resetMs = breaker?.options?.resetTimeoutMs || 30000;
      const retrySeconds = breakerStatus.lastFailureTime
        ? Math.max(0, Math.round((breakerStatus.lastFailureTime + resetMs - Date.now()) / 1000))
        : Math.round(resetMs / 1000);
      state.error = `Circuit breaker OPEN for LLM provider. Service appears down (failures: ${breakerStatus.failureCount}). Retry after ${retrySeconds}s`;
      tracing.endSpan(traceId, stepSpanId, { error: state.error, errorType: "circuit_breaker" });
      logger.warn(state.error);
      break;
    }

    let response;
    try {
      response = await llmProviders.callLLM(messages, llmOpts);
      circuitBreaker.recordSuccess("llm");
    } catch (err) {
      circuitBreaker.recordFailure("llm", err);
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

      // F3: Validate tool args
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
        const toolArgs = { ...toolCall.args, projectRoot: projectDir };
        let result = await tool(toolArgs);
        result = toolRegistry.truncateResult(result);
        const toolDuration = Date.now() - toolStart;
        stepRecord.toolCalls.push({ tool: resolvedName, args: toolCall.args, result, duration_ms: toolDuration });
        stepRecord.action = { name: resolvedName, args: toolCall.args };
        stepRecord.result = result;
        tracing.endSpan(traceId, toolSpanId, { result: "ok" });
        messages.push({ role: "user", content: `Tool result (${resolvedName}): ${safeStringify(result)}` });
      } catch (err) {
        const toolDuration = Date.now() - toolStart;
        stepRecord.toolCalls.push({ tool: resolvedName, args: toolCall.args, error: err.message, duration_ms: toolDuration });
        stepRecord.error = err.message;
        tracing.endSpan(traceId, toolSpanId, { error: err.message, errorType: "tool_failure" });
        messages.push({ role: "user", content: `Tool error (${resolvedName}): ${err.message}` });
      }
    }

    stepRecord.duration_ms = Date.now() - stepStart;
    state.steps.push(stepRecord);
    if (stepSpanId) tracing.endSpan(traceId, stepSpanId, { result: stepRecord.error ? "error" : "ok" });
    if (onStep) onStep(stepRecord, state);

    // Enforce context size limit to prevent memory overflow
    const totalChars = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
    if (totalChars > MAX_CONTEXT_CHARS) {
      const systemMsg = messages[0];
      const recent = messages.slice(-10); // Keep last ~5 exchanges (allows for tool result messages)
      messages.length = 0;
      messages.push(systemMsg, ...recent);
      logger.debug(`Context trimmed: ${totalChars} → ${messages.reduce((s, m) => s + (m.content?.length || 0), 0)} chars`);
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
    _cacheSet(cacheKey, state);
  }

  return state;
}

function buildSystemPrompt(agentSpec, skillInstructions) {
  let prompt = `You are ${agentSpec.name}, an AI agent.\n\n`;
  prompt += `## Description\n${agentSpec.description}\n\n`;
  prompt += `## Instructions\n${agentSpec.instructions}\n\n`;
  prompt += `## Available Tools\n${agentSpec.tools.map(t => `- ${toolRegistry.resolveToolName(t)}`).join("\n")}\n\n`;

  if (Object.keys(skillInstructions).length > 0) {
    prompt += `## Skills\n`;
    for (const [name, content] of Object.entries(skillInstructions)) {
      prompt += `### ${name}\n${content.slice(0, 2000)}\n\n`;
    }
  }

  prompt += `## Response Format\n`;
  prompt += `When you need to use a tool, respond with:\n`;
  prompt += `TOOL_CALL: <namespace.tool>(<json_args>)\n`;
  prompt += `Example: TOOL_CALL: fs.read({"path": "/src/index.js"})\n`;
  prompt += `Example: TOOL_CALL: shell.exec({"command": "npm test"})\n\n`;
  prompt += `When you have the final answer, respond with just the answer (no TOOL_CALL prefix).\n`;

  if (agentSpec.guardrails) {
    prompt += `\n## Guardrails\n- Never access files outside the project directory\n- Use safe write for all file operations\n- Respect rate limits\n- Only use allowed commands\n`;
  }

  return prompt;
}

function parseToolCalls(content, apiToolCalls) {
  // ── Fallback Chain: JSON → TOOL_CALL regex → final answer ──

  // Strategy 1: Structured API tool calls (OpenAI format)
  if (apiToolCalls && apiToolCalls.length > 0) {
    return apiToolCalls.map(tc => {
      const tool = toolRegistry.resolveToolName(tc.function?.name || tc.name);
      let args = {};
      try {
        args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : (tc.args || {});
      } catch {
        args = { _raw: tc.function?.arguments || "" };
      }
      return { tool, args };
    }).filter(tc => tc.tool);
  }

  // Strategy 2: TOOL_CALL: name(args) regex — handle nested parentheses in JSON args
  const calls = [];
  const tcRegex = /TOOL_CALL:\s*([\w.]+)\(/g;
  let tcMatch;
  while ((tcMatch = tcRegex.exec(content)) !== null) {
    const tool = toolRegistry.resolveToolName(tcMatch[1]);
    // Find matching closing paren by counting depth
    const startIdx = tcMatch.index + tcMatch[0].length;
    let depth = 1;
    let endIdx = startIdx;
    let inStr = false;
    let strCh = "";
    let escaped = false;
    for (; endIdx < content.length && depth > 0; endIdx++) {
      const ch = content[endIdx];
      if (inStr) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === "\\") { escaped = true; continue; }
        if (ch === strCh) inStr = false;
        continue;
      }
      if (ch === '"' || ch === "'") { inStr = true; strCh = ch; continue; }
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
    }
    const argsStr = content.slice(startIdx, endIdx - 1); // exclude closing paren
    let args = {};
    try {
      args = JSON.parse(argsStr || "{}");
    } catch {
      // Strategy 2b: try key=value parsing (double-quoted, single-quoted, unquoted)
      const kvPairs = argsStr.match(/(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^,}\s]+))/g);
      if (kvPairs) {
        kvPairs.forEach(kv => {
          const eqIdx = kv.indexOf("=");
          const k = kv.slice(0, eqIdx).trim();
          let v = kv.slice(eqIdx + 1).trim();
          // Strip surrounding quotes (double or single)
          if ((v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
              (v.startsWith("'") && v.endsWith("'") && v.length >= 2)) {
            v = v.slice(1, -1);
          }
          args[k] = v;
        });
      } else {
        args = { _raw: argsStr };
      }
    }
    calls.push({ tool, args });
  }
  if (calls.length > 0) return calls;

  // Strategy 3: Try extracting JSON action blocks
  const jsonBlockRegex = /```json\s*\n([\s\S]*?)\n```/g;
  let match;
  while ((match = jsonBlockRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.tool || parsed.action) {
        const tool = toolRegistry.resolveToolName(parsed.tool || parsed.action);
        calls.push({ tool, args: parsed.args || parsed.arguments || {} });
      }
    } catch { /* skip */ }
  }
  if (calls.length > 0) return calls;

  // Strategy 4: No tool calls found → final answer
  return [];
}

// ── Chat Session ──────────────────────────────────────────────────────

function createChatSession(options) {
  const {
    agentName,
    projectDir = process.cwd(),
    provider: overrideProvider,
    model: overrideModel,
  } = options;

  const agentSpec = loadAgentSpec(projectDir, agentName);
  const skillInstructions = loadSkillInstructions(projectDir, agentSpec.skills);
  const provider = overrideProvider ?? agentSpec.provider ?? "mock";
  const model = overrideModel ?? agentSpec.model ?? "gpt-4";
  const outputFormat = options.outputFormat ?? agentSpec.outputFormat ?? "text";
  const systemPrompt = buildSystemPrompt(agentSpec, skillInstructions);

  const messages = [{ role: "system", content: systemPrompt }];
  const history = [];

  return {
    agentName: agentSpec.name,
    provider,
    model,
    outputFormat,

    async send(userInput) {
      const safeChatInput = sanitizeInput(userInput);
      messages.push({ role: "user", content: safeChatInput });

      // Sliding window: keep system prompt + last N messages to prevent context overflow
      const MAX_CONTEXT_MESSAGES = 20;
      if (messages.length > MAX_CONTEXT_MESSAGES + 1) {
        const systemMsg = messages[0];
        const recent = messages.slice(-MAX_CONTEXT_MESSAGES);
        messages.length = 0;
        messages.push(systemMsg, ...recent);
      }

      // Enforce context size limit (char-based, more precise than message count)
      const totalChars = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
      if (totalChars > MAX_CONTEXT_CHARS) {
        const systemMsg = messages[0];
        const recent = messages.slice(-10); // Keep last ~5 exchanges
        messages.length = 0;
        messages.push(systemMsg, ...recent);
      }

      const maxChatSteps = Math.min(agentSpec.maxSteps || DEFAULT_MAX_STEPS, 10);
      const chatLlmOpts = { provider, model };
      if (outputFormat && outputFormat !== "text") chatLlmOpts.outputFormat = outputFormat;
      if (agentSpec.deterministic) chatLlmOpts.temperature = 0;
      let actualSteps = 0;
      let finalContent = "";
      const toolResults = [];
      let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

      // Start trace for this chat turn
      const chatTraceId = tracing.startTrace(`chat.${agentSpec.name}`, { agentName: agentSpec.name, provider });
      const chatSpanId = tracing.startSpan(chatTraceId, `chat.turn`, { step: 0 });

      // Full ReAct loop (like runAgent) within the chat session
      const chatSteps = [];
      for (let step = 0; step < maxChatSteps; step++) {
        actualSteps = step + 1;
        const stepStart = Date.now();
        // Circuit breaker check before LLM call
        if (!circuitBreaker.canExecute("llm")) {
          const breakerStatus = circuitBreaker.getBreakerStatus("llm");
          const breaker = circuitBreaker.getBreaker("llm");
          const resetMs = breaker?.options?.resetTimeoutMs || 30000;
          const retrySeconds = breakerStatus.lastFailureTime
            ? Math.max(0, Math.round((breakerStatus.lastFailureTime + resetMs - Date.now()) / 1000))
            : Math.round(resetMs / 1000);
          finalContent = `Circuit breaker OPEN for LLM provider. Service appears down (failures: ${breakerStatus.failureCount}). Retry after ${retrySeconds}s`;
          logger.warn(finalContent);
          chatSteps.push({ step: step + 1, thought: null, toolCalls: [], duration_ms: Date.now() - stepStart, error: finalContent });
          break;
        }

        let response;
        try {
          response = await llmProviders.callLLM(messages, chatLlmOpts);
          circuitBreaker.recordSuccess("llm");
        } catch (err) {
          circuitBreaker.recordFailure("llm", err);
          finalContent = `LLM call failed: ${err.message}`;
          chatSteps.push({ step: step + 1, thought: null, toolCalls: [], duration_ms: Date.now() - stepStart, error: err.message });
          break;
        }
        messages.push({ role: "assistant", content: response.content });

        if (response.usage) {
          totalUsage.promptTokens += response.usage.promptTokens || 0;
          totalUsage.completionTokens += response.usage.completionTokens || 0;
          totalUsage.totalTokens += response.usage.totalTokens || 0;
        }

        const toolCalls = parseToolCalls(response.content, response.toolCalls);
        finalContent = response.content;

        if (toolCalls.length === 0) {
          chatSteps.push({ step: step + 1, thought: response.content.slice(0, 200), toolCalls: [], duration_ms: Date.now() - stepStart });
          break; // Final answer
        }

        const stepToolResults = [];
        for (const tc of toolCalls) {
          const resolvedName = toolRegistry.resolveToolName(tc.tool);
          const tool = toolRegistry.getTool(resolvedName);
          if (tool) {
            // Validate tool args (consistent with runAgent)
            const validationErr = toolRegistry.validateToolArgs(resolvedName, tc.args || {});
            if (validationErr) {
              messages.push({ role: "user", content: `Tool validation error (${resolvedName}): ${validationErr}` });
              stepToolResults.push({ tool: resolvedName, error: validationErr });
              continue;
            }
            try {
              const toolArgs = { ...(tc.args || {}), projectRoot: projectDir };
              let result = await tool(toolArgs);
              result = toolRegistry.truncateResult(result);
              toolResults.push({ tool: resolvedName, result });
              stepToolResults.push({ tool: resolvedName, result });
              messages.push({ role: "user", content: `Tool result (${resolvedName}): ${safeStringify(result)}` });
            } catch (err) {
              toolResults.push({ tool: resolvedName, error: err.message });
              stepToolResults.push({ tool: resolvedName, error: err.message });
              messages.push({ role: "user", content: `Tool error (${resolvedName}): ${err.message}` });
            }
          }
        }
        chatSteps.push({ step: step + 1, thought: response.content.slice(0, 200), toolCalls: stepToolResults, duration_ms: Date.now() - stepStart });
      }

      // End chat trace
      tracing.endSpan(chatTraceId, chatSpanId, { result: finalContent ? "ok" : "error" });
      tracing.endTrace(chatTraceId, finalContent ? "ok" : "error", { steps: actualSteps, tokens: totalUsage.totalTokens });

      // Output format enforcement (consistent with runAgent)
      const chatOutputFormat = outputFormat || agentSpec.outputFormat || "text";
      if (chatOutputFormat === "json" && finalContent) {
        try {
          JSON.parse(finalContent);
        } catch {
          finalContent = JSON.stringify({ text: finalContent });
        }
      }

      const entry = {
        role: "assistant",
        content: finalContent,
        toolCalls: toolResults,
        steps: chatSteps,
        usage: totalUsage,
        traceId: chatTraceId,
      };
      history.push(entry);

      return entry;
    },

    getHistory() {
      return history;
    },

    getMessages() {
      return messages;
    },
  };
}

module.exports = {
  runAgent,
  createChatSession,
  loadAgentSpec,
  loadSkillInstructions,
  parseToolCalls,
  buildSystemPrompt,
  MAX_CONTEXT_CHARS,
};
