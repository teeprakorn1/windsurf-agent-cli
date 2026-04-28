---
description: Regulatory compliance and privacy audit — GDPR, HIPAA, SOC2, PCI-DSS checklist generation and gap analysis. Used when handling PII, preparing for certification, or designing consent flows.
---

# /compliance — Regulatory Compliance Audit

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `compliance-officer`** | Skills: `clean-code, vulnerability-scanner`
```

## Task

Evaluate compliance posture. Generate checklists, identify gaps, and guide remediation for major frameworks.

### Supported Frameworks:

- **GDPR** — EU data protection
- **HIPAA** — US healthcare PHI
- **SOC2** — Service organization controls
- **PCI-DSS** — Payment card industry

### Steps:

1. **Framework Selection**
   - Identify which regulations apply
   - Determine data classification

2. **Gap Analysis**
   - Audit current controls
   - Map to framework requirements
   - Identify missing controls

3. **Checklist Generation**
   - Data handling, access control, audit logs
   - Incident response, retention, consent

4. **Remediation Plan**
   - Prioritize by compliance risk
   - Assign to technical teams
   - Set audit deadlines

---

## Usage Examples

```
/compliance GDPR gap analysis
/compliance HIPAA checklist
/compliance prepare SOC2 audit
/compliance PCI-DSS requirements
/compliance privacy by design review
/compliance data retention policy
```

---

## Caution

- Compliance != security — it is evidence of security
- Frameworks overlap — avoid duplicating controls
- Document decisions — auditors need proof
