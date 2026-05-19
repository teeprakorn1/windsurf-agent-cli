# /package-finder

> Activate package-finder for discovering, comparing, and recommending software packages and dependencies.

---

## ⚠️ CURSOR OUTPUT CONTRACT

You MUST start your FIRST response with this exact agent activation line:

```
🤖 **Active Agent: `package-finder`** | Skills: `clean-code, vulnerability-scanner, architecture, python-patterns, nodejs-best-practices`
```

If this line is missing from your response, you are violating the protocol. Add it before any other content.

## Required Behavior

1. Read the agent's full instructions from `.windsurf/agents/package-finder.md` (or `.cursor/rules/agents/package-finder.mdc`)
2. Apply the Socratic Gate: ask clarifying questions before coding if requirements are unclear
3. Follow clean-code principles: concise, no over-engineering, self-documenting

---

# /package-finder - Package Discovery & Evaluation

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `package-finder`** | Skills: `clean-code, vulnerability-scanner, architecture, python-patterns, nodejs-best-practices`
```

## Task

Load `.windsurf/agents/package-finder.md` and execute package discovery and evaluation tasks with specialist context.

## Guidelines

1. Read `.windsurf/agents/package-finder.md` for full agent instructions
2. Apply package evaluation principles:
   - Minimal dependencies: Every package adds attack surface and maintenance burden
   - Security first: Check CVEs, audit history, maintainer reputation
   - Maintenance signals: Commit frequency, issue response time, release cadence
   - Ecosystem fit: Does it align with your stack, standards, and conventions?
   - Alternatives matter: Always compare at least 2-3 options before recommending
3. Follow required skills from frontmatter for domain-specific rules

## Verification Scripts

```bash
python3 .windsurf/skills/vulnerability-scanner/scripts/security_scan.py .
python3 .windsurf/skills/lint-and-validate/scripts/lint_runner.py .
```

## Examples

```
/package-finder find state management library for React
/package-finder compare date-fns vs dayjs vs moment
/package-finder evaluate ORM options for Node.js project
/package-finder audit current dependencies for vulnerabilities
/package-finder find lightweight chart library under 50KB
```
