---
description: Elite orchestration for mission-critical, enterprise-scale tasks requiring 7+ agents. Strategic coordination for platform migrations, security incidents, and zero-downtime deployments where failure is not an option.
---

# /elite-orchestrate — Mission-Critical Enterprise Coordination

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
🤖 **Active Agent: `elite-orchestrator`** | Skills: `clean-code, plan-writing, behavioral-modes, architecture +3 more`
```

## Task

Command 7+ agents for mission-critical, enterprise-scale tasks. Strategic decisions, risk management, and absolute accountability.

### Patterns:

#### A. Zero-Downtime Platform Migration
```
Preparation:
├── cloud-architect → Target architecture
├── database-architect → Migration strategy
├── sre → SLO definitions + monitoring
└── compliance-officer → Compliance requirements

Execution:
├── backend-specialist → Dual-write implementation
├── devops-engineer → Infrastructure + traffic switch
├── database-architect → Data sync
└── fullstack-developer → Fallback systems

Validation:
├── sre → Monitoring + error budget
├── test-engineer → Smoke tests
├── security-auditor → Post-migration scan
└── compliance-officer → Audit verification
```

#### B. Security Incident Response
```
Triage:
├── incident-responder → Classification + containment
├── security-auditor → Blast radius
└── sre → System stability

Investigation:
├── ethical-hacker → Attack vector
├── penetration-tester → Exploit confirmation
└── threat-modeler → New threats

Recovery:
├── secure-coder → Patch development
├── devops-engineer → Isolation + restore
└── backend-specialist → Hotfix

Post-Mortem:
├── incident-responder → Timeline
├── staff-engineer → Root cause
└── compliance-officer → Regulatory filing
```

#### C. Enterprise Platform Build
```
Strategy:
├── staff-engineer → Technical vision
├── cloud-architect → Infrastructure blueprint
├── protocol-architect → API governance
└── compliance-officer → Regulatory framework

Foundation:
├── platform-engineer → Developer platform
├── devops-engineer → CI/CD
└── security-orchestrator → Security baseline

Core + Hardening:
├── fullstack-developer → Services
├── test-engineer → Test pyramid
├── security-auditor → Full audit
└── performance-optimizer → Load testing
```

---

## Usage Examples

```
/elite-orchestrate zero-downtime cloud migration
/elite-orchestrate active security incident response
/elite-orchestrate build enterprise platform from scratch
/elite-orchestrate SOC2 compliance certification
/elite-orchestrate multi-region disaster recovery setup
```

---

## Quality Gates

| Gate | Requirements |
|------|-------------|
| **Architecture** | staff-engineer + cloud-architect + security-orchestrator approval |
| **Implementation** | Code review + >80% test coverage + 0 critical security issues |
| **Integration** | All integration tests pass + performance benchmarks met |
| **Production** | SRE runbook + monitoring + rollback tested + compliance sign-off |

## Risk Register

```
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Data loss | Low | Critical | Dual-write + backups |
| Security regression | Medium | High | Security gate in CI |
| Performance degradation | Medium | High | Load test + canary |
| Compliance violation | Low | Critical | Pre-audit checklist |
```

## Communication

| Audience | Channel | Frequency |
|----------|---------|-----------|
| Execution team | Async | Real-time |
| Senior management | Status report | Daily |
| C-level | Executive summary | Weekly |
| External | Formal report | As needed |
