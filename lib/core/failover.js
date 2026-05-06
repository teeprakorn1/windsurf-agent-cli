/**
 * LLM Failover — Per-provider circuit breaker + failover chain
 *
 * Separated from agent-runtime.js for maintainability.
 * When one LLM provider fails, automatically tries the next in the chain.
 */

const circuitBreaker = require("./circuit-breaker");
const llmProviders = require("./llm-providers");
const logger = require("./logger");

const LLM_BREAKER_OPTIONS = { failureThreshold: 5, resetTimeoutMs: 30000 };
const FAILOVER_CHAIN = ["openai", "claude", "local", "mock"];

function ensureLlmBreaker(provider) {
  const name = `llm:${provider}`;
  if (!circuitBreaker.getBreaker(name)) {
    circuitBreaker.createBreaker(name, LLM_BREAKER_OPTIONS);
  }
  return name;
}

let _ollamaLastOk = 0;
const OLLAMA_OK_TTL_MS = 60000; // 1 minute

function _isOllamaLikelyAvailable() {
  const ollamaHost = process.env.OLLAMA_HOST || "http://localhost:11434";
  // If non-default host, assume available (user explicitly configured it)
  if (ollamaHost !== "http://localhost:11434") return true;
  // If we've had a successful call recently, assume available
  if (Date.now() - _ollamaLastOk < OLLAMA_OK_TTL_MS) return true;
  // Default: include in chain but circuit breaker will open after 5 failures
  return true;
}

function markOllamaOk() {
  _ollamaLastOk = Date.now();
}

function buildFailoverChain(preferredProvider) {
  const chain = ["openai", "claude", "local", "mock"];
  if (preferredProvider && chain.includes(preferredProvider)) {
    chain.unshift(chain.splice(chain.indexOf(preferredProvider), 1)[0]);
  }
  return chain.filter(p => {
    if (p === "openai" && !process.env.OPENAI_API_KEY) return false;
    if (p === "claude" && !process.env.ANTHROPIC_API_KEY) return false;
    if (p === "local" && !_isOllamaLikelyAvailable()) return false;
    return true;
  });
}

async function callLLMWithFailover(messages, llmOpts) {
  const preferredProvider = llmOpts.provider || "mock";
  const chain = buildFailoverChain(preferredProvider);
  let lastError;

  for (const provider of chain) {
    const breakerName = ensureLlmBreaker(provider);
    if (!circuitBreaker.canExecute(breakerName)) {
      logger.warn(`Circuit breaker OPEN for ${provider} — skipping`);
      continue;
    }

    try {
      const response = await llmProviders.callLLM(messages, { ...llmOpts, provider });
      circuitBreaker.recordSuccess(breakerName);
      if (provider === "local") markOllamaOk();
      return { response, provider };
    } catch (err) {
      circuitBreaker.recordFailure(breakerName, err);
      lastError = err;
      if (chain.indexOf(provider) < chain.length - 1) {
        logger.warn(`LLM call failed for ${provider}: ${err.message} — trying next provider`);
      }
    }
  }

  throw new Error(lastError ? `All LLM providers failed. Last error: ${lastError.message}` : "All LLM providers unavailable (circuit breakers OPEN)");
}

function isAnyLlmAvailable() {
  const chain = buildFailoverChain("openai");
  for (const provider of chain) {
    const breakerName = ensureLlmBreaker(provider);
    if (circuitBreaker.canExecute(breakerName)) return true;
  }
  return false;
}

module.exports = {
  ensureLlmBreaker,
  buildFailoverChain,
  callLLMWithFailover,
  isAnyLlmAvailable,
  markOllamaOk,
  LLM_BREAKER_OPTIONS,
  FAILOVER_CHAIN,
};
