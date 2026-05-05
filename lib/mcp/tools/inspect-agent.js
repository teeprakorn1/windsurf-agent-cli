/**
 * MCP Tool: inspect_agent — Get detailed metadata about a specific agent
 */

const path = require("path");
const fs = require("fs");
const config = require("../../core/config");
const { parseFrontmatter } = require("../../utils");

function inspectAgent(projectDir, agentName) {
  const cfgDir = config.getConfigDir(projectDir);
  if (!cfgDir) {
    return { error: "No config directory found. Run `aiyu-multi-agent init` first." };
  }

  const agentPath = path.join(cfgDir, "agents", `${agentName}.md`);
  if (!fs.existsSync(agentPath)) {
    return { error: `Agent not found: ${agentName}` };
  }

  const content = fs.readFileSync(agentPath, "utf-8");
  const fm = parseFrontmatter(content);

  if (!fm || Object.keys(fm).length === 0) {
    return { error: `Agent ${agentName} missing frontmatter` };
  }

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
    maxSteps: Math.min(parseInt(fm.max_steps, 10) || 10, 50),
    loop: fm.loop || "react",
    outputFormat: fm.output_format || fm.outputFormat || "text",
    instructions,
  };
}

module.exports = { inspectAgent };
