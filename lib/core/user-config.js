/**
 * User Config — ~/.aiyu/config.json
 *
 * Stores user-level settings: API keys, base URLs, default provider/model.
 * Priority: env var > user config > agent spec > hardcoded default.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const CONFIG_DIR = path.join(os.homedir(), ".aiyu");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

const DEFAULTS = {
  providers: {
    openai: {
      base_url: "https://api.openai.com",
      api_key: "",
      default_model: "gpt-4",
    },
    claude: {
      base_url: "https://api.anthropic.com",
      api_key: "",
      default_model: "claude-3-5-sonnet-20241022",
    },
    local: {
      base_url: "http://localhost:11434",
      api_key: "",
      default_model: "llama3",
    },
  },
  default_provider: "mock",
  default_model: "",
};

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function load() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return JSON.parse(JSON.stringify(DEFAULTS));
    const content = fs.readFileSync(CONFIG_FILE, "utf-8");
    const userCfg = JSON.parse(content);
    // Deep merge with defaults so new fields appear automatically
    return deepMerge(JSON.parse(JSON.stringify(DEFAULTS)), userCfg);
  } catch {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
}

function save(cfg) {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf-8");
}

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

/**
 * Get resolved provider config: env vars override user config.
 */
function getProviderConfig(providerName) {
  const cfg = load();
  const pCfg = cfg.providers?.[providerName] || {};

  const envMap = {
    openai: {
      base_url: process.env.OPENAI_BASE_URL,
      api_key: process.env.OPENAI_API_KEY,
    },
    claude: {
      base_url: process.env.ANTHROPIC_BASE_URL,
      api_key: process.env.ANTHROPIC_API_KEY,
    },
    local: {
      base_url: process.env.OLLAMA_HOST,
      api_key: null,
    },
  };

  const env = envMap[providerName] || {};

  return {
    base_url: env.base_url || pCfg.base_url || DEFAULTS.providers[providerName]?.base_url || "",
    api_key: env.api_key || pCfg.api_key || "",
    default_model: pCfg.default_model || DEFAULTS.providers[providerName]?.default_model || "",
  };
}

/**
 * Set a single provider field in user config (does NOT touch env vars).
 */
function setProviderField(providerName, field, value) {
  const cfg = load();
  if (!cfg.providers) cfg.providers = {};
  if (!cfg.providers[providerName]) cfg.providers[providerName] = {};
  cfg.providers[providerName][field] = value;
  save(cfg);
  return cfg;
}

/**
 * Set default provider and model in user config.
 */
function setDefaults(provider, model) {
  const cfg = load();
  if (provider) cfg.default_provider = provider;
  if (model) cfg.default_model = model;
  save(cfg);
  return cfg;
}

/**
 * Display current config as readable table.
 */
function display() {
  const cfg = load();
  const lines = [];
  lines.push("");
  lines.push("=== Aiyu User Config ===");
  lines.push(`  Config file: ${CONFIG_FILE}`);
  lines.push("");
  lines.push(`  Default provider: ${cfg.default_provider || "(none)"}`);
  lines.push(`  Default model:    ${cfg.default_model || "(none)"}`);
  lines.push("");
  for (const [name, pCfg] of Object.entries(cfg.providers || {})) {
    const masked = pCfg.api_key ? pCfg.api_key.slice(0, 8) + "..." + pCfg.api_key.slice(-4) : "(not set)";
    lines.push(`  [${name}]`);
    lines.push(`    base_url:      ${pCfg.base_url || "(default)"}`);
    lines.push(`    api_key:       ${masked}`);
    lines.push(`    default_model: ${pCfg.default_model || "(default)"}`);
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * Interactive config wizard — returns updated config.
 * Used by /config command in chat.
 */
function interactiveSet(providerName, field, value) {
  const validProviders = ["openai", "claude", "local"];
  const validFields = ["base_url", "api_key", "default_model"];

  if (!validProviders.includes(providerName)) {
    return { error: `Unknown provider "${providerName}". Valid: ${validProviders.join(", ")}` };
  }
  if (!validFields.includes(field)) {
    return { error: `Unknown field "${field}". Valid: ${validFields.join(", ")}` };
  }

  const cfg = setProviderField(providerName, field, value);
  return { ok: true, provider: providerName, field, value: field === "api_key" ? value.slice(0, 8) + "..." : value };
}

module.exports = {
  CONFIG_DIR,
  CONFIG_FILE,
  load,
  save,
  getProviderConfig,
  setProviderField,
  setDefaults,
  display,
  interactiveSet,
  DEFAULTS,
};
