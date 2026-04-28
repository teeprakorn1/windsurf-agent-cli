# Windsurf Agent CLI — Antigravity Kit

> Workspace configuration for AI Agent Framework on Windsurf IDE — 79 Agents, 46 Skills, 78 Workflows, 10 Rules

---

## ✨ Features

- **79 Specialized AI Agents** — From frontend to IoT, security to mechatronics
- **46 Skills** — Modular capabilities loaded on-demand per agent
- **78 Slash Commands** — Activate agents instantly with `/command`
- **10 Rules** — Auto-triggered guidelines for security, performance, testing, and more
- **5 Verification Scripts** — Automated quality checks for every code change
- **Agent Auto-Routing** — The system automatically selects the right agent for your request
- **Multi-Agent Orchestration** — Coordinate 2-7+ agents for complex tasks

---

## 🚀 Quick Start

### Option A: Use `npx` (Recommended — No Install Needed)

```bash
# 1. Go to your project
cd your-project

# 2. Initialize Antigravity Kit
npx windsurf-agent-cli init

# 3. Open in Windsurf IDE
windsurf .
```

That's it! The `init` command will:
- Copy `.windsurf/` config (agents, skills, workflows, rules) into your project
- Update `.gitignore` with `# AG Kit` + `.windsurf` automatically

### Option B: Clone This Repo

```bash
git clone https://github.com/teeprakorn1/windsurf-agent-cli.git
cd windsurf-agent-cli
windsurf .
```

### Start Using Commands

Type any slash command in the Windsurf chat panel:

```
/create Build a task management app
/backend Design REST API with PostgreSQL
/security Audit my codebase for vulnerabilities
```

### CLI Commands

```bash
npx windsurf-agent-cli init           # First-time setup — copy .windsurf/ to your project
npx windsurf-agent-cli update         # Update .windsurf/ to latest version
npx windsurf-agent-cli status         # Show project statistics
npx windsurf-agent-cli list           # List all available slash commands
npx windsurf-agent-cli checklist      # Run master checklist
npx windsurf-agent-cli checklist --url http://localhost:3000  # Checklist with performance + E2E
npx windsurf-agent-cli help           # Show help message
```

---

## 📁 Project Structure

```
.windsurf/
├── agents/          # 79 AI Agents (e.g., frontend-specialist, mechatronic-specialist)
│   └── *.md         # Each agent has frontmatter (name, skills, tools, description)
├── skills/          # 46 Skills (e.g., clean-code, vulnerability-scanner)
│   └── skill-name/
│       ├── SKILL.md       # Skill metadata + guidelines
│       ├── scripts/       # Optional Python/Bash scripts
│       └── references/    # Optional templates, docs
├── workflows/       # 78 Workflows (e.g., /orchestrate, /create, /deploy)
│   └── *.md         # Each workflow activates an agent
├── scripts/         # 5 Python Scripts (checklist, verify_all, security_scan)
├── rules/           # 10 Rules (auto-triggered by keywords)
│   ├── GEMINI.md              # Core behavior rules (always active)
│   ├── architecture.md        # System architecture
│   ├── security-rules.md      # Security best practices
│   ├── performance-rules.md   # Performance optimization
│   ├── code-quality-rules.md  # Code quality standards
│   ├── documentation-rules.md # Documentation standards
│   ├── testing-rules.md       # Testing standards
│   ├── api-design-rules.md    # API design conventions
│   ├── database-rules.md      # Database best practices
│   └── deployment-rules.md    # Deployment safety
└── mcp_config.json  # MCP Server Configurations
```

---

## 🎯 How to Use

### Method 1: Slash Commands (Recommended)

Type `/` followed by the command name in the Windsurf chat:

| Category | Commands |
|----------|----------|
| **Core** | `/create`, `/plan`, `/enhance`, `/brainstorm`, `/status`, `/debug`, `/deploy`, `/test` |
| **Development** | `/backend`, `/frontend`, `/fullstack`, `/database`, `/data-layer`, `/business-logic` |
| **Frameworks** | `/nextjs`, `/react`, `/angular`, `/sveltekit`, `/nestjs`, `/express`, `/python-api`, `/go`, `/php`, `/delphi`, `/vbnet` |
| **Security** | `/security`, `/secure-coding`, `/threat-modeling`, `/incident-response`, `/compliance`, `/hack`, `/bypass`, `/pentest-plan`, `/kali` |
| **Infrastructure** | `/cloud`, `/docker`, `/linux`, `/windows`, `/network`, `/load-balancer`, `/migrate`, `/reliability` |
| **Orchestration** | `/orchestrate`, `/junior-orchestrate`, `/senior-orchestrate`, `/elite-orchestrate` |
| **Industrial** | `/mechatronic`, `/pneumatic`, `/electric`, `/chief-machine`, `/plc`, `/iot` |
| **Specialist** | `/math`, `/elite-tech-leader`, `/package-finder`, `/staff`, `/platform`, `/ux-research`, `/accessibility` |

