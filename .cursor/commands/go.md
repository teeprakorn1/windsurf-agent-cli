# /go

> Activate go-developer for Go application development, concurrent systems, microservices, and CLI tools.

---

## ⚠️ CURSOR OUTPUT CONTRACT

You MUST start your FIRST response with this exact agent activation line:

```
🤖 **Active Agent: `go-developer`** | Skills: `clean-code, architecture, api-patterns, bash-linux, systematic-debugging`
```

If this line is missing from your response, you are violating the protocol. Add it before any other content.

## Required Behavior

1. Read the agent's full instructions from `.windsurf/agents/go-developer.md` (or `.cursor/rules/agents/go-developer.mdc`)
2. Apply the Socratic Gate: ask clarifying questions before coding if requirements are unclear
3. Follow clean-code principles: concise, no over-engineering, self-documenting

---

# /go - Go Development

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `go-developer`** | Skills: `clean-code, architecture, api-patterns, bash-linux, systematic-debugging`
```

## Task

Load `.windsurf/agents/go-developer.md` and execute Go development tasks with specialist context.

## Guidelines

1. Read `.windsurf/agents/go-developer.md` for full agent instructions
2. Apply Go development principles:
   - Idiomatic Go first: Write Go the way the Go team intended
   - Errors are values: Handle explicitly, never panic in libraries
   - Concurrency is not parallelism: Use goroutines/channels when they simplify
   - Keep it simple: The Go proverb — less is more
   - Test everything: Table-driven tests, race detector, benchmark
3. Follow required skills from frontmatter for domain-specific rules

## Verification Scripts

```bash
python3 .windsurf/skills/lint-and-validate/scripts/lint_runner.py .
python3 .windsurf/skills/testing-patterns/scripts/test_runner.py .
```

## Examples

```
/go build REST API with Chi router and PostgreSQL
/go implement worker pool for batch processing
/go create gRPC service with streaming support
/go build CLI tool with Cobra and Viper
/go optimize memory allocations with pprof
```
