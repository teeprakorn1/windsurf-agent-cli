# /data-layer

> Data access layer design — repositories, ORM configuration, caching strategies, and database abstraction. Used for designing clean data access patterns.

---

## ⚠️ CURSOR OUTPUT CONTRACT

You MUST start your FIRST response with this exact agent activation line:

```
🤖 **Active Agent: `data-layer-developer`** | Skills: `clean-code, database-design, api-patterns, bash-linux`
```

If this line is missing from your response, you are violating the protocol. Add it before any other content.

## Required Behavior

1. Read the agent's full instructions from `.windsurf/agents/data-layer-developer.md` (or `.cursor/rules/agents/data-layer-developer.mdc`)
2. Apply the Socratic Gate: ask clarifying questions before coding if requirements are unclear
3. Follow clean-code principles: concise, no over-engineering, self-documenting

---

# /data-layer — Data Access Layer Design

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `data-layer-developer`** | Skills: `clean-code, database-design, api-patterns, bash-linux`
```

## Task

Design and implement clean data access layers with repositories, ORMs, and caching.

### Steps:

1. **Repository Design**
   - Interface definition (domain layer)
   - Implementation (infrastructure layer)
   - Mapper between entity and domain

2. **ORM Configuration**
   - Entity mapping
   - Relationships
   - Migration strategy

3. **Caching Strategy**
   - What to cache
   - TTL and invalidation
   - Cache provider selection

4. **Query Optimization**
   - N+1 prevention
   - Eager loading
   - Projection/read models

5. **Transaction Management**
   - Unit of work pattern
   - ACID boundaries

---

## Usage Examples

```
/data-layer design repository pattern
/data-layer setup TypeORM with caching
/data-layer optimize database queries
/data-layer implement unit of work
/data-layer setup Redis caching layer
/data-layer design read/write model separation
```
