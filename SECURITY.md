# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 2.1.x   | ✅ Active |
| 2.0.x   | ⚠️ Critical fixes only |
| < 2.0   | ❌ End of life |

## Reporting a Vulnerability

**⚠️ Do NOT file a public GitHub issue for security vulnerabilities.**

### How to Report

1. **Email:** Send details to the maintainers via GitHub's private vulnerability reporting:
   - Go to [Security tab](https://github.com/teeprakorn1/aiyu-multi-agent/security)
   - Click "Report a vulnerability"

2. **Include:**
   - Description of the vulnerability
   - Steps to reproduce
   - Affected versions
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

| Stage | Target Time |
|-------|-------------|
| Acknowledgment | 48 hours |
| Initial assessment | 5 business days |
| Fix development | 14 business days (critical), 30 days (high) |
| Advisory published | After fix is released |

### What We Consider Security Issues

Given this project involves **AI agent execution with shell access**, we take these especially seriously:

- **Command injection** in `shell.exec` or any tool handler
- **Path traversal** bypass in `guardrails.pathTraversal`
- **Arbitrary file read/write** via tool arguments
- **Rate limit bypass** enabling DoS
- **Permission escalation** in plugin system
- **Supply chain** risks in dependencies

### What We Do NOT Consider Security Issues

- LLM prompt injection (inherent to AI systems, not a code vulnerability)
- Missing features (e.g., "should add sandboxing for X")
- Configuration errors by the user

## Security Architecture

This project implements defense-in-depth for shell execution:

1. **Whitelist-only** — Only approved commands can run (`ALLOWED_COMMANDS`)
2. **No shell** — `execFileSync` with parsed args (no `shell: true`)
3. **Arg parsing** — `parseCommandArgs` with escape sequence support
4. **Pattern detection** — Blocks command substitution (`$()`, `` ` ``) and destructive commands
5. **Path validation** — `pathTraversal()` with `path.normalize()` and explicit `projectRoot`
6. **File limits** — `maxFileSize`, `maxFiles`, `maxDepth` prevent OOM
7. **Rate limiting** — Prevents abuse of tool calls
8. **Result truncation** — 100KB limit prevents memory exhaustion

## Security Changelog

| Version | Fix |
|---------|-----|
| 2.1.0 | Command injection fix (execFileSync), path traversal fix (path.normalize), removed curl/wget, dangerous pattern detection |
| 2.0.0 | Initial security layer (guardrails, sandboxExec, safeWrite, rateLimit) |
