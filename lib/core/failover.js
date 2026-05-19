/**
 * LLM Failover — Per-provider circuit breaker + failover chain
 *
 * Separated from agent-runtime.js for maintainability.
 * When one LLM provider fails, automatically tries the next in the chain.
 */

const circuitBreaker = require("./circuit-breaker");
const llmProviders = require("./llm-providers");
const logger = require("./logger");
const cliScanner = require("./cli-scanner");
const config = require("./config");

const LLM_BREAKER_OPTIONS = { failureThreshold: 5, resetTimeoutMs: 30000 };
const FAILOVER_CHAIN = ["openai", "claude", "groq", "local", "mock"];

function buildBaseChain() {
  const chain = [...FAILOVER_CHAIN];
  const cliConfig = config.loadCliEngineConfig(process.cwd());
  const engines = cliScanner.listAvailableEngines({ config: cliConfig });
  for (const engine of engines) {
    const provider = `cli:${engine.name}`;
    if (!chain.includes(provider)) chain.push(provider);
  }
  return chain;
}

function ensureLlmBreaker(provider) {
  const name = `llm:${provider}`;
  if (!circuitBreaker.getBreaker(name)) {
    circuitBreaker.createBreaker(name, LLM_BREAKER_OPTIONS);
  }
  return name;
}

// Shared across concurrent failover chains — safe in single-process Node.js event loop,
// but may cause stale "ok" if Ollama goes down between markOllamaOk() and next call.
let _ollamaLastOk = 0;
const OLLAMA_OK_TTL_MS = 60000; // 1 minute

function _isOllamaLikelyAvailable(provider) {
  switch (provider) {
    case "local": return !!process.env.OLLAMA_HOST;
    case "mock": return true;
    default: return false;
  }
}

function _isOllamaRecentlyOk() {
  return _ollamaLastOk > 0 && (Date.now() - _ollamaLastOk < OLLAMA_OK_TTL_MS);
}

function markOllamaOk() {
  _ollamaLastOk = Date.now();
}

function buildFailoverChain(preferredProvider) {
  const chain = buildBaseChain();
  if (preferredProvider && chain.includes(preferredProvider)) {
    chain.unshift(chain.splice(chain.indexOf(preferredProvider), 1)[0]);
  }
  // Phase 1: Filter out unavailable providers (no mutation during iteration)
  const filtered = chain.filter(p => {
    if (p === "openai" && !process.env.OPENAI_API_KEY) return false;
    if (p === "claude" && !process.env.ANTHROPIC_API_KEY) return false;
    if (p === "groq" && !process.env.GROQ_API_KEY) return false;
    if (p === "local" && !_isOllamaLikelyAvailable(p)) return false;
    if (p === "mock") return true;
    if (p.startsWith("cli:")) {
      const engine = cliScanner.getEngine(p.slice(4));
      return engine && engine.available;
    }
    return true;
  });
  // Phase 2: Deprioritize Ollama if not recently confirmed — move to end
  if (filtered.includes("local") && !_isOllamaRecentlyOk()) {
    filtered.splice(filtered.indexOf("local"), 1);
    filtered.push("local");
  }
  return filtered;
}

function resolveProvider() {
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.OLLAMA_HOST) return "local";
  return "mock";
}

async function callLLMWithFailover(messages, llmOpts) {
  const preferredProvider = llmOpts.provider || resolveProvider();
  const chain = buildFailoverChain(preferredProvider);
  let lastError;

  for (let i = 0; i < chain.length; i++) {
    const provider = chain[i];
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
      if (i < chain.length - 1) {
        logger.warn(`LLM call failed for ${provider}: ${err.message} — trying next provider`);
      }
    }
  }

  throw new Error(lastError ? `All LLM providers failed. Last error: ${lastError.message}` : "All LLM providers unavailable (circuit breakers OPEN)");
}

function isAnyLlmAvailable() {
  const chain = buildFailoverChain(resolveProvider());
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
