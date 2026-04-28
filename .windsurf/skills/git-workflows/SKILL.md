---
name: git-workflows
description: Git branching strategies, commit conventions, and collaborative development workflows
allowed-tools: Read, Write, Edit, Bash
version: 1.0
priority: HIGH
---

# Git Workflows - Version Control Best Practices

> Clean history, clear intent, collaborative development.

---

## Branching Strategies

### Git Flow

```
main        ●────────────────────────●
             ╲                      ╱
develop       ●──●──●──●──●──●──●──●
               ╲    ╲      ╱    ╱
feature/A       ●────●────●      ╱
feature/B             ●────●────●
hotfix                      ●──●
```

| Branch | Purpose | Lifetime |
|--------|---------|----------|
| `main` | Production-ready code | Permanent |
| `develop` | Integration branch | Permanent |
| `feature/*` | New features | Temporary |
| `release/*` | Release preparation | Temporary |
| `hotfix/*` | Urgent production fixes | Temporary |

### Trunk-Based Development

```
main    ●──●──●──●──●──●──●──●──●──●──●
         ╲    ╲    ╲    ╲    ╲    ╲
PR        ●────●   ●────●   ●────●
```

- Short-lived feature branches (< 1 day)
- Continuous integration to `main`
- Feature flags for incomplete features

---

## Commit Conventions

### Conventional Commits

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation only
- `style:` — Formatting, no code change
- `refactor:` — Code restructuring
- `test:` — Adding/updating tests
- `chore:` — Build, dependencies

**Examples:**

```bash
feat(auth): add OAuth2 login with Google

fix(api): resolve null pointer in user validation

refactor(database): migrate from MongoDB to PostgreSQL

BREAKING CHANGE: removed deprecated v1 endpoints
```

### Commit Best Practices

| ✅ DO | ❌ DON'T |
|-------|----------|
| Write in imperative mood | "Fixed bug" → "Fix bug" |
| Keep subject under 50 chars | Long, rambling descriptions |
| Reference issues | No context about why |
| Separate subject from body | Everything in one line |

---

## Pull Request Workflow

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
```

### Review Process

1. **Author**: Create PR, fill template, request review
2. **Reviewer**: Review within 24 hours
3. **CI**: Automated tests must pass
4. **Approval**: Minimum 1 approval (2 for critical)
5. **Merge**: Squash or merge commit based on strategy

---

## Git Commands

### Daily Workflow

```bash
# Start new feature
git checkout -b feature/user-authentication

# Make changes, commit
git add .
git commit -m "feat(auth): implement JWT token generation"

# Sync with main
git fetch origin
git rebase origin/main

# Push and create PR
git push -u origin feature/user-authentication

# After merge, cleanup
git checkout main
git pull
git branch -d feature/user-authentication
```

### Fixing Mistakes

```bash
# Amend last commit
git commit --amend -m "fix: correct typo in commit message"

# Interactive rebase
git rebase -i HEAD~3

# Revert specific commit
git revert abc123

# Reset to specific state (dangerous!)
git reset --hard HEAD~1
```

---

## Verification Checklist

- [ ] Commit messages follow convention
- [ ] Branch naming is consistent
- [ ] PR has sufficient description
- [ ] Code reviewed before merge
- [ ] CI/CD passes before merge
- [ ] Branch deleted after merge
- [ ] Main branch always deployable

---

> 🌿 **Remember:** Clear commits are a gift to your future self and teammates.
