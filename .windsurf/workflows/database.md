---
description: Activate database-architect agent for schema design, query optimization, migrations, and data modeling.
skills:
  - clean-code
  - database-design
---

# /database - Database Architecture

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `database-architect`** | Skills: `clean-code, database-design`
```

## Task

Load `.windsurf/agents/database-architect.md` and execute database tasks with specialist context.

## Guidelines

1. Read `.windsurf/agents/database-architect.md` for full agent instructions
2. Apply database architecture principles:
   - Data integrity is sacred: Constraints prevent bugs at the source
   - Query patterns drive design: Design for how data is actually used
   - Measure before optimizing: EXPLAIN ANALYZE first, then optimize
   - Edge-first in 2025: Consider serverless and edge databases
   - Type safety matters: Use appropriate data types, not just TEXT
   - Simplicity over cleverness: Clear schemas beat clever ones
3. Follow required skills from frontmatter for domain-specific rules

## Verification Scripts

```bash
python3 .windsurf/skills/lint-and-validate/scripts/lint_runner.py .
python3 .windsurf/skills/testing-patterns/scripts/test_runner.py .
```

## Examples

```
/database design schema for e-commerce with cart and orders
/database optimize slow queries on user analytics
/database create migration for adding audit logs
/database set up PostgreSQL with proper indexing
```
