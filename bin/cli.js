#!/usr/bin/env node

/**
 * Windsurf Agent CLI — Antigravity Kit
 * AI Agent Framework for Windsurf IDE
 */

const { execSync } = require("child_process");
const http = require("http");
const https = require("https");
const path = require("path");
const fs = require("fs");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const WINDSURF_DIR = path.join(PROJECT_ROOT, ".windsurf");
const PKG = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf-8"));
const CURRENT_VERSION = PKG.version;

function runCommand(cmd, cwd = PROJECT_ROOT) {
  try {
    const result = execSync(cmd, { cwd, encoding: "utf-8", stdio: "pipe" });
    return result.trim();
  } catch (error) {
    console.error(`Error running: ${cmd}`);
    console.error(error.message);
    process.exit(1);
  }
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client.get(url, { timeout: 5000 }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on("error", reject).on("timeout", () => { reject(new Error("timeout")); });
  });
}

async function getLatestVersion() {
  try {
    const data = await fetchJSON("https://registry.npmjs.org/windsurf-agent-cli/latest");
    return data.version || null;
  } catch { return null; }
}

function getInstalledVersion() {
  const targetDir = process.cwd();
  const versionFile = path.join(targetDir, ".windsurf", ".version");
  try { return fs.readFileSync(versionFile, "utf-8").trim(); }
  catch { return null; }
}

function saveInstalledVersion() {
  const targetDir = process.cwd();
  const versionFile = path.join(targetDir, ".windsurf", ".version");
  fs.writeFileSync(versionFile, CURRENT_VERSION, "utf-8");
}

function showBanner() {
  console.log(`
  Windsurf Agent CLI — Antigravity Kit v${CURRENT_VERSION}
  79 Agents | 46 Skills | 78 Workflows
`);
}

