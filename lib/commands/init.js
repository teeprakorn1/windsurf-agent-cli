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
const rooGen = require("../core/roo-generator");
const cursorGen = require("./cursor-generator");

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
  { name: "Groq (free tier, fast)", value: "groq" },
  { name: "Local (Ollama)", value: "local" },
  { name: "Multi-provider", value: "multi" },
];

const MEMORY_STRATEGIES = [
  { name: "None (stateless)", value: "none" },
  { name: "File-based (.agent/memory/)", value: "file" },
  { name: "Vector (requires add skill vector)", value: "vector" },
];

async function run(projectDir, options = {}) {
  // Roo-only: add Roo files to existing project (no need for fresh init)
  if (options.rooOnly) {
    await runRooOnly(projectDir, options);
    return;
  }

  // Cursor-only: generate .cursor/ from existing .windsurf/ (or package fallback)
  if (options.cursorOnly) {
    await runCursorOnly(projectDir, options);
    return;
  }

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
    : process.env.GROQ_API_KEY ? "groq"
    : process.env.OLLAMA_HOST ? "local"
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
    if (!answers.provider) {
      answers.provider = "mock";
    }
    console.log(chalk.cyan(`\n🚀 Aiyu MultiAgent — Quick Init`));
    if (answers.provider === "mock") {
      console.log(chalk.yellow(`⚠️  Warning: No LLM API keys detected. Using mock provider (no real AI responses).`));
      console.log(chalk.gray(`   Set OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY, or OLLAMA_HOST for real responses.`));
    }
    console.log(chalk.gray(`   Provider: ${answers.provider} | Memory: ${answers.memory} | Guardrails: on\n`));
  }

  const spinner = ora("Generating agent config...").start();

  try {
    const agentDir = config.initConfigDir(projectDir, { windsurfOnly: options.windsurfOnly, agentOnly: options.agentOnly });
    const templateDir = path.join(TEMPLATES_DIR, answers.useCase);

    // Copy template if exists
    if (fs.existsSync(templateDir)) {
      utils.copyRecursive(templateDir, path.join(agentDir, "agents"));
    } else {
      generateDefaultAgent(agentDir, answers, projectDir);
    }

    // Generate config.yaml
    generateConfig(agentDir, answers, projectDir);

    // Generate test stub
    generateTestStub(agentDir, answers, projectDir);

    // Copy full library from package (agents, skills, workflows, rules, scripts)
    copyLibraryFromPackage(agentDir);

    // Save version
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../package.json"), "utf-8"));
    config.saveVersion(projectDir, pkg.version);

    // Update .gitignore
    utils.updateGitignore(projectDir);

    // Generate .windsurfrules for Windsurf IDE
    generateWindsurfrules(projectDir, answers);

    // Generate Roo files (.roomodes, .roorules, .roo/) unless explicitly skipped
    if (!options.noRoo) {
      const agentsDir = path.join(agentDir, "agents");
      rooGen.generateRoomodes(projectDir, agentsDir);
      rooGen.generateRoorules(projectDir, answers);
      rooGen.generateRooDir(projectDir);
    }

    // Generate .cursor/ if --cursor flag passed (alongside .windsurf/)
    let cursorStats = null;
    if (options.cursor) {
      try {
        cursorStats = cursorGen.generate(projectDir, {
          sourceDir: agentDir,
          force: !!options.force,
        });
      } catch (err) {
        logger.warn(`Cursor generation skipped: ${err.message}`);
      }
    }

    spinner.succeed(chalk.green("Agent config generated!"));

    if (options.windsurfOnly) {
      console.log(`\n  ${chalk.cyan("Created:")} .windsurf/agents/${answers.agentName}.md`);
      console.log(`  ${chalk.cyan("Created:")} .windsurf/skills/core/ (built-in skills)`);
      console.log(`  ${chalk.cyan("Created:")} .windsurf/config.yaml`);
      console.log(`  ${chalk.cyan("Created:")} .windsurf/tests/${answers.agentName}.test.md`);
      console.log(`  ${chalk.cyan("Created:")} .windsurfrules`);
    } else if (options.agentOnly) {
      console.log(`\n  ${chalk.cyan("Created:")} .agent/agents/${answers.agentName}.md`);
      console.log(`  ${chalk.cyan("Created:")} .agent/skills/core/ (built-in skills)`);
      console.log(`  ${chalk.cyan("Created:")} .agent/config.yaml`);
      console.log(`  ${chalk.cyan("Created:")} .agent/tests/${answers.agentName}.test.md`);
    } else {
      console.log(`\n  ${chalk.cyan("Created:")} .agent/agents/${answers.agentName}.md`);
      console.log(`  ${chalk.cyan("Created:")} .agent/skills/core/ (built-in skills)`);
      console.log(`  ${chalk.cyan("Created:")} .agent/config.yaml`);
      console.log(`  ${chalk.cyan("Created:")} .agent/tests/${answers.agentName}.test.md`);
      console.log(`  ${chalk.cyan("Linked:")}  .windsurf/ → .agent/`);
      console.log(`  ${chalk.cyan("Created:")} .windsurfrules`);
    }

    if (!options.noRoo) {
      console.log(`  ${chalk.cyan("Created:")} .roomodes  (${chalk.gray("Roo Code custom modes — 84 agents")}`);
      console.log(`  ${chalk.cyan("Created:")} .roorules  (${chalk.gray("Roo Code rules")})`);
      console.log(`  ${chalk.cyan("Created:")} .roo/      (${chalk.gray("Roo Code system prompts")})`);
    }

    if (cursorStats) {
      console.log(`  ${chalk.cyan("Created:")} .cursor/   (${chalk.gray(`${cursorStats.agents} agents, ${cursorStats.skills} skills, ${cursorStats.workflows} commands`)})`);
    }

    console.log(`\n  ${chalk.gray("Next:")} aiyu-multi-agent add skill <name>`);
    console.log(`        ${chalk.gray("aiyu-multi-agent test")}\n`);
  } catch (err) {
    spinner.fail(chalk.red("Init failed"));
    logger.error(err.message);
    throw err;
  }
}

