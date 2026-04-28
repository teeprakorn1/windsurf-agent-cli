# CODEBASE.md — Windsurf Agent CLI

## System Overview

This project is **Sub-Agent Kit** — a configuration set for AI Agent Framework on Windsurf IDE, designed to create intelligent Agent systems that can analyze, plan, and coordinate together.

## Architecture

```
┌─────────────────────────────────────────┐
│           User Request                  │
└─────────────┬───────────────────────────┘
              ▼
┌─────────────────────────────────────────┐
│   Orchestrator (orchestrator.md)        │
│   - Analyze request                     │
│   - Select appropriate Agent            │
└─────────────┬───────────────────────────┘
              ▼
┌─────────────────────────────────────────┐
│   Project Planner (project-planner.md)  │
│   - Create plan {task-slug}.md          │
│   - Await user approval                 │
└─────────────┬───────────────────────────┘
              ▼
┌─────────────────────────────────────────┐
│   Specialized Agents (79 agents)        │
│   frontend-specialist, backend-...      │
└─────────────┬───────────────────────────┘
              ▼
┌─────────────────────────────────────────┐
│   Verification Scripts (5 scripts)      │
│   checklist.py, verify_all.py...        │
└─────────────────────────────────────────┘
```

## Core Components

### Agents (79 total)
Located in `.windsurf/agents/`, each with frontmatter specifying:
- `name`, `description`, `tools`, `model`, `skills`

Examples: `frontend-specialist.md`, `security-auditor.md`, `explorer-agent.md`

### Skills (46 total)
Located in `.windsurf/skills/`, each skill is a folder containing:
- `SKILL.md` (required) — metadata + guidelines
- `scripts/` (optional) — Python/Bash scripts
- `references/` (optional) — templates, docs

Examples: `clean-code`, `vulnerability-scanner`, `frontend-design`

### Workflows (78 total)
Located in `.windsurf/workflows/` as Markdown files specifying steps for slash commands

Examples: `orchestrate.md`, `create.md`, `deploy.md`

### Scripts (5 total)
Located in `.windsurf/scripts/`:
- `checklist.py` — Master checklist runner
- `verify_all.py` — Run all verifications
- `security_scan.py` — Vulnerability scanning
- `auto_preview.py` — Auto preview server
- `session_manager.py` — Session management

### Shared Assets (`.shared/`)
Special directory for assets shared across skills:
- `.shared/ui-ux-pro-max/scripts/` — Python scripts for design system search (used by `ui-ux-pro-max` workflow)
  - `core.py` — Core structure of design database
  - `search.py` — CLI tool to search styles, colors, typography
  - `design_system.py` — Design system generator

### Rules (10 total)
- `GEMINI.md` — Core rules of Sub-Agent Kit (Tier 0-2)
- `architecture.md` — System architecture
- `security-rules.md` — Security best practices and guidelines
- `performance-rules.md` — Performance optimization guidelines
- `code-quality-rules.md` — Code quality and maintainability standards
- `documentation-rules.md` — Documentation standards and practices
- `testing-rules.md` — Testing standards, patterns, and coverage requirements
- `api-design-rules.md` — RESTful API design and HTTP conventions
- `database-rules.md` — Schema design, query optimization, and migration safety
- `deployment-rules.md` — Deployment safety, rollback, and release management

## Connections

- **Agent → Skill:** via frontmatter `skills:`
- **Agent → Workflow:** via agent name reference in workflow
- **Workflow → Agent:** via workflow name reference in agent
- **Script → Skill:** security_scan.py located in `skills/vulnerability-scanner/scripts/`

## Additional Information

- Read `.windsurf/rules/GEMINI.md` for usage rules
- See `docs/PLAN.md` for the latest analysis report
