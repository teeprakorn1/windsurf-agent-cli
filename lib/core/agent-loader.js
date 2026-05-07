/**
 * Agent Loader — Load agent specs and skill instructions from config directory
 *
 * Separated from agent-runtime.js for maintainability.
 */

const fs = require("fs");
const path = require("path");

const config = require("./config");
const { parseFrontmatter, isValidAgentName } = require("../utils");

const DEFAULT_MAX_STEPS = 10;
const MAX_ALLOWED_STEPS = 50;
const MAX_SKILL_FILE_SIZE = 100 * 1024; // 100KB — prevent OOM from oversized skill files
const MAX_AGENT_FILE_SIZE = 200 * 1024; // 200KB — prevent OOM from oversized agent files

function loadAgentSpec(projectDir, agentName) {
  if (!isValidAgentName(agentName)) {
    throw new Error(`Invalid agent name: "${agentName}" — must not contain / \\ : * ? " < > |`);
  }

  const cfgDir = config.getConfigDir(projectDir);
  if (!cfgDir) throw new Error("No config directory found. Run `aiyu-multi-agent init` first.");

  // Enforce runtime spec version
  const specConfig = config.loadConfig(projectDir);
  if (specConfig) {
    const specVersion = specConfig.workspace?.version || specConfig.version;
    if (specVersion && parseInt(specVersion, 10) > 2) {
      throw new Error(`Unsupported runtime spec version: v${specVersion}. This CLI supports v1-v2. Please update aiyu-multi-agent.`);
    }
  }

  const agentPath = path.join(cfgDir, "agents", `${agentName}.md`);
  if (!fs.existsSync(agentPath)) {
    throw new Error(`Agent not found: ${agentName}`);
  }

  // Enforce file size limit to prevent OOM from oversized agent files
  const agentStat = fs.statSync(agentPath);
  if (agentStat.size > MAX_AGENT_FILE_SIZE) {
    throw new Error(`Agent file too large (${Math.round(agentStat.size / 1024)}KB, max ${Math.round(MAX_AGENT_FILE_SIZE / 1024)}KB): ${agentName}`);
  }

  const content = fs.readFileSync(agentPath, "utf-8");
  const fm = parseFrontmatter(content);
  if (!fm || Object.keys(fm).length === 0) throw new Error(`Agent ${agentName} missing frontmatter`);

  const instructions = content.replace(/^---\r?\n[\s\S]*?\r?\n---/, "").trim();

  return {
    name: fm.name || agentName,
    description: fm.description || "",
    tools: Array.isArray(fm.tools) ? fm.tools : (fm.tools ? fm.tools.split(",").map(t => t.trim()) : []),
    skills: Array.isArray(fm.skills) ? fm.skills : (fm.skills ? fm.skills.split(",").map(s => s.trim()) : []),
    provider: fm.provider || "inherit",
    model: fm.model || "inherit",
    memory: fm.memory || "none",
    guardrails: fm.guardrails !== false,
    maxSteps: Math.max(1, Math.min(parseInt(fm.max_steps, 10) || DEFAULT_MAX_STEPS, MAX_ALLOWED_STEPS)),
    loop: fm.loop || "react",
    outputFormat: fm.output_format || fm.outputFormat || "text",
    deterministic: fm.deterministic === true || fm.deterministic === "true",
    instructions,
  };
}

function loadSkillInstructions(projectDir, skillNames) {
  const cfgDir = config.getConfigDir(projectDir);
  if (!cfgDir) return {};

  const instructions = {};
  const skillDirs = [
    path.join(cfgDir, "skills", "installed"),
    path.join(cfgDir, "skills", "core"),
    path.join(cfgDir, "skills"),
  ];

  for (const skillName of skillNames) {
    for (const dir of skillDirs) {
      const skillPath = path.join(dir, skillName, "SKILL.md");
      if (fs.existsSync(skillPath)) {
        const stat = fs.statSync(skillPath);
        if (stat.size > MAX_SKILL_FILE_SIZE) {
          // Read only the first MAX_SKILL_FILE_SIZE bytes to prevent OOM
          const buf = Buffer.alloc(MAX_SKILL_FILE_SIZE);
          const fd = fs.openSync(skillPath, "r");
          fs.readSync(fd, buf, 0, MAX_SKILL_FILE_SIZE, 0);
          fs.closeSync(fd);
          instructions[skillName] = buf.toString("utf-8") + "\n...[truncated — skill file too large]";
        } else {
          instructions[skillName] = fs.readFileSync(skillPath, "utf-8");
        }
        break;
      }
    }
  }

  return instructions;
}

function listAvailableAgents(projectDir) {
  const cfgDir = config.getConfigDir(projectDir);
  if (!cfgDir) return [];
  const agentsDir = path.join(cfgDir, "agents");
  if (!fs.existsSync(agentsDir)) return [];
  const agents = [];
  for (const file of fs.readdirSync(agentsDir).sort()) {
    if (!file.endsWith(".md")) continue;
    const name = file.slice(0, -3);
    if (!isValidAgentName(name)) continue;
    const filePath = path.join(agentsDir, file);
    try {
      const stat = fs.statSync(filePath);
      if (stat.size > MAX_AGENT_FILE_SIZE) continue;
      const content = fs.readFileSync(filePath, "utf-8");
      const fm = parseFrontmatter(content);
      agents.push({
        name,
        description: fm.description || "",
        provider: fm.provider || "inherit",
        model: fm.model || "inherit",
      });
    } catch { /* skip malformed agents */ }
  }
  return agents;
}

module.exports = {
  loadAgentSpec,
  loadSkillInstructions,
  listAvailableAgents,
  DEFAULT_MAX_STEPS,
  MAX_ALLOWED_STEPS,
  MAX_AGENT_FILE_SIZE,
};
