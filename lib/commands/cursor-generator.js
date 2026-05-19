/**
 * Cursor IDE Generator — converts .windsurf/ → .cursor/
 *
 * Mapping:
 *   .windsurfrules                       → .cursor/rules/00-project-overview.mdc (alwaysApply)
 *   .windsurf/rules/GEMINI.md            → .cursor/rules/01-gemini-protocol.mdc  (alwaysApply)
 *   .windsurf/rules/<domain>.md          → .cursor/rules/domain/<name>.mdc       (auto-attach via globs)
 *   .windsurf/agents/<name>.md           → .cursor/rules/agents/<name>.mdc       (agent-requested)
 *   .windsurf/skills/<name>/SKILL.md     → .cursor/rules/skills/<name>.mdc       (agent-requested)
 *   .windsurf/workflows/<name>.md        → .cursor/commands/<name>.md            (slash command)
 *   .windsurf/mcp_config.json            → .cursor/mcp.json                      (direct copy)
 */

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

const utils = require("../utils");

// Heuristic glob mapping for domain rules (filename → file globs to auto-attach)
const DOMAIN_GLOB_MAP = {
  "code-quality-rules": ["**/*.{js,ts,jsx,tsx,py,go,rs,java,rb,php}"],
  "api-design-rules": ["**/api/**/*", "**/routes/**/*", "**/controllers/**/*", "**/*.{controller,route,api}.{js,ts}"],
  "database-rules": ["**/migrations/**/*", "**/*.sql", "**/schema.{js,ts,prisma}", "**/models/**/*"],
  "security-rules": ["**/auth/**/*", "**/*.env*", "**/security/**/*", "**/middleware/**/*"],
  "testing-rules": ["**/*.test.*", "**/*.spec.*", "**/tests/**/*", "**/__tests__/**/*"],
  "performance-rules": ["**/*.{js,ts,jsx,tsx}"],
  "documentation-rules": ["**/*.md", "**/README*", "**/CHANGELOG*"],
  "deployment-rules": ["**/Dockerfile*", "**/docker-compose*.{yml,yaml}", "**/.github/workflows/**", "**/k8s/**/*", "**/deploy/**/*"],
  "architecture": null, // alwaysApply
};

// ── Frontmatter Helpers ──────────────────────────────────────────────

function stripFrontmatter(content) {
  const m = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return m ? content.slice(m[0].length).replace(/^\s+/, "") : content;
}

function buildCursorFrontmatter(meta) {
  const lines = ["---"];
  if (typeof meta.description === "string" && meta.description.trim()) {
    // YAML-safe single-line: replace newlines, escape quotes
    const desc = meta.description.replace(/\r?\n/g, " ").replace(/"/g, '\\"').trim();
    lines.push(`description: "${desc}"`);
  }
  if (Array.isArray(meta.globs) && meta.globs.length > 0) {
    lines.push(`globs:`);
    for (const g of meta.globs) lines.push(`  - "${g}"`);
  }
  if (typeof meta.alwaysApply === "boolean") {
    lines.push(`alwaysApply: ${meta.alwaysApply}`);
  }
  lines.push("---");
  return lines.join("\n") + "\n";
}

function extractDescription(fm, body, fallback) {
  if (fm && typeof fm.description === "string" && fm.description.trim()) {
    return fm.description.trim();
  }

  // Walk body lines: prefer blockquote tagline, skip code fences/tables/headings
  const lines = body.split(/\r?\n/);
  let inCodeFence = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) continue;
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("---")) continue;
    if (trimmed.startsWith("|")) continue; // markdown table row
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || /^\d+\.\s/.test(trimmed)) continue; // lists

    // Allow blockquotes — strip the leading `>` markers
    let candidate = trimmed.startsWith(">") ? trimmed.replace(/^>+\s*/, "") : trimmed;
    if (!candidate) continue;

    const clean = candidate.replace(/[*_`]/g, "").replace(/\[(.+?)\]\(.+?\)/g, "$1").trim();
    if (clean.length >= 20) {
      return clean.length > 280 ? clean.slice(0, 277) + "..." : clean;
    }
  }

  // Fallback: synthesize from keywords if present
  if (fm && Array.isArray(fm.keywords) && fm.keywords.length > 0) {
    return `Aiyu rules for: ${fm.keywords.slice(0, 8).join(", ")}`;
  }

  return fallback;
}

// ── Converters ───────────────────────────────────────────────────────

function convertAgent(srcPath, destPath) {
  const content = fs.readFileSync(srcPath, "utf-8");
  const fm = utils.parseFrontmatter(content);
  const body = stripFrontmatter(content);
  const name = fm.name || path.basename(srcPath, ".md");

  const description = extractDescription(fm, body, `${name} agent`);

  // Preserve original agent metadata as a header block in body for reference
  const metaBlock = [
    `# Agent: ${name}`,
    "",
    "> **Cursor Agent-Requested Rule** — invoke via `@" + name + "` or let the AI auto-select.",
    "",
  ];
  if (Array.isArray(fm.skills) || typeof fm.skills === "string") {
    const skills = Array.isArray(fm.skills) ? fm.skills.join(", ") : fm.skills;
    metaBlock.push(`**Skills:** ${skills}`);
  }
  if (fm.tools) {
    const tools = Array.isArray(fm.tools) ? fm.tools.join(", ") : fm.tools;
    metaBlock.push(`**Tools:** ${tools}`);
  }
  if (fm.model) metaBlock.push(`**Model:** ${fm.model}`);
  if (fm.memory) metaBlock.push(`**Memory:** ${fm.memory}`);
  metaBlock.push("", "---", "");

  const fmText = buildCursorFrontmatter({
    description,
    alwaysApply: false,
  });

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, fmText + metaBlock.join("\n") + body, "utf-8");
}

