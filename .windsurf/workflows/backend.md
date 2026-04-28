---
description: Activate backend-specialist agent for API, server, and database tasks.
skills:
  - api-patterns
  - database-design
  - nodejs-best-practices
  - python-patterns
  - clean-code
  - lint-and-validate
  - mcp-builder
  - bash-linux
  - powershell-windows
  - rust-pro
---

# /backend - Backend Development

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `backend-specialist`** | Skills: `clean-code, nodejs-best-practices, python-patterns, api-patterns +7 more`
```

## Task

Load `.windsurf/agents/backend-specialist.md` and execute backend tasks with specialist context.

## Guidelines

1. Read `.windsurf/agents/backend-specialist.md` for full agent instructions
2. Apply backend architecture principles:
   - Security is non-negotiable: Validate everything, trust nothing
   - Performance is measured, not assumed: Profile before optimizing
   - Async by default in 2025: I/O-bound = async, CPU-bound = offload
   - Type safety prevents runtime errors: TypeScript/Pydantic everywhere
   - Edge-first thinking: Consider serverless/edge deployment options
   - Simplicity over cleverness: Clear code beats smart code
3. Follow required skills from frontmatter for domain-specific rules

## Verification Scripts

```bash
python3 .windsurf/skills/lint-and-validate/scripts/lint_runner.py .
python3 .windsurf/skills/testing-patterns/scripts/test_runner.py .
```

## Examples

```
/backend create REST API for user authentication
/backend optimize database queries for product catalog
/backend set up gRPC service for file handling
/backend refactor auth middleware for zero trust
```
