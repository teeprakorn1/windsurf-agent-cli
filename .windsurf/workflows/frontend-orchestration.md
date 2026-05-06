---
description: Frontend orchestration — coordinates UI developers, designers, accessibility specialists, and performance optimizers for user interface development.
---

# /frontend-orchestration — Frontend Coordination

$ARGUMENTS

---


## Available Orchestration Tools

| Tool | Purpose |
|------|---------|
| `agent.delegate` | Delegate sub-tasks to specialized agents (max depth 3) |
| `plan.create` | Create structured execution plan |
| `plan.update` | Update task status (pending → in_progress → completed) |
| `plan.list` | View plan progress |
| `memory.save` | Save context for cross-agent handoff |
| `memory.load` | Load saved context from previous agent |


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `frontend-orchestrator`** | Skills: `clean-code, frontend-design, nextjs-react-expert, web-design-guidelines +2 more`
```

## Task

Coordinate frontend specialists for UI development, design systems, performance, and accessibility.

### Patterns:

#### A. New Feature UI
1. **ux-researcher** → User needs
2. **frontend-specialist** → Architecture
3. **react/angular/nextjs-developer** → Implementation
4. **html5-css-developer** → Markup + CSS
5. **accessibility-specialist** → WCAG compliance
6. **performance-optimizer** → Bundle optimization

#### B. Design System
1. **frontend-specialist** → Architecture
2. **html5-css-developer** → CSS tokens
3. **react-developer** → Component library
4. **accessibility-specialist** → Patterns
5. **test-engineer** → Component tests

#### C. Performance Sprint
1. **performance-optimizer** → Audit
2. **frontend-specialist** → Code splitting
3. **nextjs-developer** → SSR optimization
4. **devops-engineer** → CDN + caching

#### D. Accessibility Compliance
1. **accessibility-specialist** → WCAG audit
2. **frontend-specialist** → Fixes
3. **html5-css-developer** → Semantic HTML
4. **test-engineer** → a11y tests

---

## Usage Examples

```
/frontend-orchestration build new dashboard UI
/frontend-orchestration create design system
/frontend-orchestration optimize Core Web Vitals
/frontend-orchestration fix WCAG compliance issues
/frontend-orchestration migrate to Next.js App Router
```