function convertSkill(skillName, srcSkillDir, destPath) {
  const skillFile = path.join(srcSkillDir, "SKILL.md");
  if (!fs.existsSync(skillFile)) return false;

  const content = fs.readFileSync(skillFile, "utf-8");
  const fm = utils.parseFrontmatter(content);
  const body = stripFrontmatter(content);

  const description = extractDescription(fm, body, `${skillName} skill`);

  const metaBlock = [
    `# Skill: ${skillName}`,
    "",
    "> **Cursor Agent-Requested Rule** — applied when AI determines relevance.",
    "",
    "---",
    "",
  ];

  const fmText = buildCursorFrontmatter({
    description,
    alwaysApply: false,
  });

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, fmText + metaBlock.join("\n") + body, "utf-8");
  return true;
}

function convertWorkflow(srcPath, destPath) {
  const content = fs.readFileSync(srcPath, "utf-8");
  const fm = utils.parseFrontmatter(content);
  const body = stripFrontmatter(content);
  const name = path.basename(srcPath, ".md");

  // Cursor commands accept plain markdown — preserve description as a heading
  const description = (fm && fm.description) ? String(fm.description).trim() : `${name} command`;

  const header = [
    `# /${name}`,
    "",
    `> ${description}`,
    "",
    "---",
    "",
  ].join("\n");

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, header + body, "utf-8");
}

function convertDomainRule(srcPath, destPath) {
  const content = fs.readFileSync(srcPath, "utf-8");
  const fm = utils.parseFrontmatter(content);
  const body = stripFrontmatter(content);
  const name = path.basename(srcPath, ".md");

  const description = extractDescription(fm, body, `${name} (domain rule)`);
  const globs = DOMAIN_GLOB_MAP[name] || null;

  const fmText = buildCursorFrontmatter(
    globs === null
      ? { description, alwaysApply: true }
      : { description, globs, alwaysApply: false }
  );

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, fmText + body, "utf-8");
}

function convertAlwaysRule(srcPath, destPath, fallbackDesc) {
  const content = fs.readFileSync(srcPath, "utf-8");
  const fm = utils.parseFrontmatter(content);
  const body = stripFrontmatter(content);

  const description = extractDescription(fm, body, fallbackDesc);

  const fmText = buildCursorFrontmatter({
    description,
    alwaysApply: true,
  });

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, fmText + body, "utf-8");
}

function convertProjectOverview(windsurfRulesPath, destPath) {
  if (!fs.existsSync(windsurfRulesPath)) return false;
  const body = fs.readFileSync(windsurfRulesPath, "utf-8");
  const description = "Aiyu MultiAgent project overview, structure, and CLI commands. Always loaded.";
  const fmText = buildCursorFrontmatter({
    description,
    alwaysApply: true,
  });
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, fmText + body, "utf-8");
  return true;
}

function convertMcpConfig(srcPath, destPath) {
  if (!fs.existsSync(srcPath)) return false;
  const raw = fs.readFileSync(srcPath, "utf-8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }
  // Cursor uses the same `mcpServers` key — direct copy is safe
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, JSON.stringify(parsed, null, 2) + "\n", "utf-8");
  return true;
}

