/**
 * Agent packager — bundle agent config as standalone npm package
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const YAML = require("yaml");

const config = require("../core/config");
const guardrails = require("../core/guardrails");
const logger = require("../core/logger");
const utils = require("../utils");

function packageAgent(projectDir, options = {}) {
  const cfgDir = config.getConfigDir(projectDir);
  if (!cfgDir) {
    throw new Error("No config directory found. Run `aiyu-multi-agent init` first.");
  }

  const cfg = config.loadConfig(projectDir);
  if (!cfg) {
    throw new Error("No config.yaml found.");
  }

  const agentName = cfg.agent?.name || cfg.workspace?.name || "my-agent";
  const pkgName = options.name || agentName;
  const pkgVersion = options.version || cfg.workspace?.version || "1.0.0";

  // Create temp package directory
  const tmpDir = path.join(os.tmpdir(), `windsurf-publish-${agentName}-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  // Copy agent config files
  const dirsToCopy = ["agents", "skills", "workflows", "rules", "scripts", "tests"];
  dirsToCopy.forEach(dir => {
    const src = path.join(cfgDir, dir);
    if (fs.existsSync(src)) {
      utils.copyRecursive(src, path.join(tmpDir, ".agent", dir), { skipDirs: ["node_modules", ".git"] });
    }
  });

  // Copy config.yaml
  const configFile = path.join(cfgDir, "config.yaml");
  if (fs.existsSync(configFile)) {
    fs.copyFileSync(configFile, path.join(tmpDir, ".agent", "config.yaml"));
  }

  // Generate package.json for the published agent
  const agentSkills = [];
  const skillsDir = path.join(cfgDir, "skills");
  if (fs.existsSync(skillsDir)) {
    fs.readdirSync(skillsDir, { withFileTypes: true }).forEach(e => {
      if (e.isDirectory()) agentSkills.push(e.name);
    });
  }

  const agentTools = cfg.agent?.tools || [];
  const specVersion = cfg.workspace?.version || cfg.version || "2";

  const agentPkg = {
    name: pkgName,
    version: pkgVersion,
    description: cfg.agent?.description || cfg.workspace?.description || `AI Agent: ${agentName}`,
    bin: {
      [pkgName]: "./bin/run.js",
    },
    dependencies: {
      "aiyu-multi-agent": "^2.0.0",
    },
    keywords: ["aiyu-multi-agent", "ai-agent", "agent", agentName],
    author: options.author || "",
    license: options.license || "MIT",
    files: [".agent/", "bin/"],
    engines: { node: ">=16.0.0" },
    windsurf: {
      agent: true,
      specVersion,
      skills: agentSkills,
      tools: agentTools,
      provider: cfg.agent?.provider || "inherit",
    },
  };

  fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify(agentPkg, null, 2));

  // Generate bin/run.js — standalone entry point
  const runJs = `#!/usr/bin/env node
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const agentDir = path.resolve(__dirname, "..", ".agent");
const targetDir = process.cwd();
const targetAgent = path.join(targetDir, ".agent");

if (fs.existsSync(targetAgent)) {
  console.error("Error: .agent/ already exists in this project.");
  console.error("Run: npx ${pkgName} --force to overwrite.");
  process.exit(1);
}

console.log("Installing agent: ${agentName}...");
function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
copyRecursive(agentDir, targetAgent);
console.log("Done! Agent '${agentName}' installed.");
console.log("Open in Windsurf IDE: aiyu-multi-agent .");
`;

  fs.mkdirSync(path.join(tmpDir, "bin"), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, "bin", "run.js"), runJs);
  fs.chmodSync(path.join(tmpDir, "bin", "run.js"), 0o755);

  // Generate README
  const readme = `# ${pkgName}

> AI Agent: ${agentName}

## Install

\`\`\`bash
npx ${pkgName}
\`\`\`

## What it does

This installs the \`${agentName}\` agent configuration into your project's \`.agent/\` directory.

## Use in Windsurf IDE

\`\`\`bash
npx ${pkgName}
windsurf .
\`\`\`

## Configuration

See \`.agent/config.yaml\` after installation.
`;

  fs.writeFileSync(path.join(tmpDir, "README.md"), readme);

  logger.info(`Package created in: ${tmpDir}`);
  return { tmpDir, pkgName, pkgVersion, agentName };
}

module.exports = { packageAgent };
