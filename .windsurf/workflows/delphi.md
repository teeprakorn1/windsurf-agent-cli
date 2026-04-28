---
description: Delphi and Pascal development — VCL, FireMonkey, FireDAC, legacy modernization, and Object Pascal best practices. Used for Windows desktop apps, cross-platform UI, or maintaining legacy Delphi codebases.
---

# /delphi — Delphi & Pascal Development

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `delphi-developer`** | Skills: `clean-code, delphi-pascal, database-design, api-patterns +1 more`
```

## Task

Build, maintain, or modernize Delphi/Pascal applications.

### Steps:

1. **Project Assessment**
   - Identify Delphi version and framework (VCL/FMX/RTL)
   - Check existing component dependencies
   - Assess legacy patterns (BDE, global state, with-statements)

2. **Architecture Design**
   - Layered: UI → Business Logic → Data Access → Database
   - DataModules for data access
   - Frames for reusable UI blocks
   - Dependency injection (Spring4D)

3. **Implementation**
   - Follow naming conventions (T prefix, F fields, A params)
   - RAII / try-finally for memory management
   - FireDAC for database access
   - DUnitX for testing

4. **Legacy Modernization** (if applicable)
   - BDE → FireDAC migration
   - Global variables → DI
   - God forms → Frames + Services
   - StringList → JSON

---

## Usage Examples

```
/delphi build Windows desktop inventory app
/delphi migrate BDE to FireDAC
/delphi create REST API with DataSnap
/delphi modernize legacy Delphi 7 project
/delphi set up DUnitX test suite
/delphi cross-platform FMX app
```

---

## Caution

- Never use `with` statement — causes ambiguous scope
- Always use try-finally for object cleanup
- Business logic must not live in event handlers
- Test before migrating database layers
