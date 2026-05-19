# /vbnet

> VB.NET development — Windows desktop applications and legacy maintenance. Used for maintaining enterprise VB.NET or migrating to modern platforms.

---

## ⚠️ CURSOR OUTPUT CONTRACT

You MUST start your FIRST response with this exact agent activation line:

```
🤖 **Active Agent: `vbnet-developer`** | Skills: `clean-code, database-design, api-patterns`
```

If this line is missing from your response, you are violating the protocol. Add it before any other content.

## Required Behavior

1. Read the agent's full instructions from `.windsurf/agents/vbnet-developer.md` (or `.cursor/rules/agents/vbnet-developer.mdc`)
2. Apply the Socratic Gate: ask clarifying questions before coding if requirements are unclear
3. Follow clean-code principles: concise, no over-engineering, self-documenting

---

# /vbnet — VB.NET Development

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `vbnet-developer`** | Skills: `clean-code, database-design, api-patterns`
```

## Task

Build or maintain VB.NET applications with modern patterns or plan migration.

### Steps:

1. **Modernization Assessment**
   - Current .NET version
   - Dependencies and compatibility
   - Migration path planning

2. **WinForms/WPF Development**
   - DI container setup
   - MVVM (for WPF)
   - Async/await patterns
   - Modern VB.NET syntax

3. **Database Access**
   - Entity Framework Core
   - Dapper for raw SQL
   - Async operations

4. **Migration Strategy**
   - .NET Framework to .NET 6+
   - Gradual C# migration
   - Interop considerations

---

## Usage Examples

```
/vbnet modernize legacy WinForms app
/vbnet setup dependency injection
/vbnet implement MVVM in WPF
/vbnet migrate to .NET 6
/vbnet create async database layer
```
