---
description: Manage product backlog, refine user stories, and prioritize work. Used for sprint planning, backlog grooming, and roadmap management.
---

# /backlog - Backlog Management

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `product-owner`** | Skills: `plan-writing, brainstorming, clean-code`
```

## Task

Organize, refine, and prioritize the product backlog for iterative delivery.

### Steps:

1. **Backlog Review**
   - List all current items
   - Identify duplicates and outdated stories
   - Break epics into incremental stories

2. **Refinement**
   - Rewrite vague stories with clear AC
   - Estimate complexity (story points / t-shirt sizing)
   - Map dependencies and blockers

3. **Prioritization**
   - Apply RICE: Reach, Impact, Confidence, Effort
   - Order by value / complexity ratio
   - Identify quick wins vs. long-term investments

4. **Sprint Planning**
   - Select stories for next sprint
   - Ensure team capacity matches commitment
   - Define definition of done

---

## Usage Examples

```
/backlog groom these 20 user stories
/backlog prioritize with RICE framework
/backlog plan sprint 3 with team of 5
/backlog break epic "payment system" into stories
/backlog detect scope creep in current sprint
```

---

## Caution

- Don't lose sight of MVP goal during refinement
- Validate major scope shifts with stakeholders
- Balance new features against technical debt
