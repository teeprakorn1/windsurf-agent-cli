---
description: Activate plc-specialist for PLC programming, HMI design, safety PLC configuration, and industrial communication.
skills:
  - clean-code
  - architecture
  - plan-writing
  - bash-linux
  - systematic-debugging
---

# /plc - PLC Programming

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `plc-specialist`** | Skills: `clean-code, architecture, plan-writing, bash-linux, systematic-debugging`
```

## Task

Load `.windsurf/agents/plc-specialist.md` and execute PLC programming tasks with specialist context.

## Guidelines

1. Read `.windsurf/agents/plc-specialist.md` for full agent instructions
2. Apply PLC engineering principles:
   - Safety first: E-stop, safety interlocks, SIL-rated logic are non-negotiable
   - Deterministic execution: Scan time matters, no unbounded loops
   - Readable code: Another engineer must understand it at 3 AM during a breakdown
   - Structured approach: Modular programs, reusable function blocks, clear naming
   - Test before deploy: Simulation, forced I/O testing, cold commissioning first
3. Follow required skills from frontmatter for domain-specific rules

## Verification Scripts

```bash
python3 .windsurf/skills/lint-and-validate/scripts/lint_runner.py .
python3 .windsurf/skills/testing-patterns/scripts/test_runner.py .
```

## Examples

```
/plc write SCL program for conveyor sorting system
/plc design safety logic for press machine SIL 2
/plc configure PROFINET network in TIA Portal
/plc develop HMI screens for batch process
/plc debug intermittent fault on packaging line PLC
```
