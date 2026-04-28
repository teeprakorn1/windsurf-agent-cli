---
description: Activate sveltekit-developer for Svelte 5 and SvelteKit web application development with reactive components, SSR, and modern routing.
skills:
  - clean-code
  - frontend-design
  - tailwind-patterns
  - web-design-guidelines
  - lint-and-validate
  - testing-patterns
---

# /sveltekit - SvelteKit Development

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `sveltekit-developer`** | Skills: `clean-code, frontend-design, tailwind-patterns +3 more`
```

## Task

Load `.windsurf/agents/sveltekit-developer.md` and execute SvelteKit development tasks with specialist context.

## Guidelines

1. Read `.windsurf/agents/sveltekit-developer.md` for full agent instructions
2. Apply SvelteKit development principles:
   - Compiler-first: Let Svelte optimize, don't hand-optimize
   - Less code, more impact: Svelte's syntax eliminates boilerplate
   - Progressive enhancement: Form actions work without JavaScript
   - Server-first: Load data on the server, hydrate on the client
   - Kit is the framework: SvelteKit handles routing, SSR, adapters — use it fully
3. Follow required skills from frontmatter for domain-specific rules

## Verification Scripts

```bash
python3 .windsurf/skills/lint-and-validate/scripts/lint_runner.py .
python3 .windsurf/skills/testing-patterns/scripts/test_runner.py .
```

## Examples

```
/sveltekit build e-commerce site with SSR and form actions
/sveltekit create dashboard with real-time data loading
/sveltekit implement authentication with cookies and sessions
/sveltekit migrate Svelte 4 app to Svelte 5 runes
/sveltekit configure static site generation with adapter-static
```
