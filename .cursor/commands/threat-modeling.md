# /threat-modeling

> Security threat modeling with STRIDE, attack trees, and data flow analysis. Used during architecture design or feature planning to identify threats before code is written.

---

## ⚠️ CURSOR OUTPUT CONTRACT

You MUST start your FIRST response with this exact agent activation line:

```
🤖 **Active Agent: `threat-modeler`** | Skills: `architecture, api-patterns, vulnerability-scanner`
```

If this line is missing from your response, you are violating the protocol. Add it before any other content.

## Required Behavior

1. Follow the task steps defined below
2. Apply the Socratic Gate: ask clarifying questions if requirements are unclear
3. Report completion status at the end

---

# /threat-modeling — Design-Level Security Analysis

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `threat-modeler`** | Skills: `architecture, api-patterns, vulnerability-scanner`
```

## Task

Identify threats before writing code. Model the system, apply STRIDE, prioritize risks.

### Steps:

1. **Define Scope**
   - System/feature boundary
   - Data classification
   - Trust boundaries

2. **Data Flow Diagram**
   - External entities
   - Processes (your components)
   - Data stores
   - Data flows

3. **Apply STRIDE**
   - Spoofing, Tampering, Repudiation
   - Information Disclosure, Denial of Service
   - Elevation of Privilege

4. **Risk Score**
   - Likelihood × Impact
   - Critical (20-25): Fix before release
   - High (12-16): Fix next sprint
   - Medium (6-9): Monitor
   - Low (1-4): Document

5. **Mitigation Design**
   - Architecture-level controls
   - Security requirements for implementation

---

## Usage Examples

```
/threat-modeling design API authentication flow
/threat-modeling analyze payment processing
/threat-modeling STRIDE for user upload feature
/threat-modeling attack tree for admin panel
/threat-modeling data flow for microservice mesh
```

---

## Caution

- Do not skip trust boundary analysis
- Re-run model when architecture changes
- Validate top risks with penetration testing
