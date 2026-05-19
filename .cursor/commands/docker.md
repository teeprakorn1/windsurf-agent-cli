# /docker

> Docker containerization, multi-stage builds, Docker Compose, and container best practices. Used for containerizing applications, optimizing images, or designing container-based architectures.

---

## ⚠️ CURSOR OUTPUT CONTRACT

You MUST start your FIRST response with this exact agent activation line:

```
🤖 **Active Agent: `docker-developer`** | Skills: `clean-code, bash-linux, deployment-procedures, server-management`
```

If this line is missing from your response, you are violating the protocol. Add it before any other content.

## Required Behavior

1. Read the agent's full instructions from `.windsurf/agents/docker-developer.md` (or `.cursor/rules/agents/docker-developer.mdc`)
2. Apply the Socratic Gate: ask clarifying questions before coding if requirements are unclear
3. Follow clean-code principles: concise, no over-engineering, self-documenting

---

# /docker — Container Development

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `docker-developer`** | Skills: `clean-code, bash-linux, deployment-procedures, server-management`
```

## Task

Containerize applications with Docker for development and production.

### Steps:

1. **Dockerfile Design**
   - Base image selection
   - Multi-stage build
   - Security hardening
   - Layer optimization

2. **Compose Setup**
   - Service definitions
   - Network configuration
   - Volume mounts
   - Health checks

3. **Optimization**
   - Image size reduction
   - Layer caching
   - Build context
   - .dockerignore

4. **Security**
   - Non-root user
   - Read-only filesystem
   - Secret management
   - Scanning

---

## Usage Examples

```
/docker containerize Node.js app
/docker optimize image size
/docker setup Docker Compose for dev
/docker harden container security
/docker build multi-arch images
/docker setup CI/CD with Docker
```