/**
 * --roo-only: generate Roo files from existing .agent/ library (no full re-init)
 */
async function runRooOnly(projectDir, options) {
  const spinner = ora("Generating Roo files...").start();
  try {
    // Resolve agentsDir: prefer existing .agent/, fallback to package .windsurf/
    const existingAgentDir = config.getAgentDir(projectDir);
    const pkgWindsurfDir = path.resolve(__dirname, "../../.windsurf");
    const agentsDir = fs.existsSync(path.join(existingAgentDir, "agents"))
      ? path.join(existingAgentDir, "agents")
      : path.join(pkgWindsurfDir, "agents");

    const answers = { agentName: path.basename(projectDir) || "aiyu-agent" };

    rooGen.generateRoomodes(projectDir, agentsDir);
    rooGen.generateRoorules(projectDir, answers);
    rooGen.generateRooDir(projectDir);

    // Add .roo/ to .gitignore if not already there
    updateGitignoreForRoo(projectDir);

    spinner.succeed(chalk.green("Roo files generated!"));
    console.log(`\n  ${chalk.cyan("Created:")} .roomodes  (${chalk.gray("84 custom modes for Roo Code")})`);
    console.log(`  ${chalk.cyan("Created:")} .roorules  (${chalk.gray("Roo Code rules")})`);
    console.log(`  ${chalk.cyan("Created:")} .roo/      (${chalk.gray("Roo system prompts")})`);
    console.log(`\n  ${chalk.gray("Open Roo Code in VS Code → click mode selector (bottom-left) → choose a specialist")}\n`);
  } catch (err) {
    spinner.fail(chalk.red("Roo init failed"));
    logger.error(err.message);
    throw err;
  }
}

/**
 * --cursor-only: generate .cursor/ from existing .windsurf/ (or package fallback)
 */
