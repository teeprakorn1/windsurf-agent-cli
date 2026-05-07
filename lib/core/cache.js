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
  const keyData = JSON.stringify([input, agentName, provider, model, outputFormat || "text", deterministic || false, maxSteps || 10, agentInstructionsHash || "", projectDir || ""]);
  return crypto.createHash("sha256").update(keyData).digest("hex").slice(0, 16);
}

function _cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { _cache.delete(key); return null; }
  // Update access time for true LRU behavior
  entry.lastAccess = Date.now();
  // Return deep copy only for object/array results — strings/numbers are immutable
  const data = entry.data;
  if (typeof data === "object" && data !== null) {
    try { return JSON.parse(JSON.stringify(data)); }
    catch {
      // Cannot deep clone — return a mutable shallow copy (downstream may add _fromCache)
      if (Array.isArray(data)) return [...data];
      return { ...data };
    }
  }
  return data;
}

function _cacheSet(key, data) {
  if (_cache.size >= CACHE_MAX) {
    // LRU eviction — delete least recently accessed entry
    let lruKey = null;
    let lruAccess = Infinity;
    for (const [k, v] of _cache) {
      const accessTime = v.lastAccess || v.ts;
      if (accessTime < lruAccess) { lruAccess = accessTime; lruKey = k; }
    }
    if (lruKey) _cache.delete(lruKey);
  }
  _cache.set(key, { data, ts: Date.now(), lastAccess: Date.now() });
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
