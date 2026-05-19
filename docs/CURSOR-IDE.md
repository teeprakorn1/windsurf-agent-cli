# Cursor IDE Support

Aiyu MultiAgent has first-class support for [Cursor IDE](https://cursor.sh/). The CLI generates a `.cursor/` directory containing rules, slash commands, and MCP configuration — natively understood by Cursor.

---

## Quick start

```bash
# Generate .cursor/ only (recommended for Cursor-only users)
npx aiyu-multi-agent init --cursor-only

# Generate both .windsurf/ and .cursor/ (multi-IDE projects)
npx aiyu-multi-agent init --cursor

# Re-generate after .windsurf/ updates
npx aiyu-multi-agent init --cursor-only --force
```

After running, open the project in Cursor IDE. Rules and slash commands are auto-discovered.

---

## What gets generated

```
.cursor/
├── mcp.json                                  # MCP servers (context7, shadcn, ...)
├── rules/
│   ├── 00-project-overview.mdc               # Always-applied project context
│   ├── 01-gemini-protocol.mdc                # Always-applied agent protocol
│   ├── domain/                               # Auto-attached by file globs
│   │   ├── code-quality-rules.mdc            # → JS/TS/Py/Go/Rs files
│   │   ├── api-design-rules.mdc              # → **/api/**, **/routes/**
│   │   ├── security-rules.mdc                # → **/auth/**, **/*.env*
│   │   ├── testing-rules.mdc                 # → **/*.test.*, **/*.spec.*
│   │   └── ...
│   ├── agents/                               # 84 Agent-Requested rules
│   │   ├── orchestrator.mdc
│   │   ├── backend-specialist.mdc
│   │   └── ...
│   └── skills/                               # 45 Agent-Requested rules
│       ├── clean-code.mdc
│       ├── architecture.mdc
│       └── ...
└── commands/                                 # 78 slash commands
    ├── create.md         # /create
    ├── debug.md          # /debug
    ├── orchestrate.md    # /orchestrate
    └── ...
```

---

## Cursor rule types used

| Type | Frontmatter | When Applied |
|------|------------|--------------|
| **Always** | `alwaysApply: true` | Every prompt — used for project overview + GEMINI protocol |
| **Auto-Attached** | `globs: [...]` | When you reference matching files — used for domain rules |
| **Agent-Requested** | `description: "..."` (no globs/alwaysApply) | AI decides when relevant — used for agents + skills |
| **Manual** | No metadata | Only when explicitly mentioned (`@ruleName`) |

---

## Usage in Cursor

### Invoke an agent

In Cursor chat, mention an agent rule by typing `@` and the agent name:

```
@orchestrator coordinate the migration to the new database schema
@backend-specialist design the user authentication API
@security-auditor review this code for OWASP issues
```

### Run a slash command

Type `/` in Cursor chat to see available commands:

```
/create todo app with React + Express
/debug why the WebSocket disconnects on reconnect
/deploy production release v2.7.7
```

### Auto-applied rules

When you open a file like `src/api/users.ts`, the `api-design-rules` rule auto-attaches to your context. When working in `.test.ts` files, `testing-rules` activates.

---

## Coexistence with Windsurf

`.cursor/` and `.windsurf/` are independent — both are committed and updated together. The workflow:

1. **Source of truth:** `.windsurf/` (agents, skills, workflows, rules)
2. **Generated artifact:** `.cursor/` (regenerated from `.windsurf/`)
3. **After updating `.windsurf/`:** Re-run `npx aiyu-multi-agent init --cursor-only --force` to sync

This means you should typically edit files in `.windsurf/` and regenerate `.cursor/`, not the other way around.

---

## MCP server configuration

The generator copies `.windsurf/mcp_config.json` → `.cursor/mcp.json` with the same `mcpServers` schema. Cursor IDE reads this directly.

Currently configured:
- `context7` (Upstash) — documentation lookup
- `shadcn` — UI component library

To add more servers, edit `.windsurf/mcp_config.json` and regenerate.

---

## Output contract

Every generated `.cursor/commands/*.md` includes a **⚠️ CURSOR OUTPUT CONTRACT** section at the top. This enforces agent identification in Cursor — even when `alwaysApply` rules (GEMINI.md) aren't loaded.

### 3 command types

| Type | Count | Template |
|------|-------|----------|
| **Orchestration** | 10 | Required Response Structure: Mission Brief, Execution Plan, Agent Delegation Matrix, Risk Register, Quality Gates, Next Actions |
| **Agent** | 34 | Required Behavior: read agent instructions, Socratic Gate, clean-code |
| **Utility** | 34 | Required Behavior: follow task steps, Socratic Gate, completion status |

Commands are classified by `ORCHESTRATION_COMMANDS` / `AGENT_COMMANDS` sets in `cursor-generator.js`. Unknown commands default to utility.

---

## Description extraction

The generator infers each rule's `description` field intelligently:

1. **Prefers:** frontmatter `description:` in the source `.md` file
2. **Falls back:** first blockquote tagline (`> ...`) after the H1 heading
3. **Skips:** code fences, markdown tables, lists, headings
4. **Last resort:** synthesizes from `keywords:` frontmatter, or uses a generic fallback

This produces meaningful descriptions even for legacy rules without explicit metadata.

---

## Troubleshooting

**Q: `.cursor/ already exists` error**
Pass `--force` to overwrite: `npx aiyu-multi-agent init --cursor-only --force`

**Q: Cursor isn't picking up my rules**
- Verify Cursor version 0.42+ (rules) / 0.50+ (commands)
- Check `.cursor/rules/*.mdc` files have valid YAML frontmatter
- Restart Cursor IDE

**Q: An agent rule has a weird description**
- Edit the source `.windsurf/agents/<name>.md` and add `description:` to its frontmatter
- Regenerate: `npx aiyu-multi-agent init --cursor-only --force`

---

## Reference

- Cursor docs: https://docs.cursor.com/context/rules
- Source: `lib/commands/cursor-generator.js`
- Tests: `lib/test/unit/cursor-generator.test.js`
