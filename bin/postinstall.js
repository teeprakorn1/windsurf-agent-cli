/**
 * Post-install script for windsurf-agent-cli
 * - Shows welcome message
 * - Adds package-related entries to project .gitignore
 */

const fs = require("fs");
const path = require("path");

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
  const projectRoot = path.resolve(process.cwd(), "../../..");
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

updateGitignore();

console.log(`
╔══════════════════════════════════════════════╗
║   🚀 Windsurf Agent CLI installed!           ║
║                                              ║
║   Run: npx windsurf-agent-cli                ║
║   Help: npx windsurf-agent-cli help          ║
║                                              ║
║   79 Agents | 46 Skills | 78 Workflows      ║
╚══════════════════════════════════════════════╝
`);
