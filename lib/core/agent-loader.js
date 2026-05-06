/**
 * Agent Loader — Load agent specs and skill instructions from config directory
 *
 * Separated from agent-runtime.js for maintainability.
 */

const fs = require("fs");
const path = require("path");

const config = require("./config");
const { parseFrontmatter } = require("../utils");

const DEFAULT_MAX_STEPS = 10;
const MAX_ALLOWED_STEPS = 50;

function loadAgentSpec(projectDir, agentName) {
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
        instructions[skillName] = fs.readFileSync(skillPath, "utf-8");
        break;
      }
    }
  }

  return instructions;
}

module.exports = {
  loadAgentSpec,
  loadSkillInstructions,
  DEFAULT_MAX_STEPS,
  MAX_ALLOWED_STEPS,
};
