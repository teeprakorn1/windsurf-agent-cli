/**
 * aiyu-multi-agent run — Execute agent with input
 */

const chalk = require("chalk");
const ora = require("ora");

const config = require("../core/config");
const agentRuntime = require("../core/agent-runtime");
const utils = require("../utils");

async function run(input, options = {}) {
  const projectDir = process.cwd();

  if (!config.configExists(projectDir)) {
    console.log(chalk.red("No config directory found. Run `aiyu-multi-agent init` first.\n"));
    return;
  }

  const agentName = options.agent || utils.findDefaultAgent(projectDir);
  if (!agentName) {
    console.log(chalk.red("No agent found. Specify with --agent <name>\n"));
    return;
  }
  if (!utils.isValidAgentName(agentName)) {
    console.log(chalk.red(`Invalid agent name: "${agentName}" — cannot contain: / \\ : * ? " < > |\n`));
    return;
  }

  const provider = options.provider;
  const model = options.model;
  const maxSteps = options.maxSteps ? parseInt(options.maxSteps, 10) : undefined;
  const jsonMode = options.json || false;
  const verbose = options.verbose || false;
  const dryRun = options.dryRun || false;
  const noCache = options.noCache || false;

  if (dryRun) {
    console.log(chalk.cyan("\n[DRY RUN] Would execute:"));
    console.log(chalk.gray(`  Agent:   ${agentName}`));
    console.log(chalk.gray(`  Input:   ${input.slice(0, 100)}`));
    console.log(chalk.gray(`  Provider: ${provider || "default"}`));
    console.log(chalk.gray(`  Model:   ${model || "default"}`));
    console.log(chalk.gray(`  Max steps: ${maxSteps || 10}\n`));
    return;
  }

  if (!jsonMode) {
    console.log(chalk.cyan(`\n🚀 Running agent: ${agentName}`));
    console.log(chalk.gray(`   Input: ${input.slice(0, 80)}${input.length > 80 ? "..." : ""}`));
    if (provider) console.log(chalk.gray(`   Provider: ${provider}`));
    console.log("");
  }

  let spinner = jsonMode ? null : ora("Thinking...").start();

  try {
    const state = await agentRuntime.runAgent({
      input,
      agentName,
      projectDir,
      provider,
      model,
      maxSteps,
      json: jsonMode,
      noCache,
      outputFormat: jsonMode ? "json" : undefined,
      onStep: (step, state) => {
        if (spinner) spinner.stop();

        // Streaming: print step details as they happen
        if (verbose && !jsonMode) {
          console.log(chalk.gray(`\n  ── Step ${step.step} ──`));
          if (step.thought) console.log(chalk.gray(`  Thought: ${step.thought.slice(0, 200)}`));
        }

        if (step.toolCalls.length > 0) {
          step.toolCalls.forEach(tc => {
            if (tc.error) {
              console.log(chalk.red(`  ✗ ${tc.tool} — ${tc.error}`));
            } else {
              console.log(chalk.cyan(`  ✔ ${tc.tool}(${JSON.stringify(tc.args || {}).slice(0, 60)})`));
              if (verbose && tc.result) {
                const preview = JSON.stringify(tc.result).slice(0, 200);
                console.log(chalk.gray(`  Result: ${preview}...`));
              }
            }
          });
        }

        if (!jsonMode) spinner = ora("Thinking...").start();
      },
    });

    if (spinner) spinner.stop();

    if (jsonMode) {
      console.log(JSON.stringify(state, null, 2));
      return state;
    }

    // Pretty output
    if (state.status === "complete") {
      console.log(chalk.green("\n✓ Output:\n"));
      console.log(state.output);
    } else if (state.status === "error") {
      console.log(chalk.red(`\n✗ Error: ${state.error}\n`));
    } else if (state.status === "max_steps") {
      console.log(chalk.yellow("\n⚠ Max steps reached. Partial output:\n"));
      console.log(state.output);
    }

    // Summary
    console.log(chalk.gray(`\n  Steps: ${state.steps.length} | Tokens: ${state.usage.totalTokens} | Status: ${state.status}\n`));

    return state;
  } catch (err) {
    if (spinner) spinner.fail(chalk.red("Agent execution failed"));
    console.error(chalk.red(`  ${err.message}\n`));
    throw err;
  }
}

module.exports = { run };
