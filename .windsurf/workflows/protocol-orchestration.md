---
description: Multi-agent protocol coordination for end-to-end API lifecycle. Orchestrates protocol-architect, backend, frontend, security, and devops for API design, migration, governance, and MCP ecosystem building.
---

# /protocol-orchestration — API Lifecycle Coordination

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
🤖 **Active Agent: `protocol-orchestrator`** | Skills: `clean-code, api-patterns, mcp-builder, architecture +1 more`
```

## Task

Coordinate multiple agents for full API lifecycle — from protocol selection to deployment and governance.

### Patterns:

#### A. Greenfield API Design
1. **protocol-orchestrator** → Requirements + constraints
2. **protocol-architect** → Select protocol + design contract
3. **security-auditor** → Review contract security
4. **backend-specialist** → Implement server
5. **frontend-specialist** → Implement client
6. **devops-engineer** → Deploy + monitor

#### B. Protocol Migration
1. **protocol-orchestrator** → Assess current state
2. **protocol-architect** → Design target + migration path
3. **code-archaeologist** → Analyze existing consumers
4. **backend-specialist** → Build adapter layer
5. **test-engineer** → Contract + compatibility tests
6. **devops-engineer** → Canary deployment

#### C. MCP Ecosystem
1. **protocol-orchestrator** → Map AI tool needs
2. **protocol-architect** → Design MCP architecture
3. **backend-specialist** → Implement MCP servers
4. **security-auditor** → Review tool permissions
5. **devops-engineer** → Deploy + configure

#### D. API Governance
1. **protocol-orchestrator** → Audit existing APIs
2. **protocol-architect** → Define standards
3. **security-auditor** → Security baseline
4. **compliance-officer** → Data handling rules
5. **devops-engineer** → Enforce via gateway

---

## Usage Examples

```
/protocol-orchestration design full API for SaaS platform
/protocol-orchestration migrate REST to gRPC
/protocol-orchestration build MCP ecosystem
/protocol-orchestration standardize APIs across teams
/protocol-orchestration multi-protocol architecture
```

---

## Caution

- Protocol choice affects team structure — involve stakeholders early
- Migration needs backward compatibility — never break existing consumers
- MCP servers must validate all inputs — AI models are unpredictable clients
- Governance without enforcement is just documentation
