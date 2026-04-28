/**
 * Post-install script for windsurf-agent-cli
 * - Shows welcome message
 * - Adds package-related entries to project .gitignore
 */

const fs = require("fs");
const path = require("path");
const { countFiles: countFilesUtil, countDirs, updateGitignore } = require("../lib/utils");

const NEW_SECTION_ENTRIES = [
  "# AG Kit",
  ".windsurf",
];

const ALL_ENTRIES = [
  "# AG Kit",
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

function updateGitignore() {
  const projectRoot = findProjectRoot();
  const gitignorePath = findGitignore(projectRoot);

  if (!gitignorePath) return;

  let content = "";
  try {
    content = fs.readFileSync(gitignorePath, "utf-8");
  } catch {
    content = "";
  }

  const missing = ALL_ENTRIES.filter((entry) => !content.includes(entry));
  if (missing.length === 0) return;

  if (content.includes("AG Kit")) {
    const lines = content.split("\n");
    const agKitIndex = lines.findIndex((line) => line.trim() === "# AG Kit");
    if (agKitIndex !== -1) {
      const newEntries = missing.filter((e) => !e.startsWith("#"));
      lines.splice(agKitIndex + 1, 0, ...newEntries);
      fs.writeFileSync(gitignorePath, lines.join("\n"), "utf-8");
      return;
    }
  }

  const newMissing = NEW_SECTION_ENTRIES.filter((entry) => !content.includes(entry));
  if (newMissing.length === 0) return;

  const separator = content.endsWith("\n") ? "" : "\n";
  fs.writeFileSync(gitignorePath, content + separator + newMissing.join("\n") + "\n", "utf-8");
}

function findProjectRoot() {
  let dir = process.cwd();
  for (let i = 0; i < 20; i++) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    if (fs.existsSync(path.join(dir, "package.json")) && !fs.existsSync(path.join(dir, "node_modules"))) {
      // Likely project root if it has package.json but isn't inside node_modules
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf-8"));
      if (pkg.name !== "windsurf-agent-cli") return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

updateGitignore();

const pkgDir = path.resolve(__dirname, "..");
const windsurfDir = path.join(pkgDir, ".windsurf");
const agentCount = countFilesUtil(path.join(windsurfDir, "agents"), ".md");
const skillCount = countDirs(path.join(windsurfDir, "skills"));
const workflowCount = countFilesUtil(path.join(windsurfDir, "workflows"), ".md");

console.log(`
╔══════════════════════════════════════════════╗
║   🚀 Windsurf Agent CLI installed!           ║
║                                              ║
║   Run: npx windsurf-agent-cli                ║
║   Help: npx windsurf-agent-cli help          ║
║                                              ║
║   ${agentCount} Agents | ${skillCount} Skills | ${workflowCount} Workflows      ║
╚══════════════════════════════════════════════╝
`);
