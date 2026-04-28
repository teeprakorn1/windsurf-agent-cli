---
description: Shift-left security coding — input validation, auth patterns, cryptography, and OWASP secure design principles. Used when writing new features or reviewing code for security anti-patterns.
---

# /secure-coding - Secure Code Review & Patterns

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `secure-coder`** | Skills: `clean-code, vulnerability-scanner, api-patterns, code-review-checklist`
```

## Task

Apply security-first coding practices. Prevent vulnerabilities at design time, not after deployment.

### Steps:

1. **Identify Trust Boundaries**
   - Where does user input enter the system?
   - What data crosses network/API boundaries?

2. **Apply Input Validation**
   - Type, length, range, format checks
   - Reject invalid input immediately

3. **Apply Output Encoding**
   - HTML escape before rendering
   - SQL parameterize before querying
   - Shell-quote before system calls

4. **Authentication Review**
   - Password hashing (Argon2id/bcrypt)
   - JWT expiry and rotation
   - RBAC on every route

5. **Cryptography Check**
   - Secure random, not Math.random()
   - AES-256-GCM, RSA-4096
   - Secrets in env, never in repo

---

## Usage Examples

```
/secure-coding review this API endpoint
/secure-coding add input validation to form
/secure-coding harden authentication flow
/secure-coding check for SQL injection risk
/secure-coding implement rate limiting
```

---

## Caution

- Never use eval() or string concat in SQL
- Never log PII, tokens, or passwords
- Always fail securely — deny by default
