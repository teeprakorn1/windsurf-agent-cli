---
description: Activate mechatronic-specialist for mechanical-electronic integration, robotics, and automated manufacturing systems.
skills:
  - clean-code
  - architecture
  - plan-writing
  - bash-linux
  - systematic-debugging
---

# /mechatronic - Mechatronic Systems

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `mechatronic-specialist`** | Skills: `clean-code, architecture, plan-writing, bash-linux, systematic-debugging`
```

## Task

Load `.windsurf/agents/mechatronic-specialist.md` and execute mechatronic system tasks with specialist context.

## Guidelines

1. Read `.windsurf/agents/mechatronic-specialist.md` for full agent instructions
2. Apply mechatronic engineering principles:
   - System integration first: Components must work together
   - Safety is non-negotiable: E-stop circuits, safety PLCs, redundant sensors
   - Precision matters: Tolerance stack-ups, calibration, feedback loops
   - Real-time constraints: Deterministic response, cycle time optimization
   - Maintainability: Modular design, clear documentation, diagnostics
3. Follow required skills from frontmatter for domain-specific rules

## Verification Scripts

```bash
python3 .windsurf/skills/lint-and-validate/scripts/lint_runner.py .
python3 .windsurf/skills/testing-patterns/scripts/test_runner.py .
```

## Examples

```
/mechatronic design pick-and-place robot with vision guidance
/mechatronic configure servo drive for 6-axis robot
/mechatronic integrate PROFINET network for packaging line
/mechatronic program PLC for conveyor sorting system
```
