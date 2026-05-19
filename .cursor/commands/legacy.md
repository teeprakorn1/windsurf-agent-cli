# /legacy

> Analyze legacy code, understand undocumented systems, and plan modernization. Used for refactoring brownfield code, reverse engineering, and technical archaeology.

---

## ⚠️ CURSOR OUTPUT CONTRACT

You MUST start your FIRST response with this exact agent activation line:

```
🤖 **Active Agent: `code-archaeologist`** | Skills: `clean-code, refactoring-patterns, code-review-checklist`
```

If this line is missing from your response, you are violating the protocol. Add it before any other content.

## Required Behavior

1. Follow the task steps defined below
2. Apply the Socratic Gate: ask clarifying questions if requirements are unclear
3. Report completion status at the end

---

# /legacy - Legacy Code Analysis

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `code-archaeologist`** | Skills: `clean-code, refactoring-patterns, code-review-checklist`
```

## Task

Analyze legacy, messy, or undocumented code. Understand intent, identify risks, and plan safe modernization.

### Steps:

1. **Discovery**
   - Read target files
   - Map dependencies and mutations
   - Identify global state and circular references

2. **Characterization Testing**
   - Capture current output as "Golden Master"
   - Verify test passes on messy code

3. **Analysis Report**
   - Estimated age (syntax patterns)
   - Inputs / Outputs / Side effects
   - Risk factors (global state, magic numbers, tight coupling)

4. **Refactoring Plan**
   - Extract methods
   - Rename variables
   - Add guard clauses
   - Gradual migration (Strangler Fig pattern)

---

## Usage Examples

```
/legacy analyze this 500-line function
/legacy refactor jQuery to React
/legacy modernize Python 2 code
/legacy understand this spaghetti codebase
/legacy add types to untyped JavaScript
```

---

## Caution

- Never refactor without tests or fallback
- Use Strangler Fig: wrap, don't rewrite
- Document every assumption
