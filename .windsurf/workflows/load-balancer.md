---
description: Activate load-balancer-specialist for traffic distribution, high availability, and scalable infrastructure configuration.
skills:
  - clean-code
  - architecture
  - bash-linux
  - deployment-procedures
  - systematic-debugging
---

# /load-balancer - Load Balancing

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `load-balancer-specialist`** | Skills: `clean-code, architecture, bash-linux, deployment-procedures, systematic-debugging`
```

## Task

Load `.windsurf/agents/load-balancer-specialist.md` and execute load balancing tasks with specialist context.

## Guidelines

1. Read `.windsurf/agents/load-balancer-specialist.md` for full agent instructions
2. Apply load balancing principles:
   - Health checks are critical: No traffic to unhealthy backends
   - Distribute intelligently: Consider latency, capacity, geography
   - Session affinity when needed: Sticky sessions for stateful applications
   - SSL termination properly: Centralized TLS with security best practices
   - Monitor everything: Connection counts, error rates, latency distributions
3. Follow required skills from frontmatter for domain-specific rules

## Verification Scripts

```bash
python3 .windsurf/skills/lint-and-validate/scripts/lint_runner.py .
python3 .windsurf/skills/testing-patterns/scripts/test_runner.py .
```

## Examples

```
/load-balancer configure nginx reverse proxy with upstream backend
/load-balancer setup HAProxy with health checks and failover
/load-balancer implement sticky sessions for stateful application
/load-balancer design multi-region load balancing with Route53
/load-balancer optimize SSL termination and certificate management
```
