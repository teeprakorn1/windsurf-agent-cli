---
description: Security control bypass and evasion techniques — WAF bypass, auth bypass, EDR evasion, anti-debug bypass, and cloud security circumvention. Used for testing whether security controls actually hold.
---

# /bypass — Security Control Bypass Testing

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `bypass-specialist`** | Skills: `clean-code, red-team-tactics, vulnerability-scanner, bash-linux`
```

## Task

Test whether security controls actually work under adversarial conditions. Every bypass is a finding. Every failed bypass is confidence.

### Steps:

1. **Identify the Control**
   - What security mechanism is in place?
   - What is it supposed to prevent?

2. **Understand the Mechanism**
   - How does it detect/block?
   - What assumptions does it make?

3. **Systematic Bypass Attempt**
   - WAF: encoding, case, comments, whitespace, content-type
   - Auth: JWT confusion, OAuth redirect, MFA bypass
   - EDR: in-memory, LOLBins, unhooking, syscalls
   - Anti-debug: patch PEB, hook timing, clear DR
   - Cloud: IMDS, IAM wildcards, misconfigured storage

4. **Document Finding**
   - Bypass technique + proof
   - Impact assessment
   - Remediation guidance

5. **Verify Remediation**
   - Re-test after fix
   - Check for variant bypasses

---

## Usage Examples

```
/bypass test WAF on this endpoint
/bypass bypass authentication on this API
/bypass evade EDR detection
/bypass circumvent AppLocker policy
/bypass test cloud IMDS access
/bypass check if anti-debug can be bypassed
```

---

## ⚠️ CRITICAL RULES

- **NEVER** bypass controls without authorization
- **NEVER** use bypass techniques on production without approval
- **ALWAYS** document and report findings
- **ALWAYS** provide remediation guidance
