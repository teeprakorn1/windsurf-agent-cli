# /protocol

> API protocol selection, communication design, and MCP server building. Used when choosing between REST, GraphQL, gRPC, tRPC, WebSocket, SSE, or building MCP integrations.

---

## ⚠️ CURSOR OUTPUT CONTRACT

You MUST start your FIRST response with this exact agent activation line:

```
🤖 **Active Agent: `protocol-architect`** | Skills: `clean-code, api-patterns, mcp-builder, architecture +1 more`
```

If this line is missing from your response, you are violating the protocol. Add it before any other content.

## Required Behavior

1. Follow the task steps defined below
2. Apply the Socratic Gate: ask clarifying questions if requirements are unclear
3. Report completion status at the end

---

# /protocol — Protocol & Communication Design

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `protocol-architect`** | Skills: `clean-code, api-patterns, mcp-builder, architecture +1 more`
```

## Task

Select the right protocol, design the API contract, and build communication architecture — including MCP servers for AI tool integration.

### Steps:

1. **Requirements Analysis**
   - Who consumes this API? (public, internal, frontend, AI)
   - What patterns? (CRUD, real-time, streaming, event-driven)
   - What constraints? (latency, bandwidth, type safety)

2. **Protocol Selection**
   - REST → public CRUD APIs
   - GraphQL → complex queries, multi-entity
   - gRPC → microservices, high throughput
   - tRPC → TypeScript full-stack
   - WebSocket → bidirectional real-time
   - SSE → server push, simple
   - Message Queue → async, decoupled

3. **Contract Design**
   - Define schema (OpenAPI / GraphQL SDL / Protobuf / Zod)
   - Design error format
   - Plan auth strategy
   - Set versioning policy

4. **MCP Server (if AI integration)**
   - Define tools with JSON Schema
   - Implement handlers
   - Add resources for static data
   - Configure transport (stdio / SSE)

5. **Validation**
   - Security review (auth, rate limit, input validation)
   - Performance test (latency, throughput)
   - Client SDK generation

---

## Usage Examples

```
/protocol design API for e-commerce platform
/protocol choose between REST and GraphQL
/protocol build MCP server for database access
/protocol design real-time notification system
/protocol migrate REST to gRPC
/protocol add WebSocket to existing REST API
```

---

## Caution

- Never choose a protocol because it is trendy — choose by requirements
- REST is the safe default; deviate only with clear justification
- Real-time protocols need reconnection and error recovery strategies
- MCP servers must validate all inputs — AI models can send unexpected data
