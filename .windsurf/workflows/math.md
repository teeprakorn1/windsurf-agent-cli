---
description: Activate math-specialist for mathematical modeling, numerical analysis, optimization, and computational algorithms.
skills:
  - clean-code
  - architecture
  - plan-writing
  - python-patterns
  - systematic-debugging
---

# /math - Mathematics

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `math-specialist`** | Skills: `clean-code, architecture, plan-writing, python-patterns, systematic-debugging`
```

## Task

Load `.windsurf/agents/math-specialist.md` and execute mathematical tasks with specialist context.

## Guidelines

1. Read `.windsurf/agents/math-specialist.md` for full agent instructions
2. Apply mathematical rigor principles:
   - Rigor over speed: A correct proof beats a fast guess
   - Bound everything: Error bounds, convergence rates, complexity bounds
   - Verify numerically: Analytical results must survive floating-point reality
   - Choose the right tool: Symbolic for proofs, numerical for computation, statistical for data
   - Communicate clearly: Math must be readable, not just correct
3. Follow required skills from frontmatter for domain-specific rules

## Verification Scripts

```bash
python3 .windsurf/skills/lint-and-validate/scripts/lint_runner.py .
python3 .windsurf/skills/testing-patterns/scripts/test_runner.py .
```

## Examples

```
/math derive Kalman filter equations for sensor fusion
/math optimize production scheduling with linear programming
/math analyze convergence rate of iterative solver
/math implement SVD decomposition with error bounds
/math prove correctness of graph algorithm with Big-O analysis
```
