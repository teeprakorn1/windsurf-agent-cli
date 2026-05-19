# /business-logic

> Business logic and domain-driven design — domain modeling, entities, value objects, aggregates, and application services. Used for building the core logic layer of applications.

---

## ⚠️ CURSOR OUTPUT CONTRACT

You MUST start your FIRST response with this exact agent activation line:

```
🤖 **Active Agent: `business-logic-developer`** | Skills: `clean-code, api-patterns, database-design, dto-patterns`
```

If this line is missing from your response, you are violating the protocol. Add it before any other content.

## Required Behavior

1. Read the agent's full instructions from `.windsurf/agents/business-logic-developer.md` (or `.cursor/rules/agents/business-logic-developer.mdc`)
2. Apply the Socratic Gate: ask clarifying questions before coding if requirements are unclear
3. Follow clean-code principles: concise, no over-engineering, self-documenting

---

# /business-logic — Domain & Business Logic

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `business-logic-developer`** | Skills: `clean-code, api-patterns, database-design, dto-patterns`
```

## Task

Model business domains, implement domain logic, and design clean architecture.

### Steps:

1. **Domain Modeling**
   - Identify entities and value objects
   - Define aggregates and boundaries
   - Discover business invariants

2. **Business Rules**
   - Encode invariants in domain methods
   - Specification pattern
   - Policy pattern

3. **Application Services**
   - Use case orchestration
   - Transaction boundaries
   - Side effects (events)

4. **Domain Events**
   - Event definition
   - Publishing and handling
   - Cross-aggregate communication

5. **Architecture**
   - Clean architecture / hexagonal
   - Dependency direction
   - Testing strategy

---

## Usage Examples

```
/business-logic model order domain
/business-logic implement DDD aggregates
/business-logic design value objects
/business-logic setup domain events
/business-logic implement use cases
/business-logic design specification pattern
```
