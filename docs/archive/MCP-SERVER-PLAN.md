# MCP Server Implementation Plan — aiyu-multi-agent

> Addresses: [Issue #1](https://github.com/teeprakorn1/aiyu-multi-agent/issues/1)  
> Status: **✅ IMPLEMENTED** — v2.3.0 (2026-05-05)

---

## 1. overview

Build an official MCP (Model Context Protocol) server for aiyu-multi-agent, enabling integration with Claude Code, Cursor, Zed, Windsurf, and any MCP-compatible host.

**Design Philosophy:** Minimal surface, maximum utility. Expose 3 tools instead of 80+.

---

## 2. architecture

```
┌─────────────────────────────────────────────────────┐
│  MCP Host (Claude Code / Cursor / Zed / Windsurf)   │
│                                                     │
│  Discovers tools via MCP protocol:                  │
│    - list_agents                                    │
│    - run_agent                                      │
│    - inspect_agent                                  │
└────────────────────┬────────────────────────────────┘
                     │ stdio (JSON-RPC)
                     ▼
┌─────────────────────────────────────────────────────┐
│  aiyu-multi-agent MCP Server                        │
│  (lib/mcp/server.js)                                │
│                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ list_agents │  │  run_agent   │  │inspect_    │ │
│  │             │  │              │  │agent       │ │
│  └──────┬──────┘  └──────┬───────┘  └─────┬──────┘ │
│         │                │                 │        │
│         ▼                ▼                 ▼        │
│  ┌──────────────────────────────────────────────┐   │
│  │  Existing Core Modules                       │   │
│  │  - config.js (getConfigDir, loadConfig)      │   │
│  │  - agent-runtime.js (loadAgentSpec, runAgent)│   │
│  │  - utils.js (parseFrontmatter, findDefault)  │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 3. MCP tools specification

### 3.1 `list_agents`

**Purpose:** Discover available agents in the project.

| Field | Value |
|-------|-------|
| **Description** | List all available agents in the current project with their descriptions and capabilities |
| **Input Schema** | `{ verbose?: boolean }` — optional, include skills/tools in output |

**Output (content):**
```json
{
  "agents": [
    {
      "name": "code-reviewer",
      "description": "Reviews code for quality, security, and best practices",
      "tools": ["fs.read", "shell.run"],
      "skills": ["clean-code", "security"],
      "provider": "openai",
      "model": "gpt-4"
    }
  ],
  "default": "code-reviewer"
}
```

### 3.2 `run_agent`

**Purpose:** Execute an agent with input and return the result.

| Field | Value |
|-------|-------|
| **Description** | Run an aiyu agent with the given input and return the result |
| **Input Schema** | See below |

**Input Schema:**
```json
{
  "agent_name": { "type": "string", "description": "Agent to run (omit for default)" },
  "input": { "type": "string", "description": "The task/input for the agent" },
  "provider": { "type": "string", "enum": ["openai", "claude", "local", "mock"], "description": "LLM provider override" },
  "model": { "type": "string", "description": "LLM model override" },
  "max_steps": { "type": "number", "description": "Max ReAct loop steps (default: 10)" }
}
```
- `agent_name` + `input` are required
- `provider`, `model`, `max_steps` are optional overrides

**Output (content):**
```json
{
  "agent": "code-reviewer",
  "output": "The code has 3 issues...",
  "steps": 4,
  "toolCalls": ["fs.read", "fs.read", "shell.run"],
  "usage": { "promptTokens": 1200, "completionTokens": 800, "totalTokens": 2000 }
}
```

### 3.3 `inspect_agent`

**Purpose:** Get detailed metadata about a specific agent (frontmatter, skills, tools, instructions).

| Field | Value |
|-------|-------|
| **Description** | Get detailed information about a specific agent |
| **Input Schema** | `{ "agent_name": string }` |

**Output (content):**
```json
{
  "name": "code-reviewer",
  "description": "...",
  "tools": ["fs.read", "shell.run"],
  "skills": ["clean-code", "security"],
  "provider": "openai",
  "model": "gpt-4",
  "memory": "none",
  "maxSteps": 10,
  "loop": "react",
  "instructions": "You are an expert code reviewer..."
}
```

---

## 4. provider keys strategy

**Priority order (highest wins):**

1. **MCP tool call parameters** — `provider`/`model` passed in `run_agent`
2. **Environment variables** — `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OLLAMA_HOST`
3. **Project config** — `.agent/config.yaml` or `.windsurf/config.yaml` `providers` section
4. **Agent frontmatter defaults** — `provider: openai`, `model: gpt-4`

This means the MCP server reads from the **same config** as the CLI, with env vars as override. No separate key management needed.

---

## 5. transport strategy

### Phase 1: stdio (This PR)
- Uses `StdioServerTransport` from `@modelcontextprotocol/server`
- Compatible with: Claude Code, Cursor, Zed, Windsurf, VS Code (Copilot)
- Zero network exposure — secure by default

### Phase 2: SSE/Streamable HTTP (Future)
- Add `@modelcontextprotocol/node` or `@modelcontextprotocol/express`
- For web-based hosts and remote access
- Behind feature flag: `aiyu-multi-agent mcp --transport http --port 3001`

---

## 6. file structure

```
lib/mcp/
├── server.js          # MCP server setup + tool registration
├── tools/
│   ├── list-agents.js # list_agents tool handler
│   ├── run-agent.js   # run_agent tool handler
│   └── inspect-agent.js # inspect_agent tool handler
└── README.md          # MCP server documentation
```

**Plus modifications to:**
- `bin/cli.js` — add `mcp` command
- `package.json` — add `@modelcontextprotocol/server` + `zod` dependencies
- `README.md` — add MCP section

---

## 7. CLI command

```bash
# Start MCP server (stdio — for host config)
aiyu-multi-agent mcp

# With options (future: SSE transport)
aiyu-multi-agent mcp --transport stdio
```

**Host configuration example (Claude Code `claude_desktop_config.json`):**
```json
{
  "mcpServers": {
    "aiyu": {
      "command": "npx",
      "args": ["-y", "aiyu-multi-agent", "mcp"],
      "cwd": "/path/to/project"
    }
  }
}
```

**Cursor `.cursor/mcp.json`:**
```json
{
  "mcpServers": {
    "aiyu": {
      "command": "npx",
      "args": ["-y", "aiyu-multi-agent", "mcp"]
    }
  }
}
```

---

## 8. dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@modelcontextprotocol/sdk` | ^1.29.0 | MCP server SDK (v1.x — stable, ESM-only, dynamic import required) |
| `zod` | ^3.23.0 | Schema validation for tool inputs |

> **Note:** SDK is ESM-only — requires `await import()` in CJS project. Uses `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js` + `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js`.

---

## 9. implementation steps

| Step | File | Description | Status |
|------|------|-------------|--------|
| 1 | `package.json` | Add `@modelcontextprotocol/sdk` + `zod` deps | ✅ Done |
| 2 | `lib/mcp/server.js` | Create MCP server with `McpServer` + `StdioServerTransport` (dynamic import) | ✅ Done |
| 3 | `lib/mcp/tools/list-agents.js` | Implement `list_agents` tool | ✅ Done |
| 4 | `lib/mcp/tools/run-agent.js` | Implement `run_agent` tool (json:true, noCache:true, 50KB truncation) | ✅ Done |
| 5 | `lib/mcp/tools/inspect-agent.js` | Implement `inspect_agent` tool | ✅ Done |
| 6 | `bin/cli.js` | Add `mcp` CLI command | ✅ Done |
| 7 | `README.md` | Add MCP configuration section (Claude Code + Cursor examples) | ✅ Done |
| 8 | `CHANGELOG.md` | Add v2.3.0 entry | ✅ Done |
| 9 | `CODEBASE.md` | Add MCP module to architecture + connections | ✅ Done |
| 10 | `package.json` | Bump version to 2.3.0 | ✅ Done |
| 11 | Test | Manual test: handshake, tools/list, list_agents, inspect_agent, run_agent | ✅ Done |

---

## 10. risk assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| SDK v2 breaking changes | Medium | Medium | Pin v1.x, migration path documented |
| Large agent output exceeds MCP message limit | Low | Medium | Truncate output >50KB, add `truncated: true` flag |
| Missing API keys at runtime | High | Low | Clear error message + docs on key setup |
| Tool list too large if we add per-agent tools | N/A | N/A | Avoided by design — 3 tools only |

---

## 11. open questions

1. ✅ stdio-only for Phase 1? → **Implemented: Yes**
2. ✅ 3 tools (run_agent + list_agents + inspect_agent)? → **Implemented: Yes**
3. ✅ Config+env for provider keys? → **Implemented: Yes**
4. ✅ CLI command `aiyu-multi-agent mcp`? → **Implemented: Yes**
5. 🤔 Should `run_agent` support streaming (partial results)? → **Deferred to Phase 2**
6. 🤔 Should we expose agent tools as MCP resources (read-only)? → **Deferred to Phase 2**

---

## 12. success criteria

- [x] `aiyu-multi-agent mcp` starts and responds to MCP handshake
- [x] `list_agents` returns all agents in project
- [x] `run_agent` executes agent and returns result
- [x] `inspect_agent` returns agent metadata
- [ ] Works with Claude Code desktop config (pending real-host test)
- [ ] Works with Cursor MCP config (pending real-host test)
- [x] Zero new security vulnerabilities

---

## 13. implementation notes

### ESM-only SDK Workaround
The `@modelcontextprotocol/sdk` is ESM-only (no CJS build). Since aiyu-multi-agent uses CJS (`require()`), we use dynamic `await import()` in `lib/mcp/server.js`:

```js
const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = await import("zod");
```

### Test Results (2026-05-05)

```bash
# MCP handshake
echo '{"jsonrpc":"2.0","id":1,"method":"initialize",...}' | node bin/cli.js mcp
# → {"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{"listChanged":true}},"serverInfo":{"name":"aiyu-multi-agent","version":"2.3.0"}}}

# tools/list → 3 tools registered
# list_agents → returns all 80 agents
# inspect_agent {agent_name: "react-developer"} → full spec with skills, tools, instructions
# run_agent {agent_name: "react-developer", input: "hello", provider: "mock"} → mock response with usage stats
```
