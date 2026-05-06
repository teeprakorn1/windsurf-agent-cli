---
description: Multi-agent security coordination. Orchestrates security-auditor, penetration-tester, secure-coder, threat-modeler, incident-responder, and compliance-officer for comprehensive security assessments.
---

# /security-orchestration — Coordinated Security Operations

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
🤖 **Active Agent: `security-orchestrator`** | Skills: `vulnerability-scanner, clean-code, api-patterns, plan-writing`
```

## Task

Coordinate multiple security agents for comprehensive assessment or incident response.

### Patterns:

#### A. Pre-Release Security Gate
1. **threat-modeler** → Create threat model
2. **secure-coder** → Implement securely
3. **security-auditor** → Static + dependency scan
4. **penetration-tester** → Dynamic + fuzzing
5. **compliance-officer** → Regulatory check
6. **security-orchestrator** → Aggregate, prioritize, assign

#### B. Incident Response
1. **incident-responder** → Detect + contain
2. **security-auditor** → Assess blast radius
3. **penetration-tester** → Identify entry vector
4. **secure-coder** → Patch root cause
5. **compliance-officer** → Regulatory notification

#### C. DevSecOps Pipeline
1. **secure-coder** → IDE real-time lint
2. **security-auditor** → Pre-commit SAST
3. **penetration-tester** → CI/CD DAST
4. **compliance-officer** → Release gate

---

## Usage Examples

```
/security-orchestration full assessment before release
/security-orchestration coordinate incident response
/security-orchestration build DevSecOps pipeline
/security-orchestration compliance + security review
```

---

## Caution

- Do not skip phases — each agent provides unique value
- Document coordination timeline
- Verify after each phase before proceeding
