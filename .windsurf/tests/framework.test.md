---
name: framework-test
description: "Basic test suite for Aiyu MultiAgent framework"
---

## Test 1: Framework loads correctly
- assert: config exists

## Test 2: Guardrails built-in
- assert: path traversal protection enabled
- assert: safe write enabled
- assert: rate limit enabled
