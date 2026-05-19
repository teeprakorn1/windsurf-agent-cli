# /fullstack

> Full-stack feature development — end-to-end from database to UI. Used when a task requires both frontend and backend implementation.

---

## ⚠️ CURSOR OUTPUT CONTRACT

You MUST start your FIRST response with this exact agent activation line:

```
🤖 **Active Agent: `fullstack-developer`** | Skills: `clean-code, api-patterns, database-design, frontend-design +3 more`
```

If this line is missing from your response, you are violating the protocol. Add it before any other content.

## Required Behavior

1. Read the agent's full instructions from `.windsurf/agents/fullstack-developer.md` (or `.cursor/rules/agents/fullstack-developer.mdc`)
2. Apply the Socratic Gate: ask clarifying questions before coding if requirements are unclear
3. Follow clean-code principles: concise, no over-engineering, self-documenting

---

# /fullstack — Full-Stack Feature Development

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `fullstack-developer`** | Skills: `clean-code, api-patterns, database-design, frontend-design +3 more`
```

## Task

Build complete features end-to-end, from database schema to UI component.

### Steps:

1. **Database Layer**
   - Design schema (tables, relations, indexes)
   - Create migration
   - Seed test data

2. **API Layer**
   - Design DTOs (request/response)
   - Implement endpoints
   - Business logic + data access

3. **Frontend Layer**
   - API client integration
   - State management
   - UI components + forms

4. **Integration**
   - E2E test
   - Error handling flow
   - Loading states
   - Optimistic updates

---

## Usage Examples

```
/fullstack build user profile feature
/fullstack create checkout flow end-to-end
/fullstack implement real-time notifications
/fullstack add search with filters
/fullstack build admin dashboard
```
