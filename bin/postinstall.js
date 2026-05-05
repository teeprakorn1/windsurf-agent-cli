/**
 * Post-install script for aiyu-multi-agent
 * - Shows welcome message
 * - Adds package-related entries to project .gitignore
 */

const fs = require("fs");
const path = require("path");
const { countFiles: countFilesUtil, countDirs, updateGitignore } = require("../lib/utils");

function findProjectRoot() {
  let dir = process.cwd();
  for (let i = 0; i < 20; i++) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    if (fs.existsSync(path.join(dir, "package.json")) && !fs.existsSync(path.join(dir, "node_modules"))) {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf-8"));
      if (pkg.name !== "aiyu-multi-agent") return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const projectRoot = findProjectRoot();
const pkgDir = path.resolve(__dirname, "..");

// Skip gitignore update if we're in our own package directory or global install
const isOwnPackage = projectRoot === pkgDir || fs.existsSync(path.join(pkgDir, "bin", "cli.js"));
if (!isOwnPackage) {
  try {
    updateGitignore(projectRoot);
  } catch { /* permission denied or other FS errors — skip silently */ }
}

const windsurfDir = path.join(pkgDir, ".windsurf");
const agentCount = countFilesUtil(path.join(windsurfDir, "agents"), ".md");
const skillCount = countDirs(path.join(windsurfDir, "skills"));
const workflowCount = countFilesUtil(path.join(windsurfDir, "workflows"), ".md");

console.log(`
╔══════════════════════════════════════════════╗
║   🚀 Aiyu MultiAgent installed!              ║
║                                              ║
║   Run: npx aiyu-multi-agent                   ║
║   Help: npx aiyu-multi-agent help             ║
║                                              ║
║   ${agentCount} Agents | ${skillCount} Skills | ${workflowCount} Workflows      ║
╚══════════════════════════════════════════════╝
`);
