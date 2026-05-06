---
description: User experience orchestration — coordinates product, UX research, frontend, backend, and accessibility for user-centric feature development.
---

# /user-orchestration — User-Centric Feature Coordination

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
🤖 **Active Agent: `user-orchestrator`** | Skills: `clean-code, frontend-design, plan-writing, brainstorming`
```

## Task

Coordinate all disciplines around the user: research, design, implementation, and validation.

### Patterns:

#### A. User-Centric Feature
1. **product-manager** → Requirements + metrics
2. **ux-researcher** → User research
3. **frontend-orchestrator** → UI implementation
4. **backend-orchestrator** → API + data
5. **accessibility-specialist** → Inclusive design
6. **test-engineer** → E2E user tests

#### B. UX Redesign
1. **ux-researcher** → Pain points
2. **product-manager** → Scope
3. **frontend-specialist** → Prototypes
4. **html5-css-developer** → Implementation
5. **frontend-orchestrator** → Rollout

#### C. Onboarding Optimization
1. **ux-researcher** → Funnel analysis
2. **frontend-specialist** → Flow design
3. **react/nextjs-developer** → Interactive build
4. **test-engineer** → E2E tests
5. **accessibility-specialist** → Keyboard flow

#### D. Accessibility-First Product
1. **accessibility-specialist** → Requirements
2. **ux-researcher** → Disabled users research
3. **frontend-orchestrator** → Accessible build
4. **backend-orchestrator** → Data support
5. **test-engineer** → a11y tests

---

## Usage Examples

```
/user-orchestration build user profile feature
/user-orchestration redesign checkout flow
/user-orchestration optimize onboarding
/user-orchestration create accessibility-first product
/user-orchestration implement user feedback
```
