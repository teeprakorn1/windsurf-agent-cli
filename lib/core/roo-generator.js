/**
 * Roo Generator — generates .roomodes and .roorules for Roo Code (VS Code extension)
 * Converts aiyu agent definitions → Roo custom modes
 */

const fs = require("fs");
const path = require("path");
const guardrails = require("./guardrails");
const utils = require("../utils");

// Map agent filename → Roo group
const GROUP_MAP = {
  "security": "security",
  "ethical-hacker": "security",
  "penetration-tester": "security",
  "threat-modeler": "security",
  "secure-coder": "security",
  "bypass-specialist": "security",
  "incident-responder": "security",
  "kali-copilot": "security",
  "compliance-officer": "security",

  "frontend-specialist": "frontend",
  "react-developer": "frontend",
  "nextjs-developer": "frontend",
  "angular-developer": "frontend",
  "sveltekit-developer": "frontend",
  "html5-css-developer": "frontend",
  "mobile-developer": "frontend",
  "uiux-designer": "frontend",
  "visual-designer": "frontend",
  "design-system-architect": "frontend",

  "backend-specialist": "backend",
  "nodejs-nest-developer": "backend",
  "express-developer": "backend",
  "python-api-developer": "backend",
  "go-developer": "backend",
  "php-developer": "backend",
  "database-architect": "backend",
  "data-layer-developer": "backend",
  "business-logic-developer": "backend",

  "devops-engineer": "devops",
  "docker-developer": "devops",
  "platform-engineer": "devops",
  "sre": "devops",
  "cloud-architect": "devops",
  "linux-administrator": "devops",
  "windows-administrator": "devops",
  "network-engineer": "devops",
  "load-balancer-specialist": "devops",

  "orchestrator": "architect",
  "elite-orchestrator": "architect",
  "senior-orchestrator": "architect",
  "junior-orchestrator": "architect",
  "staff-engineer": "architect",
  "elite-tech-leader": "architect",
  "project-planner": "architect",
  "protocol-architect": "architect",
};

function inferGroup(slug) {
  for (const [key, group] of Object.entries(GROUP_MAP)) {
    if (slug.includes(key)) return group;
  }
  return "edit";
}

/**
 * Parse all agent .md files from agentsDir → array of Roo mode objects
 */
function buildModes(agentsDir) {
  if (!fs.existsSync(agentsDir)) return [];

  const modes = [];

  // Built-in Roo modes to always include at top
  modes.push(
    {
      slug: "code",
      name: "💻 Code",
      roleDefinition: "You are Roo, a highly skilled software engineer with extensive knowledge in many programming languages, frameworks, design patterns, and best practices.",
      groups: ["read", "edit", "browser", "command", "mcp"],
    },
    {
      slug: "architect",
      name: "🏛️ Architect",
      roleDefinition: "You are Roo, an experienced technical leader who is inquisitive and an excellent planner. Your role is to design systems, make architectural decisions, and create implementation plans.",
      groups: ["read", ["edit", { fileRegex: "\\.md$", description: "Markdown files only" }], "browser", "mcp"],
    },
    {
      slug: "ask",
      name: "❓ Ask",
      roleDefinition: "You are Roo, a knowledgeable technical assistant. Answer questions, explain concepts, analyze code, and provide guidance without making changes.",
      groups: ["read", "browser", "mcp"],
    },
    {
      slug: "debug",
      name: "🐛 Debug",
      roleDefinition: "You are Roo, an expert debugger with deep knowledge of runtime behavior, error analysis, and systematic problem-solving using the scientific method.",
      groups: ["read", "edit", "browser", "command", "mcp"],
    }
  );

  // Convert aiyu agents → Roo modes
  const files = fs.readdirSync(agentsDir)
    .filter(f => f.endsWith(".md"))
    .sort();

  for (const file of files) {
    const slug = file.replace(".md", "");
    // Skip internal/meta agents
    if (["cli"].includes(slug)) continue;

    const content = fs.readFileSync(path.join(agentsDir, file), "utf-8");
    const fm = utils.parseFrontmatter(content);

    if (!fm.name && !fm.description) continue;

    const agentName = fm.name || slug;
    const description = fm.description || `${agentName} agent`;
    const skills = Array.isArray(fm.skills)
      ? fm.skills
      : (fm.skills ? fm.skills.split(",").map(s => s.trim()) : []);

    // Build roleDefinition from frontmatter
    const roleDefinition = [
      `You are Roo acting as the ${agentName} specialist agent.`,
      description,
      skills.length > 0 ? `Core skills: ${skills.join(", ")}.` : "",
      "Follow the Aiyu Agent Kit rules from GEMINI.md. Apply clean-code principles.",
    ].filter(Boolean).join(" ");

    const group = inferGroup(slug);

    // Determine allowed groups based on agent tools
    const tools = Array.isArray(fm.tools)
      ? fm.tools
      : (fm.tools ? fm.tools.split(",").map(t => t.trim()) : []);

    const allowedGroups = ["read"];
    if (tools.some(t => ["Edit", "Write", "fs.edit", "fs.write"].includes(t))) {
      allowedGroups.push("edit");
    }
    if (tools.some(t => ["Bash", "shell.exec"].includes(t))) {
      allowedGroups.push("command");
    }
    allowedGroups.push("mcp");

    modes.push({
      slug,
      name: formatModeName(slug, group),
      roleDefinition,
      groups: allowedGroups,
      ...(fm.model && fm.model !== "inherit" ? { model: { modelId: fm.model } } : {}),
    });
  }

  return modes;
}

