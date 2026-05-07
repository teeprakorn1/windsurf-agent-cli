# Contributing to Aiyu MultiAgent

Thank you for your interest in contributing! This guide covers everything you need to get started.

---

## Quick Start

```bash
# 1. Fork & clone
git clone https://github.com/YOUR_USERNAME/aiyu-multi-agent.git
cd aiyu-multi-agent

# 2. Install dependencies
npm install

# 3. Verify setup
node lib/test/unit/core.test.js
node bin/cli.js test --compliance

# 4. Create a branch
git checkout -b feat/your-feature
```

---

## Development Workflow

### 1. Fork → Branch → PR

1. **Fork** the repository on GitHub
2. **Create a branch** from `main`:
   - `feat/scope` — new features
   - `fix/scope` — bug fixes
   - `refactor/scope` — code refactoring
   - `docs/scope` — documentation only
   - `test/scope` — adding/updating tests
   - `chore/scope` — build, CI, tooling
3. **Make changes** (keep PRs focused — one concern per PR)
4. **Write tests** for your changes
5. **Submit a Pull Request** against `main`

### 2. Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

feat(tool-registry): add maxFiles limit to search.grep
fix(guardrails): add path.normalize to prevent traversal bypass
docs(readme): add v2.1 security section
test(unit): add parseCommandArgs escape sequence tests
refactor(agent-runtime): remove re-exports, use direct imports
chore(ci): add GitHub Actions test workflow
```

**Types:** `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `perf`, `security`

**Rules:**
- Use imperative mood ("add" not "added")
- No period at the end
- Body (optional): explain WHY, not WHAT
- Breaking changes: `feat(scope)!: description` + `BREAKING CHANGE:` in body

### 3. Pull Request Checklist

Before submitting, verify:

- [ ] Tests pass: `node lib/test/unit/core.test.js`
- [ ] Compliance passes: `node bin/cli.js test --compliance`
- [ ] No syntax errors: `node -c <your-file>`
- [ ] Commit messages follow conventional format
- [ ] PR description explains the change and motivation
- [ ] One concern per PR (no unrelated changes)

---

## Code Style

### JavaScript (Node.js)

- **No semicolons** — follow existing project style
- **2-space indentation** — no tabs
- **Single quotes** — `'not "double"'` (except in JSON)
- **No unused variables** — remove or comment out if needed temporarily
- **No over-engineering** — keep it simple, direct, self-documenting
- **No unnecessary comments** — code should explain itself; comments for WHY, not WHAT

### Security Code

When modifying security-related code (`guardrails.js`, `tool-registry.js`):

- **Always add tests** — security fixes without tests are incomplete
- **Never weaken existing checks** — if you need to relax a rule, document WHY
- **Use `execFileSync`** — never `execSync` with `shell: true`
- **Validate inputs** — every tool handler must validate args before execution

### Module Structure

```
lib/
├── api/             # HTTP API server (Express)
├── core/            # Engine modules (no CLI dependencies)
├── commands/        # CLI command handlers (one file per command)
├── mcp/             # MCP server (stdio transport)
├── test/            # Test framework
│   ├── unit/        # Unit tests (one file per module group)
│   ├── smoke/       # API smoke tests
│   └── compliance/  # Spec compliance tests
├── publish/         # Publishing system
└── utils.js         # Shared utilities (single source of truth)
```

**Rules:**
- **No circular imports** — core → utils only, never reverse
- **No re-exports** — import directly from the source module
- **Deduplicate** — if you need a utility, check `lib/utils.js` first
- **Command modules** — each CLI command gets its own file in `lib/commands/`

---

## Testing

### Required Tests

| Change Type | Test Required |
|-------------|---------------|
| Bug fix | Regression test that fails before fix |
| New feature | Unit test + compliance test if spec-relevant |
| Security fix | Security-specific test in `core.test.js` |
| Refactor | Existing tests must still pass |

### Running Tests

```bash
# Unit tests (29 core + 25 production = 54 tests)
node lib/test/unit/core.test.js
node lib/test/unit/production.test.js

# Integration tests (12 tests)
node lib/test/integration/flow.test.js

# Spec compliance (15 checks)
node bin/cli.js test --compliance

# Agent tests (markdown-based)
node bin/cli.js test

# All at once
npm test && node bin/cli.js test --compliance && node bin/cli.js test
```

### Writing Unit Tests

Tests use Node.js built-in `assert` module (no test framework dependency):

```javascript
const assert = require("assert");
const guardrails = require("../../core/guardrails");

await test("description of what is being tested", async () => {
  const result = guardrails.someFunction(input);
  assert.ok(result);                    // truthy check
  assert.strictEqual(result, expected); // strict equality
  assert.deepStrictEqual(a, b);        // deep equality
  assert.throws(() => fn());           // must throw
});
```

### Writing Compliance Tests

Add to `lib/test/compliance.js` following the existing pattern.

---

## Project Architecture

Read `CODEBASE.md` and `docs/ARCHITECTURE-V2.md` for full details.

**Key modules:**
- `lib/core/guardrails.js` — Security layer (pathTraversal, safeWrite, rateLimit, sandboxExec)
- `lib/core/tool-definitions.js` — Tool definitions, schemas, validation, truncation
- `lib/core/llm-providers.js` — OpenAI, Claude, Ollama, Mock providers
- `lib/core/react-loop.js` — ReAct loop with timeout + context trimming
- `lib/core/chat-session.js` — Interactive chat with timeout
- `lib/core/failover.js` — Per-provider circuit breaker + failover chain
- `lib/core/agent-runtime.js` — Re-export (V2.6 decomposed into 8 modules)
- `lib/api/server.js` — HTTP API (Express) with /health, /metrics, /traces, /jobs
- `lib/api/ws.js` — WebSocket real-time streaming + heartbeat
- `lib/api/jobs.js` — Async job model with request-queue integration

---

## Reporting Issues

- **Bugs:** Use the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md)
- **Features:** Use the [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md)
- **Security:** See [SECURITY.md](SECURITY.md) — do NOT file public issues for security vulnerabilities

---

## Questions?

Open a [GitHub Discussion](https://github.com/teeprakorn1/aiyu-multi-agent/discussions) or ask in the issue tracker.

Thank you for contributing! 🙏
