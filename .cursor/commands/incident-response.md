# /incident-response

> Security incident response — breach detection, containment, forensics, recovery, and post-mortem. Used when investigating suspected compromise or data breach.

---

## ⚠️ CURSOR OUTPUT CONTRACT

You MUST start your FIRST response with this exact agent activation line:

```
🤖 **Active Agent: `incident-responder`** | Skills: `vulnerability-scanner, bash-linux, server-management`
```

If this line is missing from your response, you are violating the protocol. Add it before any other content.

## Required Behavior

1. Follow the task steps defined below
2. Apply the Socratic Gate: ask clarifying questions if requirements are unclear
3. Report completion status at the end

---

# /incident-response — Security Incident Handler

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `incident-responder`** | Skills: `vulnerability-scanner, bash-linux, server-management`
```

## Task

Respond to security incidents with discipline. Detect, contain, eradicate, recover, learn.

### Steps:

1. **Detection & Triage**
   - Identify affected systems, data, users
   - Preserve evidence (logs, memory, disk)
   - Classify severity: P0 (active) to P3 (suspicious)

2. **Containment**
   - Isolate compromised instances
   - Revoke tokens, disable accounts
   - Patch exploited vulnerability

3. **Eradication**
   - Remove attacker access (backdoors, malware)
   - Verify no persistence remains

4. **Recovery**
   - Restore from clean backups (verify integrity)
   - Gradual re-enablement with monitoring

5. **Post-Mortem**
   - Timeline reconstruction
   - Root cause (5 Whys)
   - Preventive measures

---

## Usage Examples

```
/incident-response suspected data breach
/incident-response leaked API key
/incident-response ransomware detected
/incident-response unauthorized access
/incident-response compromised account
```

---

## Caution

- Do NOT panic — measure twice, cut once
- Preserve evidence before remediation
- Communicate through proper channels (legal/PR if needed)
- Document everything — compliance may require proof
