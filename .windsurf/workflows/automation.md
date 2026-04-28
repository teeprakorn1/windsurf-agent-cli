---
description: Set up test automation, E2E pipelines, and CI/CD testing. Used for Playwright, Cypress, visual regression, and load testing.
---

# /automation - Test Automation

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `qa-automation-engineer`** | Skills: `webapp-testing, testing-patterns, web-design-guidelines, clean-code +1 more`
```

## Task

Build robust automated testing infrastructure from scratch or enhance existing pipelines.

### Steps:

1. **Assess Current State**
   - Check existing test coverage
   - Identify gaps (unit vs. integration vs. E2E)
   - Review CI/CD pipeline status

2. **Tool Selection**
   - Playwright (preferred): multi-tab, parallel, trace viewer
   - Cypress: component testing, reliable waiting
   - Puppeteer: headless tasks
   - k6 / Artillery: load testing

3. **Test Architecture**
   - Page Object Model (POM) — no raw selectors in tests
   - Data isolation — each test creates its own data
   - Deterministic waits — `expect(locator).toBeVisible()` not `sleep`

4. **Suite Definition**
   - Smoke Suite (P0): login, critical path, checkout — every commit
   - Regression Suite (P1): all stories, edge cases, cross-browser — nightly
   - Visual Regression: snapshot testing for UI shifts

5. **Unhappy Path Automation**
   - Slow network (3G simulation)
   - Server crash (mock 500 mid-flow)
   - Double click / rage clicking
   - Auth expiry during form fill
   - XSS payloads in inputs

---

## Usage Examples

```
/automation setup Playwright from scratch
/automation create E2E suite for checkout flow
/automation add visual regression testing
/automation configure CI test pipeline
/automation write load test for API endpoints
```

---

## Caution

- Never query selectors (`.btn-primary`) in test files — use POM
- Each test must be independent — no reliance on seed data
- Flaky tests are worse than no tests — hunt and fix