async function runCursorOnly(projectDir, options) {
  const spinner = ora("Generating Cursor IDE config...").start();
  try {
    // Resolve source: prefer existing project .windsurf/ or .agent/, fallback to package .windsurf/
    const existingCfg = config.getConfigDir(projectDir);
    const pkgWindsurfDir = path.resolve(__dirname, "../../.windsurf");
    const sourceDir = existingCfg && fs.existsSync(path.join(existingCfg, "agents"))
      ? existingCfg
      : pkgWindsurfDir;

    if (!fs.existsSync(sourceDir)) {
      spinner.fail(chalk.red("No source directory found (.windsurf/ or .agent/)"));
      return;
    }

    if (options.dryRun) {
      spinner.info(chalk.cyan("[DRY RUN] Would generate .cursor/ from " + sourceDir));
      return;
    }

    const stats = cursorGen.generate(projectDir, {
      sourceDir,
      force: !!options.force,
    });

    spinner.succeed(chalk.green("Cursor IDE config generated!"));
    console.log(`\n  ${chalk.cyan("Source:")}   ${path.relative(projectDir, sourceDir) || "."}`);
    console.log(`  ${chalk.cyan("Created:")}  .cursor/rules/agents/    (${chalk.gray(stats.agents + " agent rules")})`);
    console.log(`  ${chalk.cyan("Created:")}  .cursor/rules/skills/    (${chalk.gray(stats.skills + " skill rules")})`);
    console.log(`  ${chalk.cyan("Created:")}  .cursor/rules/domain/    (${chalk.gray(stats.rules + " domain rules")})`);
    console.log(`  ${chalk.cyan("Created:")}  .cursor/commands/        (${chalk.gray(stats.workflows + " slash commands")})`);
    if (stats.mcpConfig) console.log(`  ${chalk.cyan("Created:")}  .cursor/mcp.json`);
    if (stats.overview)  console.log(`  ${chalk.cyan("Created:")}  .cursor/rules/00-project-overview.mdc`);
    console.log(`\n  ${chalk.gray("Open Cursor IDE in this folder — rules and slash commands will be auto-discovered.")}\n`);
  } catch (err) {
    spinner.fail(chalk.red("Cursor init failed"));
    logger.error(err.message);
    throw err;
  }
}

function updateGitignoreForRoo(projectDir) {
  const gitignorePath = path.join(projectDir, ".gitignore");
  if (!fs.existsSync(gitignorePath)) return;
  let content = fs.readFileSync(gitignorePath, "utf-8");
  const entries = [".roo/system-prompt-*.md"];
  const toAdd = entries.filter(e => !content.includes(e));
  if (toAdd.length === 0) return;
  const separator = content.endsWith("\n") ? "" : "\n";
  fs.writeFileSync(gitignorePath, content + separator + toAdd.join("\n") + "\n", "utf-8");
}

function generateDefaultAgent(agentDir, answers, projectDir) {
  const agentContent = `---
name: ${answers.agentName}
description: "${USE_CASES.find((u) => u.value === answers.useCase)?.name || 'Custom'} agent — ${answers.provider} provider, ${answers.memory} memory"
tools: fs.read, search.grep, fs.glob, shell.exec, fs.edit, fs.write
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
Follow the Aiyu Agent Kit rules from GEMINI.md.
Apply clean-code principles to all generated code.

## Behavioral Rules (Karpathy Principles)
1. THINK FIRST: State assumptions explicitly. If uncertain, ASK — don't guess silently.
2. SIMPLICITY: Minimum code that solves the problem. No speculative features.
3. SURGICAL: Touch only what you must. Every changed line must trace to the user's request.
4. GOAL-DRIVEN: Define success criteria before implementing. Write tests first, then make them pass.
`;

  guardrails.safeWrite(path.join(agentDir, "agents", `${answers.agentName}.md`), agentContent, "utf-8", projectDir);
}

function generateConfig(agentDir, answers, projectDir) {
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

  guardrails.safeWrite(path.join(agentDir, "config.yaml"), YAML.stringify(cfg), "utf-8", projectDir);
}

function generateTestStub(agentDir, answers, projectDir) {
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

  guardrails.safeWrite(path.join(agentDir, "tests", `${answers.agentName}.test.md`), testContent, "utf-8", projectDir);
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

  guardrails.safeWrite(rulesPath, content, "utf-8", projectDir);
}

module.exports = { run };
