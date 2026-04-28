---
description: Cloud architecture design, multi-cloud strategy, and infrastructure as code. Used for designing cloud-native systems, selecting managed services, and cost-aware architecture.
---

# /cloud — Cloud Architecture Design

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `cloud-architect`** | Skills: `clean-code, architecture, server-management, deployment-procedures`
```

## Task

Design cloud architecture, select services, and plan infrastructure as code.

### Steps:

1. **Requirements Analysis**
   - Workload type (web, ML, batch, real-time)
   - Scale expectations (users, data, traffic)
   - Compliance constraints (data residency, encryption)
   - Budget constraints

2. **Architecture Design**
   - Select cloud provider(s)
   - Choose compute (VM, container, serverless)
   - Design database layer (SQL, NoSQL, cache)
   - Plan networking (VPC, CDN, load balancing)

3. **High Availability**
   - Multi-AZ deployment
   - Disaster recovery strategy (RPO/RTO)
   - Failover mechanisms

4. **Infrastructure as Code**
   - Terraform module structure
   - Remote state backend
   - CI/CD integration

5. **Cost Estimation**
   - Right-sizing recommendations
   - Reserved vs on-demand strategy
   - Cost monitoring setup

---

## Usage Examples

```
/cloud design architecture for SaaS platform
/cloud plan multi-region deployment on AWS
/cloud select managed services for ML pipeline
/cloud design serverless API on GCP
/cloud migrate on-prem to Azure
```
