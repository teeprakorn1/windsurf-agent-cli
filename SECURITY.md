# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 2.4.x   | ✅ Active |
| 2.3.x   | ✅ Active |
| 2.2.x   | ⚠️ Critical fixes only |
| < 2.2   | ❌ End of life |

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
5. **Path validation** — `pathTraversal()` with `path.normalize()`, explicit `projectRoot`, and `fs.realpathSync()` for symlink resolution
6. **File limits** — `maxFileSize`, `maxFiles`, `maxDepth` prevent OOM
7. **Rate limiting** — Prevents abuse of tool calls
8. **Result truncation** — 100KB limit prevents memory exhaustion

## Security Changelog

| Version | Fix |
|---------|-----|
| 2.4.1 | BLOCKED_FLAGS bypass fix (`--eval=code`, `-ecode` patterns), `_isBlockedFlag()`, sandboxExec `path.basename` for full paths, rateLimits Map unbounded growth fix (time-based cleanup), safeWrite temp file leak on writeFileSync failure, ReDoS protection (`_safeRegex`), truncateResult deep clone (mutation prevention), glob regex metacharacter escaping, fs.glob fallback depth limit (stack overflow fix), maxSteps hard cap (MAX_ALLOWED_STEPS=50), API /jobs agent_name validation + max_steps validation, rate limit X-Forwarded-For support, secret scanning in publish (OpenAI/AWS/GitHub/npm/Slack keys) |
| 2.4.0 | MCP host authorization (allowedAgents), secret scanning in publish, rate limiting middleware, graceful shutdown |
| 2.2.0 | Symlink traversal attack fix (fs.realpathSync), init.js guardrails bypass fix (safeWrite), circuit breaker null state guard, JSON.stringify circular ref crash fix, safeWrite temp file leak fix, publish dry-run temp file leak fix, queue operations after destroy guard |
| 2.1.0 | Command injection fix (execFileSync), path traversal fix (path.normalize), removed curl/wget, dangerous pattern detection |
| 2.0.0 | Initial security layer (guardrails, sandboxExec, safeWrite, rateLimit) |
