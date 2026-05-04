/**
 * Smart Init — Interactive agent generator
 */

const inquirer = require("inquirer").default;
const chalk = require("chalk");
const ora = require("ora");
const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

const config = require("../core/config");
const guardrails = require("../core/guardrails");
const logger = require("../core/logger");
const utils = require("../utils");

const TEMPLATES_DIR = path.resolve(__dirname, "../../templates/agent");

const USE_CASES = [
  { name: "Backend API", value: "backend", description: "REST/GraphQL API development with database integration" },
  { name: "Automation / Scraping", value: "automation", description: "Task automation, web scraping, data pipelines" },
  { name: "Dev Assistant", value: "dev-assistant", description: "General coding assistant with multi-language support" },
  { name: "Custom", value: "custom", description: "Build your own agent from scratch" },
];

const PROVIDERS = [
  { name: "OpenAI", value: "openai" },
  { name: "Claude (Anthropic)", value: "claude" },
  { name: "Local (Ollama)", value: "local" },
  { name: "Multi-provider", value: "multi" },
];

const MEMORY_STRATEGIES = [
  { name: "None (stateless)", value: "none" },
  { name: "File-based (.agent/memory/)", value: "file" },
  { name: "Vector (requires add skill vector)", value: "vector" },
];

async function run(projectDir, options = {}) {
  if (config.configExists(projectDir)) {
    console.log(chalk.yellow(".agent/ or .windsurf/ already exists. Run `aiyu-multi-agent update` instead.\n"));
    return;
  }

  if (options.dryRun) {
    console.log(chalk.cyan("[DRY RUN] Would run init...\n"));
    return;
  }

  // Auto-detect provider from env vars
  const detectedProvider = process.env.ANTHROPIC_API_KEY ? "claude"
    : process.env.OPENAI_API_KEY ? "openai"
    : "mock";

  // Defaults (no prompts)
  let answers = {
    useCase: "custom",
    provider: detectedProvider,
    memory: "none",
    guardrails: true,
    agentName: path.basename(projectDir) || "my-agent",
  };

  // Interactive mode: ask all questions
  if (options.interactive) {
    console.log(chalk.cyan("\n🚀 Aiyu MultiAgent — Smart Init\n"));
    const interactive = await inquirer.prompt([
      {
        type: "list",
        name: "useCase",
        message: "What will this agent do?",
        choices: USE_CASES.map((uc) => ({
          name: `${uc.name}  — ${chalk.gray(uc.description)}`,
          short: uc.name,
          value: uc.value,
        })),
      },
      {
        type: "list",
        name: "provider",
        message: "Which LLM provider?",
        choices: PROVIDERS,
        default: detectedProvider,
      },
      {
        type: "list",
        name: "memory",
        message: "Memory strategy?",
        choices: MEMORY_STRATEGIES,
      },
      {
        type: "confirm",
        name: "guardrails",
        message: "Enable guardrails? (path traversal, safe write, rate limit, sandbox exec)",
        default: true,
      },
      {
        type: "input",
        name: "agentName",
        message: "Agent name:",
        default: (currentAnswers) => {
          const uc = USE_CASES.find((u) => u.value === currentAnswers.useCase);
          return uc ? `${uc.value}-agent` : "my-agent";
        },
        validate: (input) => {
          const trimmed = input.trim();
          if (!trimmed) return "Agent name is required";
          if (/[\/\\:\*\?"<>\|]/.test(trimmed)) return "Agent name cannot contain: / \\ : * ? \" < > |";
          return true;
        },
      },
    ]);
    answers = interactive;
  } else {
    console.log(chalk.cyan(`\n🚀 Aiyu MultiAgent — Quick Init`));
    console.log(chalk.gray(`   Provider: ${answers.provider} | Memory: ${answers.memory} | Guardrails: on\n`));
  }

  selectedUseCase = answers.useCase;

  const spinner = ora("Generating agent config...").start();

  try {
    const agentDir = config.initConfigDir(projectDir);
    const templateDir = path.join(TEMPLATES_DIR, answers.useCase);

    // Copy template if exists
    if (fs.existsSync(templateDir)) {
      utils.copyRecursive(templateDir, path.join(agentDir, "agents"));
    } else {
      generateDefaultAgent(agentDir, answers);
    }

    // Generate config.yaml
    generateConfig(agentDir, answers);

    // Generate test stub
    generateTestStub(agentDir, answers);

    // Copy full library from package (agents, skills, workflows, rules, scripts)
    copyLibraryFromPackage(agentDir);

    // Save version
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../package.json"), "utf-8"));
    config.saveVersion(projectDir, pkg.version);

    // Update .gitignore
    utils.updateGitignore(projectDir);

    // Generate .windsurfrules for Windsurf IDE
    generateWindsurfrules(projectDir, answers);

    spinner.succeed(chalk.green("Agent config generated!"));

    console.log(`\n  ${chalk.cyan("Created:")} .agent/agents/${answers.agentName}.md`);
    console.log(`  ${chalk.cyan("Created:")} .agent/skills/core/ (built-in skills)`);
    console.log(`  ${chalk.cyan("Created:")} .agent/config.yaml`);
    console.log(`  ${chalk.cyan("Created:")} .agent/tests/${answers.agentName}.test.md`);
    console.log(`  ${chalk.cyan("Linked:")}  .windsurf/ → .agent/`);
    console.log(`  ${chalk.cyan("Created:")} .windsurfrules`);

    console.log(`\n  ${chalk.gray("Next:")} aiyu-multi-agent add skill <name>`);
    console.log(`        ${chalk.gray("aiyu-multi-agent test")}\n`);
  } catch (err) {
    spinner.fail(chalk.red("Init failed"));
    logger.error(err.message);
    throw err;
  }
}

function generateDefaultAgent(agentDir, answers) {
  const agentContent = `---
name: ${answers.agentName}
description: "${USE_CASES.find((u) => u.value === answers.useCase)?.name || 'Custom'} agent — ${answers.provider} provider, ${answers.memory} memory"
tools: Read, Grep, Glob, Bash, Edit, Write
model: inherit
skills: clean-code, architecture
provider: ${answers.provider}
memory: ${answers.memory}
guardrails: ${answers.guardrails}
---

## 🤖 Agent Identity
> 🤖 **Active Agent: \`${answers.agentName}\`** | Skills: \`clean-code, architecture\`

# ${answers.agentName}

You are a specialized AI agent for ${answers.useCase} tasks.

## Provider
- Configured for: **${answers.provider}**

## Memory
- Strategy: **${answers.memory}**

## Guardrails
- ${answers.guardrails ? "Enabled — path traversal, safe write, rate limit, sandbox exec" : "Disabled"}

## Instructions
Follow the Sub-Agent Kit rules from GEMINI.md.
Apply clean-code principles to all generated code.
`;

  guardrails.safeWrite(path.join(agentDir, "agents", `${answers.agentName}.md`), agentContent);
}

function generateConfig(agentDir, answers) {
  const cfg = {
    workspace: {
      name: answers.agentName,
      description: `${USE_CASES.find((u) => u.value === answers.useCase)?.name || "Custom"} agent`,
      version: "1.0.0",
    },
    agent: {
      name: answers.agentName,
      provider: answers.provider,
      memory: answers.memory,
      guardrails: answers.guardrails,
    },
    paths: {
      agents: "./agents",
      skills: "./skills",
      workflows: "./workflows",
      scripts: "./scripts",
      rules: "./rules",
      tests: "./tests",
    },
  };

  guardrails.safeWrite(path.join(agentDir, "config.yaml"), YAML.stringify(cfg));
}

function generateTestStub(agentDir, answers) {
  const testContent = `---
name: ${answers.agentName}-test
description: "Basic test suite for ${answers.agentName}"
---

# Test Suite: ${answers.agentName}

## Test 1: Agent loads correctly
- assert: agent config exists
- assert: agent name is "${answers.agentName}"
- assert: provider is "${answers.provider}"

## Test 2: Guardrails active
${answers.guardrails ? `- assert: path traversal protection enabled
- assert: safe write enabled
- assert: rate limit enabled` : "- skip: guardrails disabled"}

## Test 3: Memory strategy
- assert: memory strategy is "${answers.memory}"
`;

  guardrails.safeWrite(path.join(agentDir, "tests", `${answers.agentName}.test.md`), testContent);
}

function copyLibraryFromPackage(agentDir) {
  const pkgWindsurfDir = path.resolve(__dirname, "../../.windsurf");
  if (!fs.existsSync(pkgWindsurfDir)) return;

  const dirs = ["agents", "skills", "workflows", "rules", "scripts"];
  dirs.forEach((dir) => {
    const src = path.join(pkgWindsurfDir, dir);
    const dest = path.join(agentDir, dir);
    if (!fs.existsSync(src)) return;
    utils.copyRecursive(src, dest, { merge: true, skipDirs: ["node_modules", ".git"] });
  });
}

function generateWindsurfrules(projectDir, answers) {
  const rulesPath = path.join(projectDir, ".windsurfrules");
  if (fs.existsSync(rulesPath)) return;

  const content = `# Aiyu MultiAgent — Auto-read by Windsurf IDE

## 🎯 Overview
AI Agent Platform — ${answers.agentName} agent (${answers.provider}, ${answers.memory} memory)

## 📁 Structure
- \`.windsurf/agents/\` — Agent definitions
- \`.windsurf/skills/\` — Domain-specific skills
- \`.windsurf/tests/\` — Agent test files (*.test.md)

## 🚀 CLI Commands
- \`aiyu-multi-agent add skill <name>\` — Install skill from npm
- \`aiyu-multi-agent remove skill <name>\` — Uninstall skill
- \`aiyu-multi-agent test\` — Run agent test suite
- \`aiyu-multi-agent run "<input>"\` — Execute agent
- \`aiyu-multi-agent chat\` — Interactive session
`;

  fs.writeFileSync(rulesPath, content, "utf-8");
}

module.exports = { run };
