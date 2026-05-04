# Runtime Spec — Standard for Agent Execution

> This defines the standard YAML configuration for how agents execute.
> Every agent must conform to this spec for platform compatibility.

---

## Agent Runtime Spec (in agent .md frontmatter)

```yaml
---
name: my-agent
description: "What this agent does"
tools: Read, Write, Edit, Grep, Glob, Bash
model: gpt-4                    # LLM model
provider: openai                # openai | claude | local | multi
memory: none                    # none | file | vector
guardrails: true                # Enable security layer
loop: react                     # react | step | custom
max_steps: 10                   # Max ReAct loop iterations
skills: clean-code, architecture
---

# Agent instructions here
```

---

## Runtime Loop Types

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

## Tool Call Format

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

## Built-in Tools

| Tool | Args | Description |
|------|------|-------------|
| `Read` | `path` | Read file contents |
| `Write` | `path`, `content` | Write file (atomic) |
| `Edit` | `path`, `old_string`, `new_string` | Find & replace in file |
| `Grep` | `pattern`, `path` | Search file contents |
| `Glob` | `pattern`, `path` | Find files by name |
| `Bash` | `command`, `timeout` | Execute allowed commands |

### Allowed Bash Commands

`ls`, `cat`, `echo`, `pwd`, `mkdir`, `git`, `node`, `npm`, `npx`, `python3`

---

## Skill Plugin Spec

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

## Provider Configuration

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

### Mock (Testing)

```bash
aiyu-multi-agent run "..." --provider mock
```

---

## Output Format

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
