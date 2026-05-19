/**
 * Config loader — .agent/ primary, .windsurf/ symlink
 */

const fs = require("fs");
const path = require("path");
const utils = require("../utils");
const YAML = require("yaml");
const logger = require("./logger");

const AGENT_DIR = ".agent";
const WINDSURF_DIR = ".windsurf";
const ROO_DIR = ".roo";

function getAgentDir(projectDir) {
  return path.join(projectDir, AGENT_DIR);
}

function getWindsurfDir(projectDir) {
  return path.join(projectDir, WINDSURF_DIR);
}

function getRooDir(projectDir) {
  return path.join(projectDir, ROO_DIR);
}

function isWindsurfProject(projectDir) {
  return fs.existsSync(path.join(projectDir, ".windsurfrules")) ||
         fs.existsSync(path.join(projectDir, WINDSURF_DIR));
}

function isRooProject(projectDir) {
  return fs.existsSync(path.join(projectDir, ".roomodes")) ||
         fs.existsSync(path.join(projectDir, ROO_DIR));
}

function configExists(projectDir) {
  return fs.existsSync(getAgentDir(projectDir)) ||
         fs.existsSync(getWindsurfDir(projectDir));
}

function getConfigDir(projectDir) {
  const agentDir = getAgentDir(projectDir);
  if (fs.existsSync(agentDir)) return agentDir;
  const windsurfDir = getWindsurfDir(projectDir);
  if (fs.existsSync(windsurfDir)) return windsurfDir;
  return null;
}

function loadConfig(projectDir) {
  const configDir = getConfigDir(projectDir);
  if (!configDir) return null;

  const configFile = path.join(configDir, "config.yaml");
  if (fs.existsSync(configFile)) {
    const content = fs.readFileSync(configFile, "utf-8");
    return YAML.parse(content);
  }

  const configJson = path.join(configDir, "config.json");
  if (fs.existsSync(configJson)) {
    try {
      return JSON.parse(fs.readFileSync(configJson, "utf-8"));
    } catch {
      console.warn(`Warning: config.json is malformed — ignoring`);
    }
  }

  return null;
}

function loadCliEngineConfig(projectDir) {
  const loaded = loadConfig(projectDir) || {};
  return loaded.cliEngines || {};
}

function initConfigDir(projectDir, options = {}) {
  const windsurfOnly = options.windsurfOnly;
  const agentOnly = options.agentOnly;
  const rooOnly = options.rooOnly;
  const agentDir = getAgentDir(projectDir);
  const windsurfDir = getWindsurfDir(projectDir);

  const primaryDir = windsurfOnly ? windsurfDir : agentDir;

  if (!fs.existsSync(primaryDir)) {
    fs.mkdirSync(primaryDir, { recursive: true });
  }

  const subdirs = ["agents", "skills", "skills/core", "skills/installed", "workflows", "rules", "tests", "scripts"];
  subdirs.forEach((sub) => {
    const dir = path.join(primaryDir, sub);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  if (windsurfOnly) {
    // .windsurf/ is primary, no .agent/ needed
  } else if (agentOnly) {
    // .agent/ is primary, no .windsurf/ symlink needed
  } else if (rooOnly) {
    // .agent/ is primary, Roo files (.roomodes, .roorules, .roo/) generated separately
  } else if (!fs.existsSync(windsurfDir)) {
    try {
      fs.symlinkSync(agentDir, windsurfDir, "junction");
    } catch {
      // Symlink failed — fallback to copy, but warn that directories will diverge
      logger.warn("Could not create .windsurf/ symlink — falling back to copy. Changes in .agent/ will NOT auto-reflect in .windsurf/");
      utils.copyRecursive(agentDir, windsurfDir);
    }
  }

  return primaryDir;
}

function saveVersion(projectDir, version) {
  const configDir = getConfigDir(projectDir);
  if (!configDir) return;
  const versionFile = path.join(configDir, ".version");
  const guardrails = require("./guardrails");
  guardrails.safeWrite(versionFile, version, "utf-8", projectDir);
}

function getVersion(projectDir) {
  const configDir = getConfigDir(projectDir);
  if (!configDir) return null;
  try {
    return fs.readFileSync(path.join(configDir, ".version"), "utf-8").trim();
  } catch {
    return null;
  }
}

module.exports = {
  getAgentDir,
  getWindsurfDir,
  getRooDir,
  isWindsurfProject,
  isRooProject,
  configExists,
  getConfigDir,
  loadConfig,
  loadCliEngineConfig,
  initConfigDir,
  saveVersion,
  getVersion,
  AGENT_DIR,
  WINDSURF_DIR,
  ROO_DIR,
};
