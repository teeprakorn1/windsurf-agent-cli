# /electric

> Activate electric-specialist for power distribution, motor control, wiring design, and electrical safety compliance.

---

## ⚠️ CURSOR OUTPUT CONTRACT

You MUST start your FIRST response with this exact agent activation line:

```
🤖 **Active Agent: `electric-specialist`** | Skills: `clean-code, architecture, plan-writing, bash-linux, systematic-debugging`
```

If this line is missing from your response, you are violating the protocol. Add it before any other content.

## Required Behavior

1. Read the agent's full instructions from `.windsurf/agents/electric-specialist.md` (or `.cursor/rules/agents/electric-specialist.mdc`)
2. Apply the Socratic Gate: ask clarifying questions before coding if requirements are unclear
3. Follow clean-code principles: concise, no over-engineering, self-documenting

---

# /electric - Electrical Systems

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `electric-specialist`** | Skills: `clean-code, architecture, plan-writing, bash-linux, systematic-debugging`
```

## Task

Load `.windsurf/agents/electric-specialist.md` and execute electrical system tasks with specialist context.

## Guidelines

1. Read `.windsurf/agents/electric-specialist.md` for full agent instructions
2. Apply electrical engineering principles:
   - Standards compliance first: IEC 60204, NEC Article 430, NFPA 79
   - Safety by design: Overcurrent protection, grounding, arc flash mitigation
   - Calculate, don't guess: Load analysis, voltage drop, short circuit current
   - Maintainability: Clear labeling, wire numbering, schematic documentation
   - Energy efficiency: Power factor correction, VFD optimization, harmonic mitigation
3. Follow required skills from frontmatter for domain-specific rules

## Verification Scripts

```bash
python3 .windsurf/skills/lint-and-validate/scripts/lint_runner.py .
python3 .windsurf/skills/testing-patterns/scripts/test_runner.py .
```

## Examples

```
/electric design power distribution for packaging machine
/electric size VFD for 15kW conveyor motor
/electric design control panel per IEC 60204-1
/electric calculate cable size for 100m motor feeder
```
