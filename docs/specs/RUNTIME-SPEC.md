# Runtime Spec — Standard for Agent Execution

> This defines the standard YAML configuration for how agents execute.
> Every agent must conform to this spec for platform compatibility.

---

## Agent runtime spec (in agent .md frontmatter)

```yaml
---
name: my-agent
description: "What this agent does"
tools: fs.read, fs.write, fs.edit, search.grep, fs.glob, shell.exec
model: gpt-4                    # LLM model
provider: openai                # openai | claude | groq | local | mock | cli:<name>
memory: none                    # none | file | vector
guardrails: true                # Enable security layer
loop: react                     # react | step | custom
max_steps: 10                   # Max ReAct loop iterations
skills: clean-code, architecture
---

# Agent instructions here
```

---

## Runtime loop types

### `react` (Default — ReAct Pattern)

```
Observe → Think → Act → Observe → ... → Output
```

1. LLM receives input + state
2. LLM generates thought + action (tool call or final answer)
3. If tool call → execute tool → add result to state → loop
4. If final answer → return output

### `step` (Step-based)

```
Step 1 → Step 2 → Step 3 → ... → Output
```

Predefined sequence of steps. Each step runs once.

### `custom`

User-defined loop logic via skill scripts.

---

## Tool call format

### In LLM Response (Text)

```
TOOL_CALL: Read({"path": "/src/index.js"})
TOOL_CALL: Bash({"command": "npm test"})
```

### In LLM Response (API Structured)

```json
{
  "tool_calls": [
    {
 "function": {
      "name": "Read",
      "arguments": "{\"path\": \"/src/index.js\"}"
    }
  ]
}
```

---

## Built-in tools

| Tool (Legacy) | Tool (Namespaced) | Args | Description |
|---------------|-------------------|------|-------------|
| `Read` | `fs.read` | `path`, `offset?`, `limit?` | Read file contents (1MB limit, line range support) |
| `Write` | `fs.write` | `path`, `content` | Write file (atomic, safe-write) |
| `Edit` | `fs.edit` | `path`, `old_string`, `new_string` | Find & replace (enforces unique old_string) |
| `Grep` | `search.grep` | `pattern`, `path` | Search file contents (async walk, ReDoS-safe, 50-file yield) |
| `Glob` | `fs.glob` | `pattern`, `path` | Find files by name (`[...]` classes, `{a,b}` braces) |
| `Bash` | `shell.exec` | `command`, `timeout?`, `cwd?` | Execute allowed commands (bare name only, no path prefixes) |
| — | `fetch.url` | `url`, `method?`, `headers?`, `body?`, `timeout?` | Fetch HTTP(S) URLs (15s timeout, 1MB body limit, 3 redirects) |

> **V2.6 Note:** Legacy names (`Read`, `Bash`, etc.) are auto-resolved via `LEGACY_ALIAS`. New code should use namespaced names.

---

## Module map

> The monolithic `agent-runtime.js` and `tool-registry.js` have been decomposed into focused modules. Both original files remain as thin re-exports for backward compatibility.

| Module | Responsibility |
|--------|---------------|
| `react-loop.js` | ReAct loop execution (`runAgent`) |
| `chat-session.js` | Interactive chat (`createChatSession`) |
| `failover.js` | Per-provider circuit breaker + failover chain |
| `cache.js` | LRU cache with TTL + deep-copy-on-read |
| `agent-loader.js` | Load agent specs + skill instructions |
| `prompt-builder.js` | Build system prompts + skill truncation |
| `input-sanitizer.js` | Input validation + prompt injection detection |
| `tool-parser.js` | Parse tool calls from LLM responses (4 strategies) |
| `tool-definitions.js` | Builtin tools, schemas, registry, truncation |
| `search-tools.js` | `search.grep` + `fs.glob` implementations |
| `command-parser.js` | Shell arg parsing + ReDoS-safe regex |
| `types.d.ts` | TypeScript declarations for 12 core modules |

### Allowed shell commands

`ls`, `cat`, `echo`, `pwd`, `mkdir`, `git`, `node`, `npm`, `npx`, `python3`

---

## Skill plugin spec

### config.json

```json
{
  "name": "my-skill",
  "version": "1.0.0",
  "description": "What this skill provides",
  "permissions": {
    "fs": true,
    "network": false,
    "exec": false
  },
  "tools": [],
  "scripts": [],
  "references": []
}
```

### Permission System

| Permission | Scope | Default |
|-----------|-------|---------|
| `fs` | File system read/write | Ask on install |
| `network` | HTTP requests | Deny by default |
| `exec` | Shell command execution | Deny by default |

When installing a skill that requires permissions:
```
⚠️ Skill "my-skill" requires: fs, network
Allow? (y/N)
```

---

## Provider configuration

### OpenAI

```bash
export OPENAI_API_KEY=sk-...
aiyu-multi-agent run "..." --provider openai --model gpt-4
```

### Claude (Anthropic)

```bash
export ANTHROPIC_API_KEY=sk-ant-...
aiyu-multi-agent run "..." --provider claude --model claude-sonnet-4-20250514
```

### Local (Ollama)

```bash
ollama serve
aiyu-multi-agent run "..." --provider local --model llama3
```

### Groq

```bash
export GROQ_API_KEY=gsk_...
aiyu-multi-agent run "..." --provider groq --model llama-3.3-70b-versatile
```

### CLI engines

```bash
aiyu-multi-agent engines                    # List detected CLI engines
aiyu-multi-agent run "..." --provider cli:claude
aiyu-multi-agent run "..." --provider cli:codex
```

### Mock (testing)

```bash
aiyu-multi-agent run "..." --provider mock
```

---

## Output format

### Pretty (default)

```
🚀 Running agent: backend-agent
   Input: Create a REST API with Express

  Tool: Read({"path":"/package.json"}) ✓
  Tool: Write({"path":"/src/index.js"}) ✓

✓ Output:
  Created Express REST API at /src/index.js with routes...

  Steps: 3 | Tokens: 450 | Status: complete
```

### JSON (`--json`)

```json
{
  "input": "Create a REST API",
  "output": "Created Express REST API...",
  "status": "complete",
  "steps": [...],
  "usage": { "totalTokens": 450 }
}
```

### TAP (`--tap`)

```
ok 1 - Step 1: Read package.json
ok 2 - Step 2: Write index.js
ok 3 - Step 3: Final output
1..3
```