### Method 2: Natural Language (Auto-Routing)

Just describe what you need — the system auto-selects the right agent:

```
"Build me a REST API with authentication"
→ 🤖 Active Agent: backend-specialist

"Check my code for security vulnerabilities"
→ 🤖 Active Agent: security-auditor

"Design a pneumatic circuit for a press machine"
→ 🤖 Active Agent: pneumatic-specialist

"Configure nginx load balancer with health checks"
→ 🤖 Active Agent: load-balancer-specialist
```

### Method 3: Orchestration (Multi-Agent)

For complex tasks, use orchestration commands to coordinate multiple agents:

```
/orchestrate Build an e-commerce platform with payment, inventory, and user management
→ Coordinates: backend-specialist + frontend-specialist + database-architect + security-auditor

/senior-orchestrate Migrate monolith to microservices on AWS
→ Coordinates: backend-specialist + devops-engineer + cloud-architect + migration-specialist
```

**Orchestration Levels:**

| Level | Agents | Use Case |
|-------|--------|----------|
| `/junior-orchestrate` | 2-3 | Simple feature, quick fix |
| `/senior-orchestrate` | 4-6 | Multi-service feature, cross-team |
| `/elite-orchestrate` | 7+ | Mission-critical, enterprise migration |

---

## 🔧 Adding New Components

### Add a New Agent

1. Create `.windsurf/agents/your-agent.md`:

```markdown
---
name: your-agent
description: What this agent does and when to trigger it
tools: Read, Grep, Glob, Bash, Edit, Write
model: inherit
skills: clean-code, architecture
---

## 🤖 Agent Identity
> 🤖 **Active Agent: `your-agent`** | Skills: `clean-code, architecture`

# Your Agent Title
Your agent instructions here...
```

2. Register in `.windsurf/config.yaml` under `agents:`

### Add a New Workflow

1. Create `.windsurf/workflows/your-command.md`:

```markdown
---
description: What this workflow does
skills:
  - clean-code
  - architecture
---

# /your-command - Title

$ARGUMENTS

## 🤖 Agent Activation
> 🤖 **Active Agent: `your-agent`** | Skills: `clean-code, architecture`

## Task
Load `.windsurf/agents/your-agent.md` and execute tasks.

## Examples
\`\`\`
/your-command example task 1
/your-command example task 2
\`\`\`
```

2. Register in `.windsurf/config.yaml` under `workflows.available_commands:`

### Add a New Skill

1. Create `.windsurf/skills/your-skill/SKILL.md`:

```markdown
---
name: your-skill
description: What this skill provides
allowed-tools: Read, Write, Edit
version: 1.0
priority: HIGH
---

# Your Skill Title
Your skill guidelines here...
```

2. Reference it in agent frontmatter `skills:` field

### Add a New Rule

1. Create `.windsurf/rules/your-rules.md`:

```markdown
---
trigger: on_request
keywords: [keyword1, keyword2]
---

# Your Rule Title
Your rule guidelines here...
```

---

## ✅ Verification & Quality

### Run All Checks

```bash
python3 .windsurf/scripts/checklist.py .
```

### Run with URL (includes performance + E2E)

```bash
python3 .windsurf/scripts/checklist.py . --url http://localhost:3000
```

### Available Scripts

| Script | Purpose |
|--------|---------|
| `checklist.py` | Master checklist runner (all checks) |
| `verify_all.py` | Run all verifications |
| `security_scan.py` | Vulnerability scanning |
| `auto_preview.py` | Auto preview server |
| `session_manager.py` | Session management |

### Skill-Specific Scripts

```bash
python3 .windsurf/skills/vulnerability-scanner/scripts/security_scan.py .
python3 .windsurf/skills/lint-and-validate/scripts/lint_runner.py .
python3 .windsurf/skills/testing-patterns/scripts/test_runner.py .
python3 .windsurf/skills/database-design/scripts/schema_validator.py .
python3 .windsurf/skills/frontend-design/scripts/ux_audit.py .
python3 .windsurf/skills/seo-fundamentals/scripts/seo_checker.py .
python3 .windsurf/skills/performance-profiling/scripts/lighthouse_audit.py --url http://localhost:3000
python3 .windsurf/skills/webapp-testing/scripts/playwright_runner.py --url http://localhost:3000
```

---

## 📊 Statistics

| Component | Count |
|-----------|-------|
| Agents | 79 |
| Skills | 46 |
| Workflows | 78 |
| Rules | 10 |
| Scripts | 5 |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit with conventional commits: `feat(scope): description`
4. Push and create a Pull Request

---

## License

[MIT License](LICENSE) © 2026

**Authors:**
- [@teeprakorn1](https://github.com/teeprakorn1)
- [@FrameHandsomez](https://github.com/FrameHandsomez)

---
*Created: 2026-04-27*