function formatModeName(slug, group) {
  const icons = {
    security: "🔐",
    frontend: "🎨",
    backend: "⚙️",
    devops: "🚀",
    architect: "🏛️",
    edit: "🤖",
  };
  const icon = icons[group] || "🤖";
  const label = slug
    .split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return `${icon} ${label}`;
}

/**
 * Write .roomodes to projectDir
 */
function generateRoomodes(projectDir, agentsDir) {
  const modes = buildModes(agentsDir);
  const roomodes = { customModes: modes };
  const outPath = path.join(projectDir, ".roomodes");
  guardrails.safeWrite(outPath, JSON.stringify(roomodes, null, 2), "utf-8", projectDir);
  return outPath;
}

/**
 * Write .roorules to projectDir (mirrors .windsurfrules)
 */
function generateRoorules(projectDir, answers = {}) {
  const rulesPath = path.join(projectDir, ".roorules");
  if (fs.existsSync(rulesPath)) return rulesPath;

  const agentName = answers.agentName || "aiyu-agent";
  const provider = answers.provider || "mock";
  const memory = answers.memory || "none";

  const content = `# Aiyu MultiAgent — Auto-read by Roo Code

## 🎯 Overview
AI Agent Platform — ${agentName} agent (${provider}, ${memory} memory)

## 📁 Structure
- \`.agent/agents/\` — Agent definitions (84 specialists)
- \`.agent/skills/\` — Domain-specific skills (46 skills)
- \`.agent/workflows/\` — Slash command workflows (78 workflows)
- \`.agent/tests/\` — Agent test files (*.test.md)

## 🤖 How to Use Agents
Switch to a custom mode in Roo (bottom-left mode selector) to activate a specialist:
- 🏛️ **elite-orchestrator** — Mission-critical multi-agent coordination
- 🔐 **security-auditor** — Security review and OWASP compliance
- 🎨 **frontend-specialist** — UI/UX and component design
- ⚙️ **backend-specialist** — API and database development
- 🚀 **devops-engineer** — CI/CD, Docker, cloud infrastructure

## 🚀 CLI Commands
- \`aiyu-multi-agent add skill <name>\` — Install skill from npm
- \`aiyu-multi-agent remove skill <name>\` — Uninstall skill
- \`aiyu-multi-agent test\` — Run agent test suite
- \`aiyu-multi-agent run "<input>"\` — Execute agent
- \`aiyu-multi-agent chat\` — Interactive session
- \`aiyu-multi-agent update\` — Update to latest agent library

## 📜 Rules
All agents follow GEMINI.md rules: TIER 0 (universal) → TIER 1 (code) → TIER 2 (design).
Active rules are announced at the start of every agent response.
`;

  guardrails.safeWrite(rulesPath, content, "utf-8", projectDir);
  return rulesPath;
}

/**
 * Write .roo/ directory structure
 */
function generateRooDir(projectDir) {
  const rooDir = path.join(projectDir, ".roo");
  if (!fs.existsSync(rooDir)) {
    fs.mkdirSync(rooDir, { recursive: true });
  }

  // Write .roo/system-prompt-code.md (system prompt for code mode)
  const systemPromptPath = path.join(rooDir, "system-prompt-code.md");
  if (!fs.existsSync(systemPromptPath)) {
    const content = `# System Prompt: Code Mode

You are Roo with Aiyu Agent Kit active.

Follow the rules defined in GEMINI.md and .roorules.
Always announce the active agent before responding.
Apply clean-code principles to all generated code.
`;
    guardrails.safeWrite(systemPromptPath, content, "utf-8", projectDir);
  }

  return rooDir;
}

module.exports = { generateRoomodes, generateRoorules, generateRooDir, buildModes };
