/**
 * aiyu-multi-agent remove skill <name> — Uninstall a skill plugin
 */

const chalk = require("chalk");
const ora = require("ora");

const config = require("../core/config");
const plugin = require("../core/plugin");

async function run(type, name, options = {}) {
  if (type !== "skill") {
    console.log(chalk.yellow(`\n  Only "skill" type is supported currently. Usage: aiyu-multi-agent remove skill <name>\n`));
    return;
  }

  const projectDir = process.cwd();

  if (!config.configExists(projectDir)) {
    console.log(chalk.red("No config directory found.\n"));
    return;
  }

  if (!plugin.isInstalled(projectDir, name)) {
    console.log(chalk.yellow(`Skill "${name}" is not installed.\n`));
    console.log("Installed skills:");
    const installed = plugin.listInstalled(projectDir);
    if (installed.length === 0) {
      console.log("  (none)");
    } else {
      installed.forEach(s => console.log(`  ${s}`));
    }
    console.log("");
    return;
  }

  const spinner = ora(`Removing skill: ${name}...`).start();

  try {
    const skillName = plugin.remove(projectDir, name);
    spinner.succeed(chalk.green(`Skill "${skillName}" removed!`));
    console.log(`\n  ${chalk.gray("Remember to update any agent frontmatter that referenced this skill.")}\n`);
  } catch (err) {
    spinner.fail(chalk.red(`Failed to remove skill: ${name}`));
    console.error(chalk.red(`  ${err.message}\n`));
  }
}

module.exports = { run };
