# Skill Index — Sub-Agent Kit

> Mapping of Skills and their Agents

---

## 🔢 Overall Statistics

| Type | Count |
|--------|-------|
| Agents | 79 |
| Skills | 46 |
| Workflows | 78 |

---

## 📋 Skill → Agent Mapping

### Core Skills (most used)

| Skill | Agents Count | Agents |
|-------|-------------------|--------|
| `clean-code` | 20 | **Every Agent** (too general — consider reducing) |
| `lint-and-validate` | 5 | frontend-specialist, qa-automation-engineer, devops-engineer, test-engineer, seo-specialist |
| `brainstorming` | 5 | backend-specialist, devops-engineer, explorer-agent, project-planner, documentation-writer |
| `plan-writing` | 5 | product-manager, product-owner, database-architect, devops-engineer, project-planner |
| `api-patterns` | 3 | backend-specialist, mobile-developer, security-auditor |
| `bash-linux` | 3 | backend-specialist, devops-engineer, debugger |

### Domain-Specific Skills

| Skill | Agents | Domain |
|-------|-------------|--------|
| `nextjs-react-expert` | 1 | frontend-specialist |
| `tailwind-patterns` | 1 | frontend-specialist |
| `frontend-design` | 1 | frontend-specialist |
| `web-design-guidelines` | 1 | frontend-specialist, qa-automation-engineer |
| `mobile-design` | 1 | mobile-developer |
| `database-design` | 2 | database-architect, backend-specialist |
| `vulnerability-scanner` | 2 | security-auditor, penetration-tester |
| `red-team-tactics` | 2 | security-auditor, penetration-tester |
| `testing-patterns` | 2 | test-engineer, qa-automation-engineer |
| `tdd-workflow` | 1 | test-engineer |
| `webapp-testing` | 2 | test-engineer, qa-automation-engineer |
| `performance-profiling` | 1 | performance-optimizer |
| `seo-fundamentals` | 1 | seo-specialist |
| `nodejs-best-practices` | 1 | backend-specialist |
| `python-patterns` | 1 | backend-specialist |
| `rust-pro` | 1 | backend-specialist |
| `server-management` | 2 | devops-engineer, backend-specialist |
| `deployment-procedures` | 1 | devops-engineer |
| `mcp-builder` | 1 | (no direct agent) |
| `geo-fundamentals` | 1 | (no direct agent) |

### Game Development Skills (Sub-skills)
| Skill | Agent |
|-------|-------------|
| `game-development` | game-developer |
| `game-development/2d-games` | game-developer |
| `game-development/3d-games` | game-developer |
| `game-development/mobile-games` | game-developer |
| `game-development/pc-games` | game-developer |
| `game-development/vr-ar` | game-developer |
| `game-development/multiplayer` | game-developer |
| `game-development/web-games` | game-developer |
| `game-development/game-design` | game-developer |
| `game-development/game-audio` | game-developer |
| `game-development/game-art` | game-developer |

> ⚠️ **Note:** All 10 game sub-skills are referenced only by game-developer agent. May be consolidated into single skill.

---

## 🔗 Agent → Skill Mapping

