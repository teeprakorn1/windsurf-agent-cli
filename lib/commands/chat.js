/**
 * aiyu-multi-agent chat — Interactive session mode
 */

const chalk = require("chalk");
const readline = require("readline");

const config = require("../core/config");
const agentRuntime = require("../core/agent-runtime");
const userConfig = require("../core/user-config");
const utils = require("../utils");

function showSlashMenu() {
  const lines = [];
  lines.push("");
  lines.push(chalk.cyan("  === Slash Commands ==="));
  lines.push("");
  const commands = [
    ["/",              "Show this command menu"],
    ["/new",           "Start a new session (clear history)"],
    ["/clear",         "Alias for /new"],
    ["/history",       "Show conversation history"],
    ["/save",          "Save conversation to file"],
    ["/retry",         "Resend the last message to agent"],
    ["/undo",          "Remove the last user/agent exchange"],
    ["/model",         "Switch model for current provider"],
    ["/config",        "Show current config"],
    ["/config set ...","Set API key, base URL, or model"],
    ["/config default", "Set default provider and model"],
    ["/config reset",  "Reset config to defaults"],
    ["/help",          "Show this menu"],
    ["ESC",            "Clear input (typing) or cancel AI response (processing)"],
    ["exit / quit",    "End session"],
  ];
  const maxCmd = Math.max(...commands.map(c => c[0].length));
  for (const [cmd, desc] of commands) {
    const padded = cmd.padEnd(maxCmd + 2);
    lines.push(`  ${chalk.yellow(padded)} ${desc}`);
  }
  lines.push("");
  console.log(lines.join("\n"));
}

const SLASH_COMMANDS = [
  { cmd: "/new",    desc: "Start a new session (clear history)" },
  { cmd: "/clear",  desc: "Alias for /new" },
  { cmd: "/history",desc: "Show conversation history" },
  { cmd: "/save",   desc: "Save conversation to file" },
  { cmd: "/retry",  desc: "Resend the last message to agent" },
  { cmd: "/undo",   desc: "Remove the last user/agent exchange" },
  { cmd: "/model",  desc: "Switch model for current provider" },
  { cmd: "/config", desc: "Show current config" },
  { cmd: "/help",   desc: "Show this menu" },
];

