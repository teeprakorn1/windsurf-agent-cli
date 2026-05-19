/**
 * Unit tests for cursor-generator (Cursor IDE conversion)
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const YAML = require("yaml");

const cursorGen = require("../../commands/cursor-generator");
const {
  extractDescription,
  stripFrontmatter,
  buildCursorFrontmatter,
  convertAgent,
  convertSkill,
  convertWorkflow,
  convertDomainRule,
  convertMcpConfig,
  DOMAIN_GLOB_MAP,
  ORCHESTRATION_COMMANDS,
  AGENT_COMMANDS,
  getCommandType,
  parseAgentActivation,
  buildOutputContract,
  buildTemplateBlock,
} = cursorGen._internals;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
    failed++;
  }
}

function mkTempDir(prefix = "cursor-gen-test-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function rmTempDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

function parseFm(filePath) {
  const c = fs.readFileSync(filePath, "utf-8");
  const m = c.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  return YAML.parse(m[1]);
}

console.log("\n🧪 Cursor Generator Unit Tests\n");

// ── stripFrontmatter ─────────────────────────────────────────────────

test("stripFrontmatter removes YAML block + leading whitespace", () => {
  const input = "---\nname: test\n---\n\n# Body\nContent here";
  const result = stripFrontmatter(input);
  assert.strictEqual(result, "# Body\nContent here");
});

test("stripFrontmatter returns original when no frontmatter", () => {
  const input = "# Heading\nNo frontmatter";
  assert.strictEqual(stripFrontmatter(input), input);
});

// ── buildCursorFrontmatter ───────────────────────────────────────────

test("buildCursorFrontmatter emits valid YAML", () => {
  const fm = buildCursorFrontmatter({ description: "Test desc", alwaysApply: true });
  const m = fm.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(m, "frontmatter wrapper present");
  const parsed = YAML.parse(m[1]);
  assert.strictEqual(parsed.description, "Test desc");
  assert.strictEqual(parsed.alwaysApply, true);
});

test("buildCursorFrontmatter escapes double quotes in description", () => {
  const fm = buildCursorFrontmatter({ description: 'has "quotes"', alwaysApply: false });
  const m = fm.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const parsed = YAML.parse(m[1]);
  assert.strictEqual(parsed.description, 'has "quotes"');
});

test("buildCursorFrontmatter emits globs as YAML list", () => {
  const fm = buildCursorFrontmatter({ description: "x", globs: ["**/*.ts", "**/*.tsx"], alwaysApply: false });
  const m = fm.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const parsed = YAML.parse(m[1]);
  assert.deepStrictEqual(parsed.globs, ["**/*.ts", "**/*.tsx"]);
});

// ── extractDescription ───────────────────────────────────────────────

test("extractDescription prefers fm.description", () => {
  const desc = extractDescription({ description: "From frontmatter" }, "# Heading\nBody", "fallback");
  assert.strictEqual(desc, "From frontmatter");
});

test("extractDescription pulls from blockquote tagline", () => {
  const body = "# My Rule\n\n> This is the rule's tagline description.\n\n---\n\n## Section";
  const desc = extractDescription({}, body, "fallback");
  assert.strictEqual(desc, "This is the rule's tagline description.");
});

test("extractDescription skips code fence content", () => {
  const body = "# Title\n\n```python\ndef should_not_be_grabbed():\n    pass\n```\n\n> Real description after the code block.";
  const desc = extractDescription({}, body, "fallback");
  assert.strictEqual(desc, "Real description after the code block.");
});

test("extractDescription skips markdown tables and lists", () => {
  const body = "# Title\n\n| col1 | col2 |\n|------|------|\n| a | b |\n\n- item\n- item\n\n> The actual description here.";
  const desc = extractDescription({}, body, "fallback");
  assert.strictEqual(desc, "The actual description here.");
});

test("extractDescription synthesizes from keywords when body has none", () => {
  const desc = extractDescription({ keywords: ["api", "rest"] }, "# Title\n\n", "fallback");
  assert.ok(desc.includes("api"));
  assert.ok(desc.includes("rest"));
});

test("extractDescription uses fallback when nothing found", () => {
  const desc = extractDescription({}, "# Title\n\n", "MY_FALLBACK");
  assert.strictEqual(desc, "MY_FALLBACK");
});

// ── convertAgent / convertSkill / convertWorkflow ────────────────────

test("convertAgent produces valid frontmatter and preserves body", () => {
  const tmp = mkTempDir();
  try {
    const src = path.join(tmp, "agent.md");
    fs.writeFileSync(src, `---\nname: test-agent\ndescription: A test agent for unit tests.\nskills: clean-code, architecture\ntools: Read, Write\nmodel: inherit\n---\n\n# Test Agent\n\nAgent body content.\n`);
    const dest = path.join(tmp, "out", "test-agent.mdc");
    convertAgent(src, dest);

    assert.ok(fs.existsSync(dest));
    const fm = parseFm(dest);
    assert.strictEqual(fm.description, "A test agent for unit tests.");
    assert.strictEqual(fm.alwaysApply, false);

    const content = fs.readFileSync(dest, "utf-8");
    assert.ok(content.includes("# Agent: test-agent"));
    assert.ok(content.includes("clean-code"));
    assert.ok(content.includes("Agent body content"));
  } finally { rmTempDir(tmp); }
});

test("convertSkill returns false when SKILL.md missing", () => {
  const tmp = mkTempDir();
  try {
    const result = convertSkill("missing", path.join(tmp, "missing"), path.join(tmp, "out.mdc"));
    assert.strictEqual(result, false);
  } finally { rmTempDir(tmp); }
});

test("convertSkill writes valid mdc with skill body", () => {
  const tmp = mkTempDir();
  try {
    const skillDir = path.join(tmp, "my-skill");
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), `---\nname: my-skill\ndescription: A skill description.\n---\n\n# Skill body\nDetails here.\n`);

    const dest = path.join(tmp, "out", "my-skill.mdc");
    const ok = convertSkill("my-skill", skillDir, dest);
    assert.strictEqual(ok, true);

    const fm = parseFm(dest);
    assert.strictEqual(fm.description, "A skill description.");
    assert.strictEqual(fm.alwaysApply, false);

    const content = fs.readFileSync(dest, "utf-8");
    assert.ok(content.includes("# Skill: my-skill"));
    assert.ok(content.includes("Details here"));
  } finally { rmTempDir(tmp); }
});

test("convertWorkflow strips frontmatter and adds command header", () => {
  const tmp = mkTempDir();
  try {
    const src = path.join(tmp, "deploy.md");
    fs.writeFileSync(src, `---\ndescription: Deploy command\n---\n\n# /deploy\n\nDeploy instructions here.\n`);
    const dest = path.join(tmp, "out", "deploy.md");
    convertWorkflow(src, dest);

    const content = fs.readFileSync(dest, "utf-8");
    assert.ok(content.startsWith("# /deploy\n"));
    assert.ok(content.includes("> Deploy command"));
    assert.ok(content.includes("Deploy instructions here"));
    // Should NOT contain raw frontmatter delimiters at top
    assert.ok(!content.startsWith("---"));
  } finally { rmTempDir(tmp); }
});

test("convertDomainRule adds globs from DOMAIN_GLOB_MAP", () => {
  const tmp = mkTempDir();
  try {
    const src = path.join(tmp, "code-quality-rules.md");
    fs.writeFileSync(src, `---\nkeywords: [quality, lint]\n---\n\n# Code Quality\n\n> Standards for clean code.\n`);
    const dest = path.join(tmp, "out", "code-quality-rules.mdc");
    convertDomainRule(src, dest);

    const fm = parseFm(dest);
    assert.ok(Array.isArray(fm.globs));
    assert.ok(fm.globs.length > 0);
    assert.strictEqual(fm.alwaysApply, false);
    assert.ok(fm.description.includes("clean code") || fm.description.includes("Standards"));
  } finally { rmTempDir(tmp); }
});

test("convertDomainRule sets alwaysApply for architecture rule", () => {
  const tmp = mkTempDir();
  try {
    const src = path.join(tmp, "architecture.md");
    fs.writeFileSync(src, `---\n---\n\n# Arch\n\n> Architecture decisions.\n`);
    const dest = path.join(tmp, "out", "architecture.mdc");
    convertDomainRule(src, dest);

    const fm = parseFm(dest);
    assert.strictEqual(fm.alwaysApply, true);
    assert.strictEqual(fm.globs, undefined);
  } finally { rmTempDir(tmp); }
});

test("convertMcpConfig copies and pretty-prints JSON", () => {
  const tmp = mkTempDir();
  try {
    const src = path.join(tmp, "mcp.json");
    fs.writeFileSync(src, JSON.stringify({ mcpServers: { foo: { command: "bar" } } }));
    const dest = path.join(tmp, "out", "mcp.json");
    const ok = convertMcpConfig(src, dest);
    assert.strictEqual(ok, true);

    const parsed = JSON.parse(fs.readFileSync(dest, "utf-8"));
    assert.deepStrictEqual(parsed.mcpServers.foo, { command: "bar" });
  } finally { rmTempDir(tmp); }
});

test("convertMcpConfig returns false for invalid JSON", () => {
  const tmp = mkTempDir();
  try {
    const src = path.join(tmp, "bad.json");
    fs.writeFileSync(src, "{ not valid json");
    const dest = path.join(tmp, "out", "mcp.json");
    const ok = convertMcpConfig(src, dest);
    assert.strictEqual(ok, false);
  } finally { rmTempDir(tmp); }
});

// ── Command Type Classification ──────────────────────────────────────

test("getCommandType returns orchestration for known commands", () => {
  assert.strictEqual(getCommandType("elite-orchestrate"), "orchestration");
  assert.strictEqual(getCommandType("senior-orchestrate"), "orchestration");
  assert.strictEqual(getCommandType("orchestrate"), "orchestration");
  assert.strictEqual(getCommandType("backend-orchestration"), "orchestration");
});

test("getCommandType returns agent for known commands", () => {
  assert.strictEqual(getCommandType("backend"), "agent");
  assert.strictEqual(getCommandType("frontend"), "agent");
  assert.strictEqual(getCommandType("database"), "agent");
  assert.strictEqual(getCommandType("react"), "agent");
});

test("getCommandType returns utility for unknown commands", () => {
  assert.strictEqual(getCommandType("debug"), "utility");
  assert.strictEqual(getCommandType("test"), "utility");
  assert.strictEqual(getCommandType("deploy"), "utility");
  assert.strictEqual(getCommandType("unknown-cmd"), "utility");
});

// ── Agent Info Parser ────────────────────────────────────────────────

test("parseAgentActivation extracts agent name and skills", () => {
  const body = '## 🤖 Agent Activation\n\n```\n🤖 **Active Agent: `backend-specialist`** | Skills: `clean-code, api-patterns`\n```';
  const info = parseAgentActivation(body);
  assert.strictEqual(info.agentName, "backend-specialist");
  assert.strictEqual(info.skills, "clean-code, api-patterns");
});

test("parseAgentActivation returns null when no match", () => {
  const info = parseAgentActivation("# No agent activation here");
  assert.strictEqual(info, null);
});

// ── Output Contract Templates ────────────────────────────────────────

test("buildOutputContract includes agent name and skills", () => {
  const result = buildOutputContract("test-agent", "skill1, skill2");
  assert.ok(result.includes("CURSOR OUTPUT CONTRACT"));
  assert.ok(result.includes("`test-agent`"));
  assert.ok(result.includes("`skill1, skill2`"));
  assert.ok(result.includes("violating the protocol"));
});

test("buildTemplateBlock injects orchestration template for orchestrate commands", () => {
  const body = '## 🤖 Agent Activation\n\n```\n🤖 **Active Agent: `orchestrator`** | Skills: `plan-writing, clean-code`\n```\n\n## Task';
  const block = buildTemplateBlock("orchestrate", body);
  assert.ok(block.includes("CURSOR OUTPUT CONTRACT"));
  assert.ok(block.includes("Required Response Structure"));
  assert.ok(block.includes("Mission Brief"));
  assert.ok(block.includes("Agent Delegation Matrix"));
  assert.ok(!block.includes("Socratic Gate"));
});

test("buildTemplateBlock injects agent template for agent commands", () => {
  const body = '## 🤖 Agent Activation\n\n```\n🤖 **Active Agent: `backend-specialist`** | Skills: `clean-code`\n```\n\n## Task';
  const block = buildTemplateBlock("backend", body);
  assert.ok(block.includes("CURSOR OUTPUT CONTRACT"));
  assert.ok(block.includes("Required Behavior"));
  assert.ok(block.includes("backend-specialist.md"));
  assert.ok(block.includes("Socratic Gate"));
  assert.ok(!block.includes("Mission Brief"));
});

test("buildTemplateBlock injects utility template for utility commands", () => {
  const body = '## 🤖 Agent Activation\n\n```\n🤖 **Active Agent: `debugger`** | Skills: `clean-code`\n```\n\n## Task';
  const block = buildTemplateBlock("debug", body);
  assert.ok(block.includes("CURSOR OUTPUT CONTRACT"));
  assert.ok(block.includes("Required Behavior"));
  assert.ok(block.includes("Follow the task steps"));
  assert.ok(block.includes("completion status"));
  assert.ok(!block.includes("Mission Brief"));
});

test("buildTemplateBlock returns empty string when no agent activation found", () => {
  const block = buildTemplateBlock("some-cmd", "# No agent here");
  assert.strictEqual(block, "");
});

test("convertWorkflow injects Output Contract into generated command", () => {
  const tmp = mkTempDir();
  try {
    const src = path.join(tmp, "backend.md");
    fs.writeFileSync(src, [
      "---",
      "description: Backend command",
      "---",
      "",
      "# /backend",
      "",
      "## 🤖 Agent Activation",
      "",
      "> **MANDATORY:** Before starting any work, announce the active agent.",
      "",
      "```",
      '🤖 **Active Agent: `backend-specialist`** | Skills: `clean-code, api-patterns`',
      "```",
      "",
      "## Task",
      "Do backend things.",
    ].join("\n"));
    const dest = path.join(tmp, "out", "backend.md");
    convertWorkflow(src, dest);

    const content = fs.readFileSync(dest, "utf-8");
    assert.ok(content.includes("CURSOR OUTPUT CONTRACT"), "has Output Contract");
    assert.ok(content.includes("`backend-specialist`"), "has agent name");
    assert.ok(content.includes("Required Behavior"), "has agent template");
    assert.ok(content.includes("Socratic Gate"), "has Socratic Gate");
    assert.ok(content.includes("Do backend things"), "preserves original body");
  } finally { rmTempDir(tmp); }
});

// ── Full generate() integration ──────────────────────────────────────

test("generate() refuses to overwrite without force", () => {
  const tmp = mkTempDir();
  try {
    fs.mkdirSync(path.join(tmp, ".windsurf"));
    fs.mkdirSync(path.join(tmp, ".cursor")); // pre-existing
    assert.throws(
      () => cursorGen.generate(tmp),
      /already exists/
    );
  } finally { rmTempDir(tmp); }
});

test("generate() throws when source dir missing", () => {
  const tmp = mkTempDir();
  try {
    assert.throws(
      () => cursorGen.generate(tmp),
      /Source directory not found/
    );
  } finally { rmTempDir(tmp); }
});

test("generate() produces .cursor/ tree from minimal .windsurf/", () => {
  const tmp = mkTempDir();
  try {
    // Build minimal .windsurf/ source
    const ws = path.join(tmp, ".windsurf");
    fs.mkdirSync(path.join(ws, "agents"), { recursive: true });
    fs.mkdirSync(path.join(ws, "skills", "demo"), { recursive: true });
    fs.mkdirSync(path.join(ws, "workflows"), { recursive: true });
    fs.mkdirSync(path.join(ws, "rules"), { recursive: true });

    fs.writeFileSync(path.join(ws, "agents", "demo-agent.md"),
      `---\nname: demo-agent\ndescription: Demo agent.\n---\n\n# Demo\nBody.\n`);
    fs.writeFileSync(path.join(ws, "skills", "demo", "SKILL.md"),
      `---\nname: demo\ndescription: Demo skill.\n---\n\n# Demo skill\nBody.\n`);
    fs.writeFileSync(path.join(ws, "workflows", "demo.md"),
      `---\ndescription: Demo command\n---\n\n# /demo\nBody.\n`);
    fs.writeFileSync(path.join(ws, "rules", "GEMINI.md"),
      `---\ntrigger: always_on\n---\n\n# GEMINI\n\n> Defines AI behavior.\n`);
    fs.writeFileSync(path.join(ws, "rules", "code-quality-rules.md"),
      `---\nkeywords: [quality]\n---\n\n# Code Quality\n\n> Standards for code.\n`);
    fs.writeFileSync(path.join(ws, "mcp_config.json"),
      JSON.stringify({ mcpServers: { test: { command: "x" } } }));
    fs.writeFileSync(path.join(tmp, ".windsurfrules"), `# Project\nOverview text.\n`);

    const stats = cursorGen.generate(tmp);

    assert.strictEqual(stats.agents, 1);
    assert.strictEqual(stats.skills, 1);
    assert.strictEqual(stats.workflows, 1);
    assert.strictEqual(stats.rules, 2);
    assert.strictEqual(stats.mcpConfig, true);
    assert.strictEqual(stats.overview, true);

    assert.ok(fs.existsSync(path.join(tmp, ".cursor", "rules", "agents", "demo-agent.mdc")));
    assert.ok(fs.existsSync(path.join(tmp, ".cursor", "rules", "skills", "demo.mdc")));
    assert.ok(fs.existsSync(path.join(tmp, ".cursor", "commands", "demo.md")));
    assert.ok(fs.existsSync(path.join(tmp, ".cursor", "rules", "01-gemini-protocol.mdc")));
    assert.ok(fs.existsSync(path.join(tmp, ".cursor", "rules", "domain", "code-quality-rules.mdc")));
    assert.ok(fs.existsSync(path.join(tmp, ".cursor", "rules", "00-project-overview.mdc")));
    assert.ok(fs.existsSync(path.join(tmp, ".cursor", "mcp.json")));
  } finally { rmTempDir(tmp); }
});

test("generate() with force=true overwrites existing .cursor/", () => {
  const tmp = mkTempDir();
  try {
    const ws = path.join(tmp, ".windsurf");
    fs.mkdirSync(path.join(ws, "agents"), { recursive: true });
    fs.writeFileSync(path.join(ws, "agents", "a.md"), `---\nname: a\ndescription: a\n---\n\nBody`);

    const cursorDir = path.join(tmp, ".cursor");
    fs.mkdirSync(cursorDir);
    fs.writeFileSync(path.join(cursorDir, "stale.txt"), "stale");

    const stats = cursorGen.generate(tmp, { force: true });
    assert.strictEqual(stats.agents, 1);
    assert.ok(fs.existsSync(path.join(cursorDir, "rules", "agents", "a.mdc")));
  } finally { rmTempDir(tmp); }
});

// ── Summary ──────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
