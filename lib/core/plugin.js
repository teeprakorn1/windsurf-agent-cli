/**
 * Plugin lifecycle manager — install, validate, remove skills from npm
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const YAML = require("yaml");
const chalk = require("chalk");
const utils = require("../utils");

const config = require("./config");
const guardrails = require("./guardrails");
const logger = require("./logger");

const SKILL_PREFIX = "aiyu-multi-agent-skill-";
const INSTALLED_DIR = "skills/installed";

function getInstalledDir(projectDir) {
  const cfgDir = config.getConfigDir(projectDir);
  if (!cfgDir) return null;
  return path.join(cfgDir, INSTALLED_DIR);
}

function getSkillDir(projectDir, skillName) {
  const installedDir = getInstalledDir(projectDir);
  if (!installedDir) return null;
  return path.join(installedDir, skillName);
}

function listInstalled(projectDir) {
  const installedDir = getInstalledDir(projectDir);
  if (!installedDir || !fs.existsSync(installedDir)) return [];
  return fs.readdirSync(installedDir)
    .filter(f => fs.statSync(path.join(installedDir, f)).isDirectory());
}

function listCore(projectDir) {
  const cfgDir = config.getConfigDir(projectDir);
  if (!cfgDir) return [];
  const coreDir = path.join(cfgDir, "skills/core");
  if (!fs.existsSync(coreDir)) return [];
  return fs.readdirSync(coreDir)
    .filter(f => fs.statSync(path.join(coreDir, f)).isDirectory());
}

function isInstalled(projectDir, skillName) {
  const skillDir = getSkillDir(projectDir, skillName);
  return skillDir && fs.existsSync(skillDir);
}

function validateSkillPackage(pkgDir) {
  const errors = [];

  const skillMd = path.join(pkgDir, "SKILL.md");
  if (!fs.existsSync(skillMd)) {
    errors.push("Missing SKILL.md");
  } else {
    const content = fs.readFileSync(skillMd, "utf-8");
    if (!content.match(/^---\r?\n[\s\S]*?\r?\n---/)) {
      errors.push("SKILL.md missing frontmatter");
    }
  }

  const configJson = path.join(pkgDir, "config.json");
  if (fs.existsSync(configJson)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configJson, "utf-8"));
      if (!cfg.name) errors.push("config.json missing 'name'");
      if (!cfg.version) errors.push("config.json missing 'version'");
    } catch {
      errors.push("config.json is invalid JSON");
    }
  }

  return errors;
}

function getPermissions(pkgDir) {
  const configJson = path.join(pkgDir, "config.json");
  if (!fs.existsSync(configJson)) return {};

  try {
    const cfg = JSON.parse(fs.readFileSync(configJson, "utf-8"));
    return cfg.permissions || {};
  } catch {
    return {};
  }
}

const PERMISSION_LABELS = {
  fs: "File system access (read/write files)",
  network: "Network access (HTTP requests)",
  exec: "Shell command execution",
  env: "Environment variable access",
};

async function checkPermissions(pkgDir, options = {}) {
  const permissions = getPermissions(pkgDir);
  const requested = Object.entries(permissions).filter(([_, v]) => v === true);

  if (requested.length === 0) return { granted: true, permissions: {} };

  if (options.autoApprove) {
    return { granted: true, permissions: Object.fromEntries(requested) };
  }

  // Interactive prompt
  console.log(chalk.yellow(`\n  ⚠️ Skill requires the following permissions:\n`));
  requested.forEach(([key]) => {
    console.log(`    ${chalk.red("•")} ${PERMISSION_LABELS[key] || key}`);
  });

  const inquirer = (await import("inquirer")).default;
  const { approved } = await inquirer.prompt([
    {
      type: "confirm",
      name: "approved",
      message: "Allow these permissions?",
      default: false,
    },
  ]);

  if (!approved) {
    return { granted: false, permissions: {} };
  }

  return { granted: true, permissions: Object.fromEntries(requested) };
}

function resolvePackageName(name) {
  if (name.startsWith("@") || name.includes("/")) return name;
  if (name.startsWith(SKILL_PREFIX)) return name;
  return `${SKILL_PREFIX}${name}`;
}

function install(projectDir, name) {
  const packageName = resolvePackageName(name);
  const skillName = packageName.replace(SKILL_PREFIX, "").replace(/^@[^/]+\//, "");

  logger.info(`Installing skill: ${skillName} (${packageName})`);

  // npm install to temp dir
  const tmpDir = path.join(require("os").tmpdir(), `aiyu-multi-agent-skill-install-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    execFileSync("npm", ["install", packageName, "--prefix", tmpDir, "--no-save", "--no-package-lock"], {
      cwd: tmpDir,
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 60000,
    });
  } catch (err) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw new Error(`npm install failed for ${packageName}: ${err.message}`);
  }

  // Find installed package dir
  const pkgDir = path.join(tmpDir, "node_modules", packageName);
  if (!fs.existsSync(pkgDir)) {
    // Try scoped package
    const altDir = path.join(tmpDir, "node_modules", name);
    if (!fs.existsSync(altDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      throw new Error(`Package ${packageName} not found after install`);
    }
  }

  const sourceDir = fs.existsSync(path.join(tmpDir, "node_modules", packageName))
    ? path.join(tmpDir, "node_modules", packageName)
    : path.join(tmpDir, "node_modules", name);

  // Validate
  const errors = validateSkillPackage(sourceDir);
  if (errors.length > 0) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw new Error(`Invalid skill package: ${errors.join(", ")}`);
  }

  // Copy to installed skills
  const installedDir = getInstalledDir(projectDir);
  if (!installedDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw new Error("No config directory found. Run `aiyu-multi-agent init` first.");
  }

  const destDir = path.join(installedDir, skillName);
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }

  utils.copyRecursive(sourceDir, destDir, { skipDirs: ["node_modules", ".git"] });
  fs.rmSync(tmpDir, { recursive: true, force: true });

  // Update config.yaml to register the skill
  registerSkill(projectDir, skillName);

  logger.success(`Skill "${skillName}" installed successfully`);
  return skillName;
}

function remove(projectDir, name) {
  const skillName = name.replace(SKILL_PREFIX, "");
  const skillDir = getSkillDir(projectDir, skillName);

  if (!skillDir || !fs.existsSync(skillDir)) {
    throw new Error(`Skill "${skillName}" is not installed`);
  }

  fs.rmSync(skillDir, { recursive: true, force: true });
  unregisterSkill(projectDir, skillName);

  logger.success(`Skill "${skillName}" removed`);
  return skillName;
}

function registerSkill(projectDir, skillName) {
  const cfgDir = config.getConfigDir(projectDir);
  if (!cfgDir) return;

  const configFile = path.join(cfgDir, "config.yaml");
  if (!fs.existsSync(configFile)) return;

  const content = fs.readFileSync(configFile, "utf-8");
  const cfg = YAML.parse(content);

  if (!cfg.skills) cfg.skills = { installed: [] };
  if (!cfg.skills.installed) cfg.skills.installed = [];

  if (!cfg.skills.installed.includes(skillName)) {
    cfg.skills.installed.push(skillName);
    fs.writeFileSync(configFile, YAML.stringify(cfg), "utf-8");
  }
}

function unregisterSkill(projectDir, skillName) {
  const cfgDir = config.getConfigDir(projectDir);
  if (!cfgDir) return;

  const configFile = path.join(cfgDir, "config.yaml");
  if (!fs.existsSync(configFile)) return;

  const content = fs.readFileSync(configFile, "utf-8");
  const cfg = YAML.parse(content);

  if (cfg.skills?.installed) {
    cfg.skills.installed = cfg.skills.installed.filter(s => s !== skillName);
    fs.writeFileSync(configFile, YAML.stringify(cfg), "utf-8");
  }
}

module.exports = {
  install,
  remove,
  listInstalled,
  listCore,
  isInstalled,
  validateSkillPackage,
  getPermissions,
  checkPermissions,
  resolvePackageName,
  PERMISSION_LABELS,
  SKILL_PREFIX,
};