function showSlashMenuInteractive(filtered, selectedIndex = 0, filterText = "") {
  const lines = [];
  lines.push("");
  const header = filterText
    ? `  === Slash Commands (filter: /${filterText}) ===`
    : "  === Slash Commands (type to filter, arrows to select, ESC to cancel) ===";
  lines.push(chalk.cyan(header));
  lines.push("");
  if (filtered.length === 0) {
    lines.push(chalk.gray("  (no matching commands)"));
  } else {
    const maxCmd = Math.max(...SLASH_COMMANDS.map(c => c.cmd.length));
    filtered.forEach((item, i) => {
      const padded = item.cmd.padEnd(maxCmd + 2);
      if (i === selectedIndex) {
        lines.push(`  ${chalk.black.bgYellow(padded)} ${item.desc}`);
      } else {
        lines.push(`  ${chalk.yellow(padded)} ${chalk.gray(item.desc)}`);
      }
    });
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * Read input with keypress events — typing '/' enters interactive slash menu
 * with arrow-key navigation and ESC cancellation (Hermes Agent-like).
 * Falls back to readline.question on non-TTY terminals.
 */
function readKeypressInput(promptText, inputHistory = []) {
  return new Promise((resolve) => {
    // Non-TTY fallback (piped input, CI, etc.)
    if (!process.stdin.isTTY) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question(chalk.green(promptText), (answer) => {
        rl.close();
        resolve(answer);
      });
      return;
    }

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }

    let buf = "";
    let menuMode = false;
    let menuFilter = ""; // characters typed after /
    let selectedIndex = 0;
    let historyIndex = -1; // -1 = current new input, 0+ = history item
    process.stdout.write(chalk.green(promptText));

    const clearLines = (count) => {
      for (let i = 0; i < count; i++) {
        process.stdout.write("\x1b[1A\x1b[2K");
      }
    };

    const getFiltered = () => {
      if (!menuFilter) return SLASH_COMMANDS;
      return SLASH_COMMANDS.filter(c => c.cmd.startsWith("/" + menuFilter));
    };

    const getMenuLineCount = () => {
      const filtered = getFiltered();
      return filtered.length + 3; // header + filtered items + blank
    };

    const redrawMenu = () => {
      const filtered = getFiltered();
      if (selectedIndex >= filtered.length) selectedIndex = Math.max(0, filtered.length - 1);
      clearLines(getMenuLineCount());
      process.stdout.write(showSlashMenuInteractive(filtered, selectedIndex, menuFilter));
      process.stdout.write(chalk.green(promptText) + "/" + menuFilter);
    };

    const redrawLine = (newBuf) => {
      const totalLen = promptText.length + Math.max(buf.length, newBuf.length);
      process.stdout.write("\r" + " ".repeat(totalLen) + "\r");
      process.stdout.write(chalk.green(promptText) + newBuf);
    };

    const exitMenu = () => {
      clearLines(getMenuLineCount());
      menuMode = false;
      menuFilter = "";
      selectedIndex = 0;
      buf = "";
      process.stdout.write(chalk.green(promptText));
    };

    const onKeypress = (str, key) => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        process.stdout.write("\n");
        resolve("exit");
        return;
      }

      if (key.name === "return" || key.name === "enter") {
        if (menuMode) {
          const filtered = getFiltered();
          if (filtered.length === 0) {
            // No match — exit menu, treat as normal input
            cleanup();
            process.stdout.write("\n");
            resolve("/" + menuFilter);
            return;
          }
          cleanup();
          const selected = filtered[selectedIndex].cmd;
          process.stdout.write(`\n${chalk.gray("  Selected: " + selected)}\n`);
          resolve(selected);
          return;
        }
        cleanup();
        process.stdout.write("\n");
        resolve(buf);
        return;
      }

      if (key.name === "escape") {
        if (menuMode) {
          // ESC in menu: exit menu completely, return to empty prompt
          exitMenu();
          return;
        }
        // Normal mode: ESC clears current input
        if (buf.length > 0) {
          redrawLine("");
          buf = "";
          historyIndex = -1;
          return;
        }
        // Empty buffer: return empty string (main loop skips)
        cleanup();
        process.stdout.write("\n");
        resolve("");
        return;
      }

      if (menuMode) {
        // Arrow keys navigate filtered list
        const filtered = getFiltered();
        if (key.name === "up") {
          selectedIndex = (selectedIndex - 1 + filtered.length) % filtered.length;
          redrawMenu();
          return;
        }
        if (key.name === "down") {
          selectedIndex = (selectedIndex + 1) % filtered.length;
          redrawMenu();
          return;
        }
        // Backspace removes last filter char; if filter empty, exit menu
        if (key.name === "backspace") {
          if (menuFilter.length > 0) {
            menuFilter = menuFilter.slice(0, -1);
            selectedIndex = 0;
            redrawMenu();
          } else {
            exitMenu();
          }
          return;
        }
        // Typable chars add to filter
        if (str && str.charCodeAt(0) >= 32 && !key.ctrl && !key.meta) {
          menuFilter += str;
          selectedIndex = 0;
          redrawMenu();
          return;
        }
        // Ignore other keys in menu mode
        return;
      }

      // Normal mode: Up/Down arrow for command history
      if (key.name === "up" && inputHistory.length > 0) {
        if (historyIndex < inputHistory.length - 1) {
          historyIndex++;
          buf = inputHistory[inputHistory.length - 1 - historyIndex];
          redrawLine(buf);
        }
        return;
      }
      if (key.name === "down" && inputHistory.length > 0) {
        if (historyIndex > 0) {
          historyIndex--;
          buf = inputHistory[inputHistory.length - 1 - historyIndex];
          redrawLine(buf);
        } else if (historyIndex === 0) {
          historyIndex = -1;
          buf = "";
          redrawLine("");
        }
        return;
      }

      if (key.name === "backspace") {
        if (buf.length > 0) {
          buf = buf.slice(0, -1);
          process.stdout.write("\b \b");
        }
        return;
      }

      // Enter menu mode when '/' is first character
      if (str === "/" && buf === "" && historyIndex === -1) {
        menuMode = true;
        menuFilter = "";
        selectedIndex = 0;
        const filtered = getFiltered();
        process.stdout.write("\n");
        process.stdout.write(showSlashMenuInteractive(filtered, selectedIndex, menuFilter));
        process.stdout.write(chalk.green(promptText) + "/");
        return;
      }

      if (str && str.charCodeAt(0) >= 32 && !key.ctrl && !key.meta) {
        buf += str;
        process.stdout.write(str);
      }
    };

    const cleanup = () => {
      process.stdin.removeListener("keypress", onKeypress);
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(false);
      }
    };

    process.stdin.on("keypress", onKeypress);
    process.stdin.resume();
  });
}

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
  console.log(chalk.gray("   Type your message, or 'exit' to quit"));
  console.log(chalk.gray("   Type '/' for slash commands\n"));

  let session;
  let lastUserMessage = "";
  let sessionTitle = "";
  const inputHistory = [];

  // Real-time step display callback (IDE-like process visibility)
  const onStep = (evt) => {
    switch (evt.type) {
      case "thinking": {
        const preview = evt.content.replace(/\n/g, " ").slice(0, 120);
        console.log(chalk.dim(`  [Step ${evt.step}] Thinking... ${preview}${evt.content.length > 120 ? "..." : ""}`));
        break;
      }
      case "tool_call": {
        const argsPreview = evt.args ? JSON.stringify(evt.args).slice(0, 80) : "";
        console.log(chalk.blue(`  [Step ${evt.step}] Calling tool: ${evt.tool}${argsPreview ? " " + argsPreview : ""}`));
        break;
      }
      case "tool_result": {
        console.log(chalk.green(`  [Step ${evt.step}] Tool ${evt.tool} done: ${String(evt.result).slice(0, 100)}`));
        break;
      }
      case "tool_error": {
        console.log(chalk.red(`  [Step ${evt.step}] Tool ${evt.tool} error: ${evt.error}`));
        break;
      }
    }
  };

  try {
    session = agentRuntime.createChatSession({
      agentName,
      projectDir,
      provider,
      model,
      onStep,
    });
  } catch (err) {
    console.log(chalk.red(`  Error: ${err.message}\n`));
    return;
  }

  // Interactive loop
  while (true) {
    const message = await readKeypressInput("You: ", inputHistory);

    if (!message || message.toLowerCase() === "exit" || message.toLowerCase() === "quit") {
      console.log(chalk.gray("\n  Session ended.\n"));
      break;
    }

    const lower = message.toLowerCase();

    // Show slash command menu
    if (lower === "/" || lower === "/help" || lower === "help") {
      showSlashMenu();
      continue;
    }

    // New session / clear history
    if (lower === "/new" || lower === "/clear" || lower === "clear") {
      try {
        session = agentRuntime.createChatSession({ agentName, projectDir, provider, model });
        lastUserMessage = "";
        console.log(chalk.yellow("\n  New session started. History cleared.\n"));
      } catch (err) {
        console.log(chalk.red(`  Error: ${err.message}\n`));
      }
      continue;
    }

    // History (also support /history)
    if (lower === "history" || lower === "/history") {
      const history = session.getHistory();
      if (history.length === 0) {
        console.log(chalk.gray("\n  No history yet.\n"));
        continue;
      }
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

    // Save conversation
    if (lower === "/save") {
      const fs = require("fs");
      const path = require("path");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const fileName = `chat-${agentName}-${timestamp}.md`;
      const savePath = path.join(projectDir, fileName);
      const history = session.getHistory();
      let md = `# Chat: ${agentName}\n\n`;
      if (sessionTitle) md += `**Title:** ${sessionTitle}\n\n`;
      md += `**Date:** ${new Date().toISOString()}\n\n`;
      md += "---\n\n";
      for (const entry of history) {
        md += `## ${entry.role.toUpperCase()}\n\n${entry.content}\n\n`;
        if (entry.toolCalls?.length > 0) {
          for (const tc of entry.toolCalls) {
            md += `- Tool \`${tc.tool}\`: ${tc.error ? "ERROR: " + tc.error : "OK"}\n`;
          }
          md += "\n";
        }
      }
      try {
        fs.writeFileSync(savePath, md, "utf-8");
        console.log(chalk.green(`\n  Saved to: ${fileName}\n`));
      } catch (err) {
        console.log(chalk.red(`\n  Save failed: ${err.message}\n`));
      }
      continue;
    }

    // Retry last message
    if (lower === "/retry") {
      if (!lastUserMessage) {
        console.log(chalk.yellow("\n  No previous message to retry.\n"));
        continue;
      }
      console.log(chalk.gray(`\n  Retrying: "${lastUserMessage.slice(0, 60)}..."\n`));
      // Fall through to send logic with lastUserMessage
    }

    // Undo last exchange
    if (lower === "/undo") {
      const msgs = session.getMessages();
      // Remove last assistant + user pair if possible
      let removed = 0;
      while (msgs.length > 1 && removed < 2) {
        const last = msgs[msgs.length - 1];
        if (last.role === "assistant" || last.role === "user") {
          msgs.pop();
          removed++;
        } else {
          break;
        }
      }
      // Also remove from history array
      const hist = session.getHistory();
      if (hist.length > 0) hist.pop();
      console.log(chalk.yellow(`\n  Removed ${removed} message(s).\n`));
      continue;
    }

    // /config command
    if (message.startsWith("/config")) {
      const parts = message.trim().split(/\s+/);
      const subCmd = parts[1] || "show";

      if (subCmd === "show") {
        console.log(userConfig.display());
        continue;
      }

      if (subCmd === "set" && parts.length >= 5) {
        const provider = parts[2];
        const field = parts[3];
        const value = parts.slice(4).join(" ");
        const result = userConfig.interactiveSet(provider, field, value);
        if (result.error) {
          console.log(chalk.red(`  ${result.error}`));
        } else {
          console.log(chalk.green(`  Set ${result.provider}.${result.field} = ${result.value}`));
        }
        continue;
      }

      if (subCmd === "default" && parts.length >= 3) {
        const provider = parts[2];
        const model = parts[3] || "";
        userConfig.setDefaults(provider, model);
        console.log(chalk.green(`  Default provider = ${provider}${model ? ", model = " + model : ""}`));
        continue;
      }

      if (subCmd === "reset") {
        userConfig.save(JSON.parse(JSON.stringify(userConfig.DEFAULTS)));
        console.log(chalk.yellow("  Config reset to defaults."));
        continue;
      }

      console.log(chalk.red("  Usage: /config [show|set <provider> <field> <value>|default <provider> [model]|reset]"));
      continue;
    }

    // /model command — switch model for current provider only
    if (message.startsWith("/model")) {
      const parts = message.trim().split(/\s+/);
      const requestedModel = parts[1];

      const PROVIDER_MODELS = {
        openai: ["gpt-4", "gpt-4o", "gpt-3.5-turbo", "gpt-5.5"],
        claude: ["claude-3-5-sonnet-20241022", "claude-opus-4-7", "claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"],
        local:  ["llama3", "mistral", "codellama"],
        mock:   ["mock"],
      };

      const currentProvider = provider || "mock";
      const availableModels = PROVIDER_MODELS[currentProvider] || ["mock"];

      if (!requestedModel) {
        console.log(chalk.cyan(`\n  Current provider: ${currentProvider}`));
        console.log(chalk.cyan(`  Current model:    ${model || "(default)"}`));
        console.log(chalk.cyan("  Available models:"));
        availableModels.forEach((m, i) => {
          const marker = m === (model || availableModels[0]) ? chalk.green("* ") : "  ";
          console.log(`  ${marker}${m}`);
        });
        console.log(chalk.gray(`\n  Use '/model <name>' to switch. To change provider, use '/config default <provider> <model>'.\n`));
        continue;
      }

      if (!availableModels.includes(requestedModel)) {
        console.log(chalk.red(`  Model "${requestedModel}" is not available for provider "${currentProvider}".`));
        console.log(chalk.cyan("  Available models:"));
        availableModels.forEach(m => console.log(`    ${m}`));
        console.log(chalk.gray(`\n  To use a model from another provider, switch provider first: '/config default <provider> <model>'\n`));
        continue;
      }

      // Update the model for current session
      // We need to create a new session with the new model
      try {
        session = agentRuntime.createChatSession({
          agentName,
          projectDir,
          provider: currentProvider,
          model: requestedModel,
        });
        model = requestedModel;
        console.log(chalk.green(`\n  Switched to model: ${requestedModel} (provider: ${currentProvider})\n`));
      } catch (err) {
        console.log(chalk.red(`  Error switching model: ${err.message}\n`));
      }
      continue;
    }

    // Unknown slash command — suggest help
    if (message.startsWith("/")) {
      console.log(chalk.red(`  Unknown command: ${message}`));
      console.log(chalk.gray(`  Type '/' or '/help' for available commands.\n`));
      continue;
    }

    // Send message
    const msgToSend = lower === "/retry" ? lastUserMessage : message;
    lastUserMessage = message;
    // Add to input history (deduplicate, max 100)
    if (msgToSend && !msgToSend.startsWith("/") && inputHistory[inputHistory.length - 1] !== msgToSend) {
      inputHistory.push(msgToSend);
      if (inputHistory.length > 100) inputHistory.shift();
    }

    // Track if user pressed ESC during AI processing
    let wasCancelled = false;
    let cancelHandler = null;

    const setupCancelListener = () => {
      readline.emitKeypressEvents(process.stdin);
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(true);
      }
      cancelHandler = (str, key) => {
        if (key.name === "escape" || (key.ctrl && key.name === "c")) {
          wasCancelled = true;
          process.stdout.write("\n" + chalk.yellow("  Cancelling... (ESC pressed)") + "\n");
        }
      };
      process.stdin.on("keypress", cancelHandler);
    };

    const cleanupCancelListener = () => {
      if (cancelHandler) {
        process.stdin.removeListener("keypress", cancelHandler);
        cancelHandler = null;
      }
    };

    setupCancelListener();
    try {
      const entry = await session.send(msgToSend);

      if (wasCancelled) {
        console.log(chalk.yellow("  [Response discarded - user cancelled]\n"));
        continue;
      }

      // Show final response (steps already shown in real-time via onStep)
      if (entry.steps?.length > 0) {
        const totalMs = entry.steps.reduce((s, st) => s + (st.duration_ms || 0), 0);
        const totalTokens = entry.usage?.totalTokens || 0;
        console.log(chalk.dim(`  [Done] ${entry.steps.length} step(s), ${(totalMs / 1000).toFixed(1)}s, ${totalTokens} tokens`));
      }

      console.log(`\n${chalk.cyan("Agent:")} ${entry.content}\n`);
    } catch (err) {
      if (wasCancelled) {
        console.log(chalk.yellow("  Cancelled by user.\n"));
        continue;
      }
      console.log(chalk.red(`\n  Error: ${err.message}\n`));
    } finally {
      cleanupCancelListener();
    }
  }
}

module.exports = { run };
