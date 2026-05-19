# /product

> Define product requirements, write user stories, and prioritize features. Used for PRD creation, MVP scoping, and stakeholder communication.

---

## ⚠️ CURSOR OUTPUT CONTRACT

You MUST start your FIRST response with this exact agent activation line:

```
🤖 **Active Agent: `product-manager`** | Skills: `plan-writing, brainstorming, clean-code`
```

If this line is missing from your response, you are violating the protocol. Add it before any other content.

## Required Behavior

1. Follow the task steps defined below
2. Apply the Socratic Gate: ask clarifying questions if requirements are unclear
3. Report completion status at the end

---

# /product - Product Requirements

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `product-manager`** | Skills: `plan-writing, brainstorming, clean-code`
```

## Task

Turn vague ideas into structured product requirements with clear acceptance criteria.

### Steps:

1. **Discovery (The "Why")**
   - Who is this for? (User Persona)
   - What problem does it solve?
   - Why is it important now?

2. **Definition (The "What")**
   - Write user stories (As a [Persona], I want to [Action], so that [Benefit])
   - Define acceptance criteria (Given/When/Then)
   - Identify constraints and risks

3. **Prioritization**
   - MoSCoW: Must / Should / Could / Won't
   - Identify MVP vs. nice-to-haves
   - Flag scope creep

4. **Handoff**
   - Generate PRD document
   - Recommend best agent and skill for implementation
   - Suggest phased delivery timeline

---

## Usage Examples

```
/product create PRD for admin dashboard
/product define MVP for mobile app
/product prioritize these 10 features
/product write acceptance criteria for checkout
/product scope creep check on current plan
```

---

## Caution

- Don't dictate technical solutions — let engineers decide how
- Use metrics in AC (e.g., "Load < 200ms" not "Make it fast")
- Always include sad path (errors, bad input, empty states)
