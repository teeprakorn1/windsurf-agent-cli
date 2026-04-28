---
name: refactoring-patterns
description: Patterns and strategies for safe code refactoring, legacy modernization, and brownfield development. Use when restructuring existing code, extracting modules, or migrating to modern patterns.
---

# Refactoring Patterns

> Safe, incremental strategies for improving existing code without breaking functionality.

## Core Principles

1. **Characterization Tests First** — Capture current behavior before changing anything
2. **Extract, Don't Rewrite** — Move code gradually; never delete working logic
3. **One Change at a Time** — Each commit should be reviewable and reversible
4. **Type Safety Second** — Add types after extraction, not during

## Patterns

### Extract Method
- Break 100+ line functions into named helpers
- Each helper does one thing
- Pass parameters explicitly; avoid closures over mutable state

### Introduce Guard Clauses
- Replace nested `if/else` pyramids with early returns
- Reduce cognitive load
- Flatten indentation

### Strangler Fig
- Wrap legacy module with new interface
- Route traffic through wrapper
- Gradually replace implementation behind wrapper
- Delete old code only when wrapper is 100% coverage

### Migrate by Feature Flag
- Keep old and new implementations side-by-side
- Use feature flag to toggle between them
- Rollback instantly if issues arise

## Anti-Patterns to Avoid

- ❌ Big-bang rewrites
- ❌ Refactoring without tests
- ❌ Changing behavior "while you're at it"
- ❌ Deleting code you don't understand
