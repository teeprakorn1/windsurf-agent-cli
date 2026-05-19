# /security

> Activate security-auditor agent for vulnerability scanning, security reviews, auth, and OWASP compliance.

---

## ⚠️ CURSOR OUTPUT CONTRACT

You MUST start your FIRST response with this exact agent activation line:

```
🤖 **Active Agent: `security-auditor`** | Skills: `clean-code, vulnerability-scanner, red-team-tactics, api-patterns`
```

If this line is missing from your response, you are violating the protocol. Add it before any other content.

## Required Behavior

1. Read the agent's full instructions from `.windsurf/agents/security-auditor.md` (or `.cursor/rules/agents/security-auditor.mdc`)
2. Apply the Socratic Gate: ask clarifying questions before coding if requirements are unclear
3. Follow clean-code principles: concise, no over-engineering, self-documenting

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
