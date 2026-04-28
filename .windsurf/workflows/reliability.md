---
description: Site reliability engineering — SLO definition, alerting setup, chaos engineering, and incident prevention. Used for building reliable systems and managing error budgets.
---

# /reliability — Site Reliability Engineering

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `sre`** | Skills: `clean-code, server-management, bash-linux, performance-profiling`
```

## Task

Define reliability targets, build alerting, prevent incidents, and run chaos experiments.

### Steps:

1. **SLO Definition**
   - Define SLIs (availability, latency, error rate)
   - Set SLOs (stricter than SLA)
   - Calculate error budget

2. **Alerting Setup**
   - SLO burn rate alerts
   - Severity classification (P1-P4)
   - On-call rotation design

3. **Reliability Patterns**
   - Circuit breakers + retry logic
   - Canary deployment strategy
   - Graceful degradation

4. **Chaos Engineering**
   - Define steady-state hypothesis
   - Inject failure (kill pod, add latency, partition network)
   - Observe + document response

5. **Post-Mortem**
   - Blameless timeline reconstruction
   - Root cause analysis
   - Action items with owners + deadlines

---

## Usage Examples

```
/reliability define SLOs for API service
/reliability setup alerting for error budget
/reliability run chaos experiment on payment service
/reliability design canary deployment strategy
/reliability write post-mortem for last incident
```
