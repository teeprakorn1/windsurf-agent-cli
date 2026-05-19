# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 2.7.x   | ✅ Active |
| 2.6.x   | ✅ Active |
| 2.5.x   | ✅ Active |
| 2.4.x   | ⚠️ Critical fixes only |
| < 2.4   | ❌ End of life |

## Reporting a vulnerability

**⚠️ Do NOT file a public GitHub issue for security vulnerabilities.**

### How to report

1. **Email:** Send details to the maintainers via GitHub's private vulnerability reporting:
   - Go to [Security tab](https://github.com/teeprakorn1/aiyu-multi-agent/security)
   - Click "Report a vulnerability"

2. **Include:**
   - Description of the vulnerability
   - Steps to reproduce
   - Affected versions
   - Potential impact
   - Suggested fix (if any)

### Response timeline

| Stage | Target Time |
|-------|-------------|
| Acknowledgment | 48 hours |
| Initial assessment | 5 business days |
| Fix development | 14 business days (critical), 30 days (high) |
| Advisory published | After fix is released |

### What we consider security issues

Given this project involves **AI agent execution with shell access**, we take these especially seriously:

- **Command injection** in `shell.exec` or any tool handler
- **Path traversal** bypass in `guardrails.pathTraversal`
- **Arbitrary file read/write** via tool arguments
- **Rate limit bypass** enabling DoS
- **Permission escalation** in plugin system
- **Supply chain** risks in dependencies

### What we do NOT consider security issues

- LLM prompt injection (inherent to AI systems, not a code vulnerability)
- Missing features (e.g., "should add sandboxing for X")
- Configuration errors by the user

## Security architecture

This project implements defense-in-depth for shell execution:

1. **Whitelist-only** — Only approved commands can run (`ALLOWED_COMMANDS`)
2. **No shell** — `execFileSync` with parsed args (no `shell: true`)
3. **Arg parsing** — `parseCommandArgs` with escape sequence support
4. **Pattern detection** — Blocks command substitution (`$()`, `` ` ``) and destructive commands
5. **Path validation** — `pathTraversal()` with `path.normalize()`, explicit `projectRoot`, and `fs.realpathSync()` for symlink resolution
6. **File limits** — `maxFileSize`, `maxFiles`, `maxDepth` prevent OOM
7. **Rate limiting** — Prevents abuse of tool calls
8. **Result truncation** — 100KB limit prevents memory exhaustion

## Security changelog

For the full security fix history, see [CHANGELOG.md](CHANGELOG.md).

Key security fixes by version:

| Version | Key fix |
|---------|--------|
| 2.7.x | CLI engine spawn safety, artifact write path validation, quality gate enforcement |
| 2.6.x | SSRF protection, WS hardening, security headers, sensitive route auth |
| 2.5.x | Per-provider circuit breaker, rate limit hard cap, X-Forwarded-For spoofing fix |
| 2.4.x | BLOCKED_FLAGS bypass, sandboxExec hardening, secret scanning, ReDoS protection |
| 2.2.x | Symlink traversal fix, safeWrite temp file leak, queue destroy guard |
| 2.1.x | Command injection fix, path traversal fix, dangerous pattern detection |
| 2.0.x | Initial security layer (guardrails, sandboxExec, safeWrite, rateLimit) |
