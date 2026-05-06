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

function _isOllamaLikelyAvailable(provider) {
  switch (provider) {
    case "local": return !!process.env.OLLAMA_HOST;
    case "mock": return process.env.AIYU_ENABLE_MOCK === "1";
    default: return true;
  }
}

function _isOllamaRecentlyOk() {
  return _ollamaLastOk > 0 && (Date.now() - _ollamaLastOk < OLLAMA_OK_TTL_MS);
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
    if (p === "local" && !_isOllamaLikelyAvailable(p)) return false;
    // Deprioritize Ollama if it hasn't been confirmed available recently
    if (p === "local" && !_isOllamaRecentlyOk()) {
      // Move to end of chain (don't filter out — still usable)
      chain.splice(chain.indexOf(p), 1);
      chain.push(p);
      return true;
    }
    if (p === "mock") return process.env.AIYU_ENABLE_MOCK === "1";
    return true;
  });
}

function resolveProvider() {
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  if (process.env.OLLAMA_HOST) return "local";
  throw new Error(
    "No LLM provider configured. Set one of:\n" +
    "  OPENAI_API_KEY=sk-...\n" +
    "  ANTHROPIC_API_KEY=...\n" +
    "  OLLAMA_HOST=http://localhost:11434"
  );
}

async function callLLMWithFailover(messages, llmOpts) {
  const preferredProvider = llmOpts.provider || resolveProvider();
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
  resolveProvider,
  markOllamaOk,
  LLM_BREAKER_OPTIONS,
};
