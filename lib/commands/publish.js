/**
 * aiyu-multi-agent publish — Publish agent to npm
 */

const chalk = require("chalk");
const ora = require("ora");
const fs = require("fs");

const config = require("../core/config");
const validator = require("../publish/validator");
const packager = require("../publish/packager");
const registry = require("../publish/registry");

async function run(options = {}) {
  const projectDir = process.cwd();

  if (!config.configExists(projectDir)) {
    console.log(chalk.red("No config directory found. Run `aiyu-multi-agent init` first.\n"));
    return;
  }

  // Step 1: Validate
  const spinner = ora("Validating agent...").start();
  const validation = validator.validate(projectDir);

  if (!validation.valid) {
    spinner.fail(chalk.red("Validation failed"));
    console.log(chalk.red("\n  Errors:"));
    validation.errors.forEach(e => console.log(chalk.red(`    ✗ ${e}`)));
    if (validation.warnings.length > 0) {
      console.log(chalk.yellow("\n  Warnings:"));
      validation.warnings.forEach(w => console.log(chalk.yellow(`    ⚠ ${w}`)));
    }
    console.log("");
    return;
  }

  if (validation.warnings.length > 0) {
    spinner.warn(chalk.yellow("Validation passed with warnings"));
    validation.warnings.forEach(w => console.log(chalk.yellow(`    ⚠ ${w}`)));
  } else {
    spinner.succeed(chalk.green("Validation passed"));
  }

  // Step 2: Check npm login
  const user = registry.whoami();
  if (!user) {
    console.log(chalk.red("\n  Not logged in to npm. Run `npm login` first.\n"));
    return;
  }
  console.log(chalk.gray(`  Publishing as: ${user}`));

  // Step 3: Package
  const pkgSpinner = ora("Packaging agent...").start();
  let pkgResult;
  try {
    pkgResult = packager.packageAgent(projectDir, {
      name: options.name,
      version: options.version,
      author: options.author,
      license: options.license,
    });
    pkgSpinner.succeed(chalk.green(`Packaged: ${pkgResult.pkgName}@${pkgResult.pkgVersion}`));
  } catch (err) {
    pkgSpinner.fail(chalk.red("Packaging failed"));
    console.error(chalk.red(`  ${err.message}\n`));
    return;
  }

  // Step 4: Publish
  if (options.dryRun) {
    console.log(chalk.cyan(`\n  [DRY RUN] Would publish: ${pkgResult.pkgName}@${pkgResult.pkgVersion}`));
    console.log(chalk.gray(`  Run without --dry-run to actually publish.\n`));
    try { fs.rmSync(pkgResult.tmpDir, { recursive: true, force: true }); } catch {}
    return;
  }

  const pubSpinner = ora(`Publishing ${pkgResult.pkgName}@${pkgResult.pkgVersion}...`).start();
  const result = registry.publish(pkgResult.tmpDir, {
    access: options.access || "public",
    tag: options.tag,
  });

  if (result.success) {
    pubSpinner.succeed(chalk.green(`Published: ${pkgResult.pkgName}@${pkgResult.pkgVersion}`));
    console.log(`\n  ${chalk.cyan("Install with:")} npx ${pkgResult.pkgName}`);
    console.log(`  ${chalk.cyan("npm page:")}   https://www.npmjs.com/package/${pkgResult.pkgName}\n`);
  } else {
    pubSpinner.fail(chalk.red("Publish failed"));
    console.error(chalk.red(`  ${result.error}\n`));
  }

  // Cleanup temp dir
  try {
    fs.rmSync(pkgResult.tmpDir, { recursive: true, force: true });
  } catch {}
}

module.exports = { run };
