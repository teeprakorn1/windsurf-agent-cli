/**
 * Shared utilities for aiyu-multi-agent
 */

const fs = require("fs");
const path = require("path");

function countFiles(dir, ext) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter(f => f.endsWith(ext)).length;
}

function countDirs(dir) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter(f => fs.statSync(path.join(dir, f)).isDirectory()).length;
}

const NEW_SECTION_ENTRIES = [
  "# Aiyu MultiAgent",
  ".windsurf",
];

const ALL_ENTRIES = [
  "# Aiyu MultiAgent",
  ".windsurf",
  ".agent",
];

function findGitignore(startDir) {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    const gitPath = path.join(dir, ".git");
    const gitignorePath = path.join(dir, ".gitignore");
    if (fs.existsSync(gitPath)) {
      return gitignorePath;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const fallback = path.join(startDir, ".gitignore");
  return fs.existsSync(fallback) ? fallback : null;
}

function updateGitignore(targetDir) {
  const gitignorePath = findGitignore(targetDir);

  if (!gitignorePath) return;

  let content = "";
  try {
    content = fs.readFileSync(gitignorePath, "utf-8");
  } catch {
    content = "";
  }

  const missing = ALL_ENTRIES.filter((entry) => !content.includes(entry));
  if (missing.length === 0) return;

  if (content.includes("Aiyu MultiAgent")) {
    const lines = content.split("\n");
    const agKitIndex = lines.findIndex((line) => line.trim() === "# Aiyu MultiAgent");
    if (agKitIndex !== -1) {
      const newEntries = missing.filter((e) => !e.startsWith("#"));
      lines.splice(agKitIndex + 1, 0, ...newEntries);
      fs.writeFileSync(gitignorePath, lines.join("\n"), "utf-8");
      console.log("  Updated .gitignore");
      return;
    }
  }

  const newMissing = NEW_SECTION_ENTRIES.filter((entry) => !content.includes(entry));
  if (newMissing.length === 0) return;

  const separator = content.endsWith("\n") ? "" : "\n";
  fs.writeFileSync(gitignorePath, content + separator + newMissing.join("\n") + "\n", "utf-8");
  console.log("  Updated .gitignore");
}

function parseFrontmatter(content) {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return {};
  const YAML = require("yaml");
  return YAML.parse(fmMatch[1]) || {};
}

function copyRecursive(src, dest, options = {}) {
  const { merge = false, dryRun = false, preserved = [], skipDirs = [] } = options;
  if (!fs.existsSync(src)) return preserved;
  if (!fs.existsSync(dest)) {
    if (!dryRun) fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (skipDirs.includes(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath, { merge, dryRun, preserved, skipDirs });
    } else {
      if (merge && fs.existsSync(destPath)) {
        if (!preserved.includes(path.relative(process.cwd(), destPath))) {
          preserved.push(path.relative(process.cwd(), destPath));
        }
        continue;
      }
      if (!dryRun) fs.copyFileSync(srcPath, destPath);
    }
  }
  return preserved;
}

function findDefaultAgent(projectDir) {
  const config = require("./core/config");
  const cfgDir = config.getConfigDir(projectDir);
  if (!cfgDir) return null;

  const agentsDir = path.join(cfgDir, "agents");
  if (!fs.existsSync(agentsDir)) return null;

  const files = fs.readdirSync(agentsDir).filter(f => f.endsWith(".md"));
  return files.length > 0 ? files[0].replace(".md", "") : null;
}

function isValidAgentName(name) {
  if (!name || !name.trim()) return false;
  return !/[\/\\:\*\?"<>\|]/.test(name);
}

module.exports = { countFiles, countDirs, updateGitignore, parseFrontmatter, copyRecursive, findDefaultAgent, isValidAgentName };