// ── Orchestrator ─────────────────────────────────────────────────────

function generate(projectRoot, options = {}) {
  const sourceDir = options.sourceDir || path.join(projectRoot, ".windsurf");
  const cursorDir = options.cursorDir || path.join(projectRoot, ".cursor");
  const force = options.force === true;
  const verbose = options.verbose === true;

  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source directory not found: ${sourceDir}`);
  }

  // Refuse to overwrite without --force
  if (fs.existsSync(cursorDir) && !force) {
    throw new Error(`.cursor/ already exists. Pass { force: true } to overwrite.`);
  }

  const stats = {
    rules: 0,
    agents: 0,
    skills: 0,
    workflows: 0,
    mcpConfig: false,
    overview: false,
  };

  // 1. Project overview from .windsurfrules (if exists at projectRoot)
  const windsurfRulesPath = path.join(projectRoot, ".windsurfrules");
  if (convertProjectOverview(windsurfRulesPath, path.join(cursorDir, "rules", "00-project-overview.mdc"))) {
    stats.overview = true;
    if (verbose) console.log("  ✓ 00-project-overview.mdc");
  }

  // 2. Convert rules/
  const rulesDir = path.join(sourceDir, "rules");
  if (fs.existsSync(rulesDir)) {
    const ruleFiles = fs.readdirSync(rulesDir).filter(f => f.endsWith(".md"));
    for (const f of ruleFiles) {
      const src = path.join(rulesDir, f);
      const base = path.basename(f, ".md");
      if (base === "GEMINI") {
        convertAlwaysRule(src, path.join(cursorDir, "rules", "01-gemini-protocol.mdc"), "GEMINI protocol — agent identification, request classifier, intelligent routing");
      } else {
        convertDomainRule(src, path.join(cursorDir, "rules", "domain", `${base}.mdc`));
      }
      stats.rules++;
      if (verbose) console.log(`  ✓ rules/${base}`);
    }
  }

  // 3. Convert agents/
  const agentsDir = path.join(sourceDir, "agents");
  if (fs.existsSync(agentsDir)) {
    const agentFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith(".md"));
    for (const f of agentFiles) {
      const src = path.join(agentsDir, f);
      const dest = path.join(cursorDir, "rules", "agents", `${path.basename(f, ".md")}.mdc`);
      try {
        convertAgent(src, dest);
        stats.agents++;
      } catch (err) {
        if (verbose) console.warn(`  ⚠ agent ${f}: ${err.message}`);
      }
    }
  }

  // 4. Convert skills/
  const skillsDir = path.join(sourceDir, "skills");
  if (fs.existsSync(skillsDir)) {
    const skillEntries = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter(e => e.isDirectory());
    for (const e of skillEntries) {
      const src = path.join(skillsDir, e.name);
      const dest = path.join(cursorDir, "rules", "skills", `${e.name}.mdc`);
      try {
        if (convertSkill(e.name, src, dest)) {
          stats.skills++;
        }
      } catch (err) {
        if (verbose) console.warn(`  ⚠ skill ${e.name}: ${err.message}`);
      }
    }
  }

  // 5. Convert workflows/ → commands/
  const workflowsDir = path.join(sourceDir, "workflows");
  if (fs.existsSync(workflowsDir)) {
    const wfFiles = fs.readdirSync(workflowsDir).filter(f => f.endsWith(".md"));
    for (const f of wfFiles) {
      const src = path.join(workflowsDir, f);
      const dest = path.join(cursorDir, "commands", f);
      try {
        convertWorkflow(src, dest);
        stats.workflows++;
      } catch (err) {
        if (verbose) console.warn(`  ⚠ workflow ${f}: ${err.message}`);
      }
    }
  }

  // 6. MCP config
  const mcpSrc = path.join(sourceDir, "mcp_config.json");
  if (convertMcpConfig(mcpSrc, path.join(cursorDir, "mcp.json"))) {
    stats.mcpConfig = true;
    if (verbose) console.log("  ✓ mcp.json");
  }

  return stats;
}

module.exports = {
  generate,
  // Exported for testing
  _internals: {
    convertAgent,
    convertSkill,
    convertWorkflow,
    convertDomainRule,
    convertAlwaysRule,
    convertMcpConfig,
    convertProjectOverview,
    extractDescription,
    stripFrontmatter,
    buildCursorFrontmatter,
    DOMAIN_GLOB_MAP,
  },
};
