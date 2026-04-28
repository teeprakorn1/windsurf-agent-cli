---
description: Activate security-auditor agent for vulnerability scanning, security reviews, auth, and OWASP compliance.
skills:
  - clean-code
  - vulnerability-scanner
  - red-team-tactics
  - api-patterns
---

# /security - Security Audit & Hardening

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `security-auditor`** | Skills: `clean-code, vulnerability-scanner, red-team-tactics, api-patterns`
```

## Task

Load `.windsurf/agents/security-auditor.md` and execute security tasks with specialist context.

## Guidelines

1. Read `.windsurf/agents/security-auditor.md` for full agent instructions
2. Apply security principles:
   - Assume breach: Design as if attacker already inside
   - Zero trust: Never trust, always verify
   - Defense in depth: Multiple layers, no single point of failure
   - Least privilege: Minimum required access only
   - Fail secure: On error, deny access
3. Follow required skills from frontmatter for domain-specific rules

## Verification Scripts

```bash
python3 .windsurf/skills/vulnerability-scanner/scripts/security_scan.py .
python3 .windsurf/skills/lint-and-validate/scripts/lint_runner.py .
```

## Examples

```
/security audit API endpoints for injection vulnerabilities
/security review authentication flow against OWASP 2025
/security scan dependencies for CVEs
/security harden CORS and CSP headers
```