function showStatus() {
  console.log("📊 Project Status:\n");

  const agentsDir = path.join(WINDSURF_DIR, "agents");
  const skillsDir = path.join(WINDSURF_DIR, "skills");
  const workflowsDir = path.join(WINDSURF_DIR, "workflows");
  const scriptsDir = path.join(WINDSURF_DIR, "scripts");
  const rulesDir = path.join(WINDSURF_DIR, "rules");

  const countFiles = (dir) => {
    if (!fs.existsSync(dir)) return 0;
    return fs.readdirSync(dir).filter(f => f.endsWith(".md")).length;
  };

  const countDirs = (dir) => {
    if (!fs.existsSync(dir)) return 0;
    return fs.readdirSync(dir).filter(f => 
      fs.statSync(path.join(dir, f)).isDirectory()
    ).length;
  };

  console.log(`  Agents:    ${countFiles(agentsDir)}`);
  console.log(`  Skills:    ${countDirs(skillsDir)}`);
  console.log(`  Workflows: ${countFiles(workflowsDir)}`);
  console.log(`  Scripts:   ${fs.existsSync(scriptsDir) ? fs.readdirSync(scriptsDir).filter(f => f.endsWith(".py")).length : 0}`);
  console.log(`  Rules:     ${countFiles(rulesDir)}`);
  console.log("");
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function updateGitignore() {
  const targetDir = process.cwd();
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

function initProject() {
  const targetDir = process.cwd();
  const targetWindsurf = path.join(targetDir, ".windsurf");

  if (fs.existsSync(targetWindsurf)) {
    console.log(".windsurf/ already exists. Run `npx windsurf-agent-cli update` instead.\n");
    return;
  }

  console.log("Copying .windsurf/ to project...\n");
  copyRecursive(WINDSURF_DIR, targetWindsurf);
  saveInstalledVersion();
  updateGitignore();

  console.log("\nDone! .windsurf/ v" + CURRENT_VERSION + " installed.\n");
  console.log("Next steps:");
  console.log("  1. Open in Windsurf IDE: windsurf .");
  console.log("  2. Use slash commands (e.g., /backend, /security)");
  console.log("");
}

async function updateProject() {
  const targetDir = process.cwd();
  const targetWindsurf = path.join(targetDir, ".windsurf");

  if (!fs.existsSync(targetWindsurf)) {
    console.log(".windsurf/ not found. Run `npx windsurf-agent-cli init` first.\n");
    return;
  }

  const installed = getInstalledVersion();
  console.log("Installed version: " + (installed || "unknown"));
  console.log("Package version:   " + CURRENT_VERSION);

  if (installed === CURRENT_VERSION) {
    console.log("\nAlready up to date! v" + CURRENT_VERSION + "\n");
    return;
  }

  // Check npm registry for newer
  console.log("\nChecking npm for latest version...");
  const latest = await getLatestVersion();
  if (latest && latest !== CURRENT_VERSION) {
    console.log("Newer version available on npm: v" + latest);
    console.log("Run: npx windsurf-agent-cli@latest update\n");
    return;
  }

  console.log("\nUpdating .windsurf/ from v" + (installed || "?") + " to v" + CURRENT_VERSION + "...");
  copyRecursive(WINDSURF_DIR, targetWindsurf);
  saveInstalledVersion();
  updateGitignore();
  console.log("\nUpdated to v" + CURRENT_VERSION + "!\n");
}

async function showVersion() {
  console.log("windsurf-agent-cli v" + CURRENT_VERSION);
  const installed = getInstalledVersion();
  if (installed) console.log("Project .windsurf/ version: v" + installed);
  console.log("\nChecking npm for latest...");
  const latest = await getLatestVersion();
  if (latest) {
    if (latest === CURRENT_VERSION) {
      console.log("You are on the latest version: v" + latest);
    } else {
      console.log("Latest on npm: v" + latest);
      console.log("Update with: npx windsurf-agent-cli@latest update");
    }
  } else {
    console.log("Could not reach npm registry.");
  }
  console.log("");
}

function runChecklist(url) {
  const cmd = url 
    ? `python3 .windsurf/scripts/checklist.py . --url ${url}`
    : `python3 .windsurf/scripts/checklist.py .`;
  console.log("Running Master Checklist...\n");
  runCommand(cmd);
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  match[1].split("\n").forEach(line => {
    const idx = line.indexOf(":");
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (val.startsWith("[") && val.endsWith("]")) {
      val = val.slice(1, -1).split(",").map(v => v.trim().replace(/["']/g, ""));
    }
    fm[key] = val;
  });
  return fm;
}

function loadAllRules() {
  const rulesDir = path.join(WINDSURF_DIR, "rules");
  if (!fs.existsSync(rulesDir)) return [];
  return fs.readdirSync(rulesDir)
    .filter(f => f.endsWith(".md"))
    .map(f => {
      const content = fs.readFileSync(path.join(rulesDir, f), "utf-8");
      const fm = parseFrontmatter(content);
      const keywords = Array.isArray(fm.keywords) ? fm.keywords : [];
      return { file: f, name: f.replace(".md", ""), keywords, trigger: fm.trigger || "" };
    });
}

function findMatchingRules(agentDesc, agentSkills) {
  const rules = loadAllRules();
  const text = (agentDesc + " " + agentSkills).toLowerCase();
  return rules.filter(r => r.keywords.some(k => text.includes(k.toLowerCase())));
}

function showAgentInfo(agentName) {
  const agentsDir = path.join(WINDSURF_DIR, "agents");
  const filePath = path.join(agentsDir, `${agentName}.md`);

  if (!fs.existsSync(filePath)) {
    // Try partial match
    const files = fs.readdirSync(agentsDir).filter(f => f.endsWith(".md"));
    const match = files.find(f => f.replace(".md", "").includes(agentName));
    if (match) {
      return showAgentInfo(match.replace(".md", ""));
    }
    console.log(`Agent not found: ${agentName}\n`);
    console.log("Available agents:");
    files.sort().forEach(f => console.log(`  ${f.replace(".md", "")}`));
    console.log("");
    return;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const fm = parseFrontmatter(content);
  const skills = Array.isArray(fm.skills) ? fm.skills : (fm.skills ? fm.skills.split(",").map(s => s.trim()) : []);
  const tools = Array.isArray(fm.tools) ? fm.tools : (fm.tools ? fm.tools.split(",").map(t => t.trim()) : []);
  const hasSubAgents = tools.includes("Agent");
  const matchingRules = findMatchingRules(fm.description || "", fm.skills || "");

  console.log(`Agent: ${fm.name || agentName}\n`);
  console.log(`  Description: ${fm.description || 'N/A'}\n`);
  console.log(`  Tools:       ${tools.join(', ')}`);
  console.log(`  Skills:      ${skills.join(', ')}`);
  console.log(`  Sub-agents:  ${hasSubAgents ? 'Yes (can spawn other agents)' : 'No'}`);
  console.log(`  Rules:       ${matchingRules.length > 0 ? matchingRules.map(r => r.name).join(', ') : 'None matched'}`);

  // Show skill details
  if (skills.length > 0) {
    console.log(`\n  Skill Details:`);
    skills.forEach(skill => {
      const skillPath = path.join(WINDSURF_DIR, "skills", skill, "SKILL.md");
      if (fs.existsSync(skillPath)) {
        const sc = fs.readFileSync(skillPath, "utf-8");
        const sfm = parseFrontmatter(sc);
        console.log(`     ${skill.padEnd(25)} ${sfm.description || 'Loaded'}`);
      } else {
        console.log(`     ${skill.padEnd(25)} (built-in)`);
      }
    });
  }

  // Show rule details
  if (matchingRules.length > 0) {
    console.log(`\n  Matched Rules:`);
    matchingRules.forEach(r => {
      console.log(`     ${r.name.padEnd(25)} keywords: ${r.keywords.slice(0, 5).join(', ')}${r.keywords.length > 5 ? '...' : ''}`);
    });
  }

  // Show which workflow activates this agent
  const workflowsDir = path.join(WINDSURF_DIR, "workflows");
  if (fs.existsSync(workflowsDir)) {
    const activatingWorkflows = fs.readdirSync(workflowsDir)
      .filter(f => f.endsWith(".md"))
      .filter(f => {
        const wc = fs.readFileSync(path.join(workflowsDir, f), "utf-8");
        return wc.includes(agentName);
      });
    if (activatingWorkflows.length > 0) {
      console.log(`\n  Activated by: ${activatingWorkflows.map(f => '/' + f.replace('.md', '')).join(', ')}`);
    }
  }

  console.log("");
}

function listCommands() {
  console.log("📋 Available Commands:\n");

  const workflowsDir = path.join(WINDSURF_DIR, "workflows");
  if (!fs.existsSync(workflowsDir)) {
    console.log("  No workflows found.");
    return;
  }

  const files = fs.readdirSync(workflowsDir).filter(f => f.endsWith(".md")).sort();
  files.forEach(f => {
    const name = f.replace(".md", "");
    const filePath = path.join(workflowsDir, f);
    const content = fs.readFileSync(filePath, "utf-8");
    const descMatch = content.match(/description:\s*(.+)/);
    const desc = descMatch ? descMatch[1].trim() : "No description";
    console.log(`  /${name.padEnd(25)} ${desc}`);
  });
  console.log("");
}

// CLI
const args = process.argv.slice(2);
const command = args[0];

showBanner();

(async () => {
switch (command) {
  case "version":
  case "-v":
  case "--version":
    await showVersion();
    break;
  case "info":
    if (!args[1]) {
      console.log("Usage: npx windsurf-agent-cli info <agent-name>\n");
      console.log("Example:");
      console.log("  npx windsurf-agent-cli info frontend-specialist");
      console.log("  npx windsurf-agent-cli info orchestrator");
      console.log("  npx windsurf-agent-cli info security");
      console.log("");
    } else {
      showAgentInfo(args[1]);
    }
    break;
  case "init":
    initProject();
    break;
  case "update":
    await updateProject();
    break;
  case "status":
    showStatus();
    break;
  case "checklist":
    runChecklist(args[1]);
    break;
  case "list":
    listCommands();
    break;
  case "help":
  case "--help":
  case "-h":
    console.log(`Usage: npx windsurf-agent-cli <command>

Commands:
  init                Copy .windsurf/ config to current project (first-time setup)
  update              Update .windsurf/ config (checks npm for newer version)
  version             Show current version + check for updates
  info <agent>        Show agent details: skills, sub-agents, rules, workflow
  status              Show project statistics (agents, skills, workflows, etc.)
  list                List all available slash commands
  checklist           Run master checklist for quality verification
  checklist --url <U> Run checklist with URL (includes performance + E2E)
  help                Show this help message

Examples:
  npx windsurf-agent-cli init                        # First-time setup
  npx windsurf-agent-cli update                      # Update to latest config
  npx windsurf-agent-cli version                     # Check current + latest version
  npx windsurf-agent-cli info frontend-specialist    # Show agent details
  npx windsurf-agent-cli status
  npx windsurf-agent-cli list

How It Works:
  After installing, .windsurf/ config is loaded by Windsurf IDE.
  Use slash commands (e.g., /backend, /security) in Windsurf chat
  or let the system auto-route to the right agent.

  Orchestration levels:
    /junior-orchestrate   2-3 agents  Simple tasks
    /senior-orchestrate   4-6 agents  Complex features
    /elite-orchestrate    7+ agents   Mission-critical

Documentation:
  https://github.com/teeprakorn1/windsurf-agent-cli#readme
`);
    break;
  default:
    showStatus();
    listCommands();
    console.log("Run `npx windsurf-agent-cli help` for more commands.\n");
    break;
}
})();
