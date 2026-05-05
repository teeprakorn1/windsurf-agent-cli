/**
 * MCP Tool: list_agents — Discover available agents in the project
 */

const path = require("path");
const fs = require("fs");
const config = require("../../core/config");
const { parseFrontmatter } = require("../../utils");

function listAgents(projectDir, verbose = false) {
  const cfgDir = config.getConfigDir(projectDir);
  if (!cfgDir) {
    return { agents: [], default: null, error: "No config directory found. Run `aiyu-multi-agent init` first." };
  }

  const agentsDir = path.join(cfgDir, "agents");
  if (!fs.existsSync(agentsDir)) {
    return { agents: [], default: null };
  }

  const files = fs.readdirSync(agentsDir).filter(f => f.endsWith(".md"));
  const agents = [];

  for (const file of files) {
    const name = file.replace(".md", "");
    const filePath = path.join(agentsDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const fm = parseFrontmatter(content);

    const agent = {
      name: (fm && fm.name) || name,
      description: (fm && fm.description) || "",
    };

    if (verbose && fm) {
      agent.tools = Array.isArray(fm.tools) ? fm.tools : (fm.tools ? fm.tools.split(",").map(t => t.trim()) : []);
      agent.skills = Array.isArray(fm.skills) ? fm.skills : (fm.skills ? fm.skills.split(",").map(s => s.trim()) : []);
      agent.provider = fm.provider || "inherit";
      agent.model = fm.model || "inherit";
    }

    agents.push(agent);
  }

  const defaultAgent = files.length > 0 ? files[0].replace(".md", "") : null;

  return { agents, default: defaultAgent };
}

module.exports = { listAgents };
