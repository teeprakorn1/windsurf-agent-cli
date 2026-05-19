# /finops

> Cloud cost optimization, budget governance, and FinOps practices. Used when cloud bills are too high or when setting up cost accountability.

---

## ⚠️ CURSOR OUTPUT CONTRACT

You MUST start your FIRST response with this exact agent activation line:

```
🤖 **Active Agent: `finops-analyst`** | Skills: `clean-code, architecture, server-management`
```

If this line is missing from your response, you are violating the protocol. Add it before any other content.

## Required Behavior

1. Follow the task steps defined below
2. Apply the Socratic Gate: ask clarifying questions if requirements are unclear
3. Report completion status at the end

---

# /finops — Cloud Cost Optimization

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `finops-analyst`** | Skills: `clean-code, architecture, server-management`
```

## Task

Optimize cloud spending, identify waste, and implement cost governance.

### Steps:

1. **Cost Visibility**
   - Map current spending by service/team/environment
   - Identify top cost drivers
   - Check tagging coverage

2. **Waste Identification**
   - Idle resources (unattached disks, stopped instances)
   - Over-provisioned resources
   - Old snapshots and unused storage
   - Cross-region data transfer fees

3. **Optimization Actions**
   - Right-size instances
   - Purchase reserved/committed for steady workloads
   - Schedule non-prod environments (off-hours shutdown)
   - Implement lifecycle policies on storage

4. **Governance Setup**
   - Budget alerts by team/environment
   - Tagging policy enforcement
   - Chargeback model design
   - Cost anomaly detection

5. **Reporting**
   - Monthly cost report
   - Savings realized tracking
   - Forecast vs actual

---

## Usage Examples

```
/finops audit AWS spending this month
/finops identify wasted cloud resources
/finops right-size our EC2 instances
/finops set up budget alerts by team
/finops design chargeback model
/finops optimize storage costs
```
