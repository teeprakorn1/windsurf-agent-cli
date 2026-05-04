/**
 * Config loader — .agent/ primary, .windsurf/ symlink
 */

const fs = require("fs");
const path = require("path");
const utils = require("../utils");
const YAML = require("yaml");

const AGENT_DIR = ".agent";
const WINDSURF_DIR = ".windsurf";

function getAgentDir(projectDir) {
  return path.join(projectDir, AGENT_DIR);
}

function getWindsurfDir(projectDir) {
  return path.join(projectDir, WINDSURF_DIR);
}

function isWindsurfProject(projectDir) {
  return fs.existsSync(path.join(projectDir, ".windsurfrules")) ||
         fs.existsSync(path.join(projectDir, WINDSURF_DIR));
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
    return JSON.parse(fs.readFileSync(configJson, "utf-8"));
  }

  return null;
}

function initConfigDir(projectDir, options = {}) {
  const windsurfOnly = options.windsurfOnly;
  const agentOnly = options.agentOnly;
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
  } else if (!fs.existsSync(windsurfDir)) {
    try {
      fs.symlinkSync(agentDir, windsurfDir, "junction");
    } catch {
      utils.copyRecursive(agentDir, windsurfDir);
    }
  }

  return primaryDir;
}

function saveVersion(projectDir, version) {
  const configDir = getConfigDir(projectDir);
  if (!configDir) return;
  const versionFile = path.join(configDir, ".version");
  fs.writeFileSync(versionFile, version, "utf-8");
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
  isWindsurfProject,
  configExists,
  getConfigDir,
  loadConfig,
  initConfigDir,
  saveVersion,
  getVersion,
  AGENT_DIR,
  WINDSURF_DIR,
};
