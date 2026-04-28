/**
 * Shared utilities for windsurf-agent-cli
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

function updateGitignore(targetDir) {
  const gitignorePath = path.join(targetDir, ".gitignore");
  const gitignoreEntries = ["# AG Kit", ".windsurf"];
  let content = "";
  try { content = fs.readFileSync(gitignorePath, "utf-8"); } catch {}
  if (!content.includes("AG Kit")) {
    const separator = content.endsWith("\n") ? "" : "\n";
    fs.writeFileSync(gitignorePath, content + separator + gitignoreEntries.join("\n") + "\n", "utf-8");
    console.log("  Updated .gitignore");
  }
}

module.exports = { countFiles, countDirs, updateGitignore };
