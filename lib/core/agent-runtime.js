/**
 * Agent Runtime — ReAct loop execution engine
 * The core that makes this a real platform, not just a CLI tool.
 *
 * Decomposed into focused modules (V2.6):
 *   - react-loop.js    — ReAct loop execution (`runAgent`)
 *   - chat-session.js  — Interactive chat (`createChatSession`)
 *   - failover.js      — Per-provider circuit breaker + failover chain
 *   - cache.js         — LRU cache for agent results
 *   - agent-loader.js  — Load agent specs + skill instructions
 *   - prompt-builder.js — Build system prompts
 *   - input-sanitizer.js — Input validation + prompt injection detection
 *   - tool-parser.js   — Parse tool calls from LLM responses
 *
 * This file re-exports all public APIs for backward compatibility.
 */

const { runAgent, MAX_CONTEXT_CHARS, TOOL_TIMEOUT_MS } = require("./react-loop");
const { createChatSession } = require("./chat-session");
const { callLLMWithFailover, isAnyLlmAvailable, ensureLlmBreaker, buildFailoverChain } = require("./failover");
const { loadAgentSpec, loadSkillInstructions, DEFAULT_MAX_STEPS, MAX_ALLOWED_STEPS, MAX_AGENT_FILE_SIZE } = require("./agent-loader");
const { buildSystemPrompt, truncateSkillContent, MAX_SKILL_INSTRUCTION_CHARS } = require("./prompt-builder");
const { parseToolCalls } = require("./tool-parser");
const { sanitizeInput, safeStringify, MAX_INPUT_LENGTH } = require("./input-sanitizer");
const { _cacheKey, _cacheGet, _cacheSet, clearCache, CACHE_MAX, CACHE_TTL_MS } = require("./cache");

module.exports = {
  // Primary APIs
  runAgent,
  createChatSession,

  // Agent loading
  loadAgentSpec,
  loadSkillInstructions,

  // Tool parsing
  parseToolCalls,

  // Prompt building
  buildSystemPrompt,
  truncateSkillContent,

  // Failover
  callLLMWithFailover,
  isAnyLlmAvailable,
  ensureLlmBreaker,
  buildFailoverChain,

  // Input handling
  sanitizeInput,
  safeStringify,

  // Cache
  _cacheKey,
  _cacheGet,
  _cacheSet,
  clearCache,

  // Constants
  MAX_CONTEXT_CHARS,
  TOOL_TIMEOUT_MS,
  MAX_SKILL_INSTRUCTION_CHARS,
  MAX_INPUT_LENGTH,
  DEFAULT_MAX_STEPS,
  MAX_ALLOWED_STEPS,
  MAX_AGENT_FILE_SIZE,
  CACHE_MAX,
  CACHE_TTL_MS,
};
