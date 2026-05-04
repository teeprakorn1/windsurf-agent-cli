/**
 * aiyu-multi-agent chat — Interactive session mode
 */

const chalk = require("chalk");
const inquirer = require("inquirer");

const config = require("../core/config");
const agentRuntime = require("../core/agent-runtime");
const utils = require("../utils");

async function run(options = {}) {
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

  console.log(chalk.cyan(`\n💬 Chat with: ${agentName}`));
  if (provider) console.log(chalk.gray(`   Provider: ${provider}`));
  console.log(chalk.gray("   Type your message, or 'exit' to quit\n"));

  const session = agentRuntime.createChatSession({
    agentName,
    projectDir,
    provider,
    model,
  });

  // Interactive loop
  while (true) {
    const { message } = await inquirer.prompt([
      {
        type: "input",
        name: "message",
        message: chalk.green("You:"),
        prefix: "",
      },
    ]);

    if (!message || message.toLowerCase() === "exit" || message.toLowerCase() === "quit") {
      console.log(chalk.gray("\n  Session ended.\n"));
      break;
    }

    if (message.toLowerCase() === "history") {
      const history = session.getHistory();
      console.log(chalk.cyan("\n  Chat History:"));
      history.forEach((entry, i) => {
        console.log(chalk.gray(`  [${i + 1}] ${entry.role}: ${entry.content.slice(0, 100)}${entry.content.length > 100 ? "..." : ""}`));
        if (entry.toolCalls?.length > 0) {
          entry.toolCalls.forEach(tc => {
            console.log(chalk.blue(`    Tool: ${tc.tool} ${tc.error ? "✗" : "✓"}`));
          });
        }
      });
      console.log("");
      continue;
    }

    if (message.toLowerCase() === "help") {
      console.log(chalk.cyan("\n  Commands:"));
      console.log("  exit/quit — End session");
      console.log("  history   — Show chat history");
      console.log("  help      — Show this help");
      console.log("");
      continue;
    }

    try {
      const entry = await session.send(message);

      // Show tool calls if any
      if (entry.toolCalls?.length > 0) {
        entry.toolCalls.forEach(tc => {
          if (tc.error) {
            console.log(chalk.red(`  Tool: ${tc.tool} ✗ ${tc.error}`));
          } else {
            console.log(chalk.blue(`  Tool: ${tc.tool} ✓`));
          }
        });
      }

      console.log(`\n${chalk.cyan("Agent:")} ${entry.content}\n`);
    } catch (err) {
      console.log(chalk.red(`\n  Error: ${err.message}\n`));
    }
  }
}

module.exports = { run };
