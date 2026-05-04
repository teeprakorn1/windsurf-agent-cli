/**
 * aiyu-multi-agent add skill <name> — Install a skill plugin from npm
 */

const chalk = require("chalk");
const ora = require("ora");
const fs = require("fs");
const path = require("path");

const config = require("../core/config");
const plugin = require("../core/plugin");

async function run(type, name, options = {}) {
  if (type !== "skill") {
    console.log(chalk.yellow(`\n  Only "skill" type is supported currently. Usage: aiyu-multi-agent add skill <name>\n`));
    return;
  }

  const projectDir = process.cwd();

  if (!config.configExists(projectDir)) {
    console.log(chalk.red("No config directory found. Run `aiyu-multi-agent init` first.\n"));
    return;
  }

  // Phase 1: Download + validate
  const spinner = ora(`Installing skill: ${name}...`).start();

  try {
    const skillName = plugin.install(projectDir, name);
    spinner.succeed(chalk.green(`Skill "${skillName}" installed!`));

    const skillDir = plugin.getSkillDir(projectDir, skillName);

    // Phase 2: Permission check
    const permResult = await plugin.checkPermissions(skillDir, { autoApprove: options.autoApprove });
    if (!permResult.granted) {
      // Rollback — remove the skill
      plugin.remove(projectDir, skillName);
      console.log(chalk.yellow("\n  Permission denied. Skill not installed.\n"));
      return;
    }

    // Show skill info
    console.log(`\n  ${chalk.cyan("Installed to:")} ${skillDir}`);

    const skillMd = path.join(skillDir, "SKILL.md");
    if (fs.existsSync(skillMd)) {
      const content = fs.readFileSync(skillMd, "utf-8");
      const descMatch = content.match(/description:\s*(.+)/);
      if (descMatch) {
        console.log(`  ${chalk.cyan("Description:")} ${descMatch[1].trim()}`);
      }
    }

    // Show granted permissions
    const grantedPerms = Object.keys(permResult.permissions);
    if (grantedPerms.length > 0) {
      console.log(`  ${chalk.cyan("Permissions:")} ${grantedPerms.join(", ")}`);
    }

    console.log(`\n  ${chalk.gray("The skill is now available for your agents.")}`);
    console.log(`  ${chalk.gray("Reference it in agent frontmatter: skills: ..., " + skillName)}\n`);
  } catch (err) {
    spinner.fail(chalk.red(`Failed to install skill: ${name}`));
    console.error(chalk.red(`  ${err.message}\n`));
  }
}

module.exports = { run };
