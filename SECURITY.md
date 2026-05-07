# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 2.7.x   | ✅ Active |
| 2.6.x   | ✅ Active |
| 2.5.x   | ✅ Active |
| 2.4.x   | ⚠️ Critical fixes only |
| < 2.4   | ❌ End of life |

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
| 2.7.1 | Failover chain mutation fix, handoff catch block scope fix, chat session timeout, circuit breaker cleanup, tracing cleanup timer, cache key collision fix |
| 2.7.0 | plan.create/memory.save path traversal fix, WS timer leak fix, agentStatuses TTL cleanup, sensitiveRouteAuth for /agents/statuses |
| 2.6.0 | fetch.url SSRF protection (DNS + private IP block), WS maxPayload 1MB + perMessageDeflate:false, WS heartbeat + stale connection termination, WS handleRun/handleChatSend 5min timeout, sensitiveRouteAuth for /traces + /metrics, security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, HSTS), WS terminateAllConnections on shutdown |
| 2.5.1 | Per-provider circuit breaker keys, rate limit hard cap + X-Forwarded-For spoofing fix, cache freeze-on-fallback, LLM retry off-by-one fix |
| 2.4.1 | BLOCKED_FLAGS bypass fix, sandboxExec `path.basename`, rateLimits Map unbounded growth fix, safeWrite temp file leak, ReDoS protection, truncateResult deep clone, glob regex metacharacter escaping, maxSteps hard cap, API /jobs validation, secret scanning in publish |
| 2.4.0 | MCP host authorization, secret scanning in publish, rate limiting middleware, graceful shutdown |
| 2.2.0 | Symlink traversal attack fix, init.js guardrails bypass fix, circuit breaker null state guard, safeWrite temp file leak fix, queue operations after destroy guard |
| 2.1.0 | Command injection fix, path traversal fix, removed curl/wget, dangerous pattern detection |
| 2.0.0 | Initial security layer (guardrails, sandboxExec, safeWrite, rateLimit) |
