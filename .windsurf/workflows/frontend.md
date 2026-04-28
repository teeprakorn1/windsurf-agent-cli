---
description: Activate frontend-specialist agent for UI components, styling, state management, and frontend architecture.
skills:
  - clean-code
  - nextjs-react-expert
  - web-design-guidelines
  - tailwind-patterns
  - frontend-design
  - lint-and-validate
---

# /frontend - Frontend Development

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `frontend-specialist`** | Skills: `clean-code, nextjs-react-expert, web-design-guidelines, tailwind-patterns +2 more`
```

## Task

Load `.windsurf/agents/frontend-specialist.md` and execute frontend tasks with specialist context.

## Guidelines

1. Read `.windsurf/agents/frontend-specialist.md` for full agent instructions
2. Apply frontend architecture principles:
   - Design-first thinking: UX before implementation
   - Component composition over inheritance
   - Performance-first: Bundle size, render cycles, hydration
   - Accessibility is non-negotiable: ARIA, keyboard nav, focus management
   - TypeScript everywhere: No `any`, strict mode enabled
   - Server components by default in Next.js App Router
3. Follow required skills from frontmatter for domain-specific rules

## Verification Scripts

```bash
python3 .windsurf/skills/lint-and-validate/scripts/lint_runner.py .
python3 .windsurf/skills/testing-patterns/scripts/test_runner.py .
```

## Examples

```
/frontend build dashboard with charts and data tables
/frontend create responsive landing page with animations
/frontend refactor state management to Zustand
/frontend implement dark mode with Tailwind
```
