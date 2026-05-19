const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const DEFAULT_ENGINES = ["claude", "codex", "gemini", "cursor-agent", "copilot", "qwen", "deepseek", "aider"];
const CACHE_TTL_MS = 5 * 60 * 1000;
const VERSION_ARGS = [["--version"], ["version"], ["-v"]];

let cachedAt = 0;
let cachedRegistry = null;

function pathEntries(pathValue = process.env.PATH || "") {
  return pathValue.split(path.delimiter).filter(Boolean);
}

function findExecutable(name, pathValue = process.env.PATH || "") {
  for (const dir of pathEntries(pathValue)) {
    const candidate = path.join(dir, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {}
  }
  return null;
}

function detectVersion(binaryPath) {
  if (!binaryPath) return null;
  for (const args of VERSION_ARGS) {
    const result = spawnSync(binaryPath, args, {
      encoding: "utf-8",
      shell: false,
      timeout: 2000,
      env: { PATH: process.env.PATH || "", HOME: process.env.HOME || "", TERM: process.env.TERM || "" },
      maxBuffer: 64 * 1024,
    });
    const text = `${result.stdout || ""}${result.stderr || ""}`.trim();
    if (!result.error && text) return text.split(/\r?\n/)[0].slice(0, 160);
  }
  return null;
}

function normalizeConfig(config = {}) {
  if (!config || typeof config !== "object") return {};
  const source = config.cliEngines || config;
  const normalized = {};
  for (const [name, value] of Object.entries(source)) {
    if (value === false) {
      normalized[name] = { enabled: false };
    } else if (value === true) {
      normalized[name] = { enabled: true };
    } else if (value && typeof value === "object") {
      normalized[name] = { ...value, enabled: value.enabled !== false };
    }
  }
  return normalized;
}

function adapterFor(name) {
  if (name === "claude") return "claude";
  if (name === "codex") return "codex";
  return "generic";
}

function buildEngine(name, binaryPath, config = {}) {
  return {
    name,
    provider: `cli:${name}`,
    path: config.path || binaryPath,
    available: Boolean(config.path || binaryPath),
    enabled: config.enabled !== false,
    version: detectVersion(config.path || binaryPath),
    adapter: config.adapter || adapterFor(name),
    args: config.args,
    timeoutMs: config.timeoutMs || config.timeout_ms,
    envAllowlist: config.envAllowlist || config.env_allowlist || [],
  };
}

function scanPath(options = {}) {
  const names = options.names || DEFAULT_ENGINES;
  const engineConfig = normalizeConfig(options.config);
  const registry = {};
  const allNames = Array.from(new Set([...names, ...Object.keys(engineConfig)]));
  for (const name of allNames) {
    const cfg = engineConfig[name] || {};
    const binaryPath = findExecutable(cfg.binary || name, options.pathValue || process.env.PATH || "");
    registry[name] = buildEngine(name, binaryPath, cfg);
  }
  return registry;
}

function buildCliRegistry(options = {}) {
  const now = Date.now();
  if (!options.noCache && cachedRegistry && now - cachedAt < CACHE_TTL_MS) return cachedRegistry;
  cachedRegistry = scanPath(options);
  cachedAt = now;
  return cachedRegistry;
}

function listAvailableEngines(options = {}) {
  return Object.values(buildCliRegistry(options)).filter(engine => engine.enabled && engine.available);
}

function getEngine(name, options = {}) {
  if (!name) return null;
  return buildCliRegistry(options)[name] || null;
}

function clearCache() {
  cachedAt = 0;
  cachedRegistry = null;
}

module.exports = {
  DEFAULT_ENGINES,
  CACHE_TTL_MS,
  scanPath,
  buildCliRegistry,
  listAvailableEngines,
  getEngine,
  detectVersion,
  findExecutable,
  clearCache,
};
