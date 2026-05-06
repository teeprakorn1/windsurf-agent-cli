/**
 * Cache — Simple LRU cache for agent run results
 *
 * Separated from agent-runtime.js for maintainability.
 * In-memory cache with TTL, LRU eviction, and safe deep-copy on read.
 */

const crypto = require("crypto");

const CACHE_MAX = 100;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const _cache = new Map();

function _cacheKey(input, agentName, provider, model, outputFormat, deterministic, maxSteps, agentInstructionsHash, projectDir) {
  return crypto.createHash("sha256").update(`${input}|${agentName}|${provider}|${model}|${outputFormat || "text"}|${deterministic || false}|${maxSteps || 10}|${agentInstructionsHash || ""}|${projectDir || ""}`).digest("hex").slice(0, 16);
}

function _cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { _cache.delete(key); return null; }
  // Return deep copy only for object/array results — strings/numbers are immutable
  const data = entry.data;
  if (typeof data === "object" && data !== null) {
    try { return JSON.parse(JSON.stringify(data)); }
    catch {
      // Cannot deep clone — return a frozen copy to prevent cache mutation
      if (Array.isArray(data)) return Object.freeze([...data]);
      return Object.freeze({ ...data });
    }
  }
  return data;
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

function clearCache() {
  _cache.clear();
}

module.exports = {
  _cacheKey,
  _cacheGet,
  _cacheSet,
  clearCache,
  CACHE_MAX,
  CACHE_TTL_MS,
};