| Agent | Skills |
|-------|--------|
| orchestrator | clean-code, parallel-agents, behavioral-modes, plan-writing, brainstorming, architecture, lint-and-validate, powershell-windows, bash-linux |
| junior-orchestrator | clean-code, plan-writing, behavioral-modes |
| senior-orchestrator | clean-code, plan-writing, behavioral-modes, architecture, api-patterns |
| elite-orchestrator | clean-code, plan-writing, behavioral-modes, architecture, api-patterns, deployment-procedures, vulnerability-scanner |
| backend-orchestrator | clean-code, api-patterns, database-design, deployment-procedures, bash-linux, plan-writing |
| frontend-orchestrator | clean-code, frontend-design, nextjs-react-expert, web-design-guidelines, tailwind-patterns, plan-writing |
| user-orchestrator | clean-code, frontend-design, plan-writing, brainstorming |
| project-planner | clean-code, app-builder, plan-writing, brainstorming |
| explorer-agent | clean-code, architecture, plan-writing, brainstorming, systematic-debugging |
| frontend-specialist | clean-code, nextjs-react-expert, web-design-guidelines, tailwind-patterns, frontend-design, lint-and-validate |
| backend-specialist | clean-code, api-patterns, database-design, nodejs-best-practices, python-patterns, bash-linux, server-management, dto-patterns |
| database-architect | clean-code, database-design, plan-writing |
| mobile-developer | clean-code, api-patterns, mobile-design |
| game-developer | clean-code, game-development, game-development/* (10 sub-skills) |
| security-auditor | clean-code, vulnerability-scanner, red-team-tactics, api-patterns |
| penetration-tester | clean-code, red-team-tactics, vulnerability-scanner |
| test-engineer | clean-code, testing-patterns, tdd-workflow, webapp-testing, code-review-checklist, lint-and-validate |
| qa-automation-engineer | webapp-testing, testing-patterns, web-design-guidelines, clean-code, lint-and-validate |
| devops-engineer | clean-code, deployment-procedures, bash-linux, server-management, lint-and-validate, plan-writing, brainstorming |
| performance-optimizer | clean-code, performance-profiling |
| seo-specialist | clean-code, seo-fundamentals, geo-fundamentals, lint-and-validate |
| debugger | clean-code, systematic-debugging, bash-linux |
| documentation-writer | clean-code, brainstorming |
| code-archaeologist | clean-code, refactoring-patterns, code-review-checklist |
| product-manager | plan-writing, brainstorming, clean-code |
| product-owner | plan-writing, brainstorming, clean-code |
| protocol-architect | clean-code, api-patterns, mcp-builder, architecture, dto-patterns |
| protocol-orchestrator | clean-code, api-patterns, mcp-builder, architecture, plan-writing |
| data-scientist | clean-code, python-patterns, database-design, api-patterns |
| ux-researcher | clean-code, frontend-design, brainstorming |
| accessibility-specialist | clean-code, frontend-design, web-design-guidelines |
| sre | clean-code, server-management, bash-linux, performance-profiling |
| cloud-architect | clean-code, architecture, server-management, deployment-procedures |
| i18n-specialist | clean-code, i18n-localization, frontend-design |
| finops-analyst | clean-code, architecture, server-management |
| delphi-developer | clean-code, delphi-pascal, database-design, api-patterns, dto-patterns |
| ethical-hacker | clean-code, red-team-tactics, vulnerability-scanner, bash-linux |
| bypass-specialist | clean-code, red-team-tactics, vulnerability-scanner, bash-linux |
| pentest-planner | clean-code, red-team-tactics, vulnerability-scanner, plan-writing |
| kali-copilot | clean-code, red-team-tactics, vulnerability-scanner, bash-linux |
| fullstack-developer | clean-code, api-patterns, database-design, frontend-design, nextjs-react-expert, nodejs-best-practices, python-patterns |
| staff-engineer | clean-code, architecture, api-patterns, database-design, plan-writing, code-review-checklist |
| platform-engineer | clean-code, deployment-procedures, bash-linux, server-management, plan-writing, architecture |
| nodejs-nest-developer | clean-code, nodejs-best-practices, api-patterns, database-design, dto-patterns |
| express-developer | clean-code, nodejs-best-practices, api-patterns, database-design |
| python-api-developer | clean-code, python-patterns, api-patterns, database-design, dto-patterns |
| angular-developer | clean-code, frontend-design, typescript-patterns, api-patterns |
| react-developer | clean-code, frontend-design, nextjs-react-expert |
| vbnet-developer | clean-code, database-design, api-patterns |
| php-developer | clean-code, api-patterns, database-design |
| html5-css-developer | clean-code, frontend-design, web-design-guidelines |
| nextjs-developer | clean-code, nextjs-react-expert, frontend-design, api-patterns, tailwind-patterns |
| network-engineer | clean-code, bash-linux, server-management, architecture |
| docker-developer | clean-code, bash-linux, deployment-procedures, server-management |
| linux-administrator | clean-code, bash-linux, server-management |
| windows-administrator | clean-code, powershell-windows, server-management |
| n8n-automation | clean-code, api-patterns, bash-linux |
| data-layer-developer | clean-code, database-design, api-patterns, bash-linux |
| business-logic-developer | clean-code, api-patterns, database-design, dto-patterns |
| prompt-engineer | clean-code, architecture, brainstorming |
| creative-technologist | clean-code, brainstorming, architecture, frontend-design |
| secure-coder | clean-code, vulnerability-scanner, api-patterns, code-review-checklist |
| threat-modeler | architecture, api-patterns, vulnerability-scanner |
| incident-responder | vulnerability-scanner, bash-linux, server-management |
| compliance-officer | clean-code, vulnerability-scanner |
| security-orchestrator | vulnerability-scanner, clean-code, api-patterns, plan-writing |

### Infrastructure & Operations Skills
| Skill | Agents | Domain |
|-------|-------------|--------|
| `containerization` | — | Docker, Kubernetes, container security |
| `git-workflows` | — | Version control, branching strategies |
| `ci-cd-pipelines` | — | Continuous integration, deployment automation |
| `monitoring-observability` | — | Logging, metrics, tracing |
| `api-versioning` | — | API evolution, backward compatibility |

---

## 📌 Orphaned Skills (no direct Agent reference)

| Skill | Status | Recommendation |
|-------|-------|-------|
| `mcp-builder` | ✅ Adopted | Used by protocol-architect |
| `geo-fundamentals` | ✅ Adopted | Used by seo-specialist |
| `powershell-windows` | ✅ Adopted | Used by devops-engineer, orchestrator |
| `i18n-localization` | ✅ Adopted | Used by i18n-specialist |
| `containerization` | 🟡 Available | Consider for devops-engineer, platform-engineer |
| `git-workflows` | 🟡 Available | Consider for platform-engineer, staff-engineer |
| `ci-cd-pipelines` | 🟡 Available | Consider for devops-engineer, platform-engineer |
| `monitoring-observability` | 🟡 Available | Consider for sre, platform-engineer |
| `api-versioning` | 🟡 Available | Consider for protocol-architect, backend-specialist |

---

## ✅ All Skills Adopted!

All skills have agent references — no orphaned skills remaining

---

*Created: 2026-04-27*
