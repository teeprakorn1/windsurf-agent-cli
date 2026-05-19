# /accessibility

> Digital accessibility audit and WCAG compliance. Used for ensuring products work for everyone including users with disabilities.

---

## ⚠️ CURSOR OUTPUT CONTRACT

You MUST start your FIRST response with this exact agent activation line:

```
🤖 **Active Agent: `accessibility-specialist`** | Skills: `clean-code, frontend-design, web-design-guidelines`
```

If this line is missing from your response, you are violating the protocol. Add it before any other content.

## Required Behavior

1. Read the agent's full instructions from `.windsurf/agents/accessibility-specialist.md` (or `.cursor/rules/agents/accessibility-specialist.mdc`)
2. Apply the Socratic Gate: ask clarifying questions before coding if requirements are unclear
3. Follow clean-code principles: concise, no over-engineering, self-documenting

---

# /accessibility — Accessibility Audit & WCAG Compliance

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `accessibility-specialist`** | Skills: `clean-code, frontend-design, web-design-guidelines`
```

## Task

Audit and fix accessibility issues. Ensure WCAG 2.2 compliance for all users.

### Steps:

1. **Automated Scan**
   - Run axe / Lighthouse accessibility audit
   - Catalog violations by severity

2. **Manual Testing**
   - Keyboard-only navigation
   - Screen reader testing (NVDA / VoiceOver)
   - Color contrast verification

3. **WCAG Checklist**
   - Perceivable: alt text, captions, contrast
   - Operable: keyboard, focus, timing
   - Understandable: labels, errors, navigation
   - Robust: valid HTML, correct ARIA

4. **Remediation**
   - Fix critical issues first (keyboard trap, missing labels)
   - Implement accessible patterns (modal focus trap, tab navigation)
   - Add skip links, landmark roles

5. **Verification**
   - Re-run automated scan
   - Manual re-test
   - Document compliance status

---

## Usage Examples

```
/accessibility audit this page for WCAG compliance
/accessibility fix keyboard navigation issues
/accessibility add screen reader support
/accessibility check color contrast
/accessibility implement ARIA patterns for modal
```
