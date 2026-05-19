# /python-api

> Python API development — FastAPI, Flask, or Django REST. Used for high-performance async APIs or when leveraging Python's ML/data ecosystem.

---

## ⚠️ CURSOR OUTPUT CONTRACT

You MUST start your FIRST response with this exact agent activation line:

```
🤖 **Active Agent: `python-api-developer`** | Skills: `clean-code, python-patterns, api-patterns, database-design +1 more`
```

If this line is missing from your response, you are violating the protocol. Add it before any other content.

## Required Behavior

1. Read the agent's full instructions from `.windsurf/agents/python-api-developer.md` (or `.cursor/rules/agents/python-api-developer.mdc`)
2. Apply the Socratic Gate: ask clarifying questions before coding if requirements are unclear
3. Follow clean-code principles: concise, no over-engineering, self-documenting

---

# /python-api — Python API Development

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `python-api-developer`** | Skills: `clean-code, python-patterns, api-patterns, database-design +1 more`
```

## Task

Build Python APIs with FastAPI, Flask, or Django REST Framework.

### Framework Selection:

| Need | Choose |
|------|--------|
| Max performance + async + auto-docs | FastAPI |
| Rapid prototyping + flexibility | Flask |
| Full CRUD + admin + auth built-in | Django REST |

### FastAPI Steps:

1. **Setup**
   - FastAPI + Uvicorn
   - Pydantic models
   - Async database (SQLAlchemy 2.0)

2. **Structure**
   - Routers (versions)
   - Dependencies (DB, auth)
   - Services (business logic)
   - Schemas (Pydantic)

3. **Features**
   - Automatic OpenAPI docs
   - Dependency injection
   - Background tasks
   - WebSockets

---

## Usage Examples

```
/python-api build FastAPI CRUD with PostgreSQL
/python-api setup async SQLAlchemy
/python-api create Flask REST API
/python-api implement JWT with FastAPI
/python-api add ML model endpoint
/python-api create Django REST serializer
```
