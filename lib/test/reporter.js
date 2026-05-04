/**
 * Test reporter — TAP + pretty output formatting
 */

const chalk = require("chalk");

function formatResult(suiteResult) {
  const lines = [];

  lines.push(chalk.bold(`\n  ${suiteResult.name}`));
  lines.push(chalk.gray("  " + "─".repeat(50)));

  for (const test of suiteResult.tests) {
    switch (test.status) {
      case "pass":
        lines.push(`  ${chalk.green("✓")} ${test.name}`);
        break;
      case "fail":
        lines.push(`  ${chalk.red("✗")} ${test.name}`);
        if (test.errors) {
          for (const err of test.errors) {
            lines.push(chalk.red(`    expected: ${err.expected}`));
            lines.push(chalk.red(`    actual:   ${err.actual}`));
          }
        }
        if (test.error) {
          lines.push(chalk.red(`    ${test.error}`));
        }
        break;
      case "skip":
        lines.push(`  ${chalk.yellow("○")} ${test.name} ${chalk.gray(`(${test.reason})`)}`);
        break;
    }
  }

  return lines.join("\n");
}

function formatSummary(results) {
  if (results.status === "no_tests") {
    return chalk.yellow("\n  No test files found in .agent/tests/ or .windsurf/tests/\n");
  }

  const lines = [];
  lines.push("");
  lines.push(chalk.gray("  " + "═".repeat(50)));
  lines.push(chalk.bold("  Test Summary"));
  lines.push(chalk.gray("  " + "═".repeat(50)));

  for (const suite of results.suites) {
    lines.push(formatResult(suite));
  }

  lines.push("");
  lines.push(chalk.gray("  " + "─".repeat(50)));
  lines.push(`  Total:   ${results.total}`);
  lines.push(`  ${chalk.green("Passed:")}  ${results.passed}`);
  if (results.failed > 0) {
    lines.push(`  ${chalk.red("Failed:")}  ${results.failed}`);
  }
  if (results.skipped > 0) {
    lines.push(`  ${chalk.yellow("Skipped:")} ${results.skipped}`);
  }

  if (results.status === "pass") {
    lines.push(`\n  ${chalk.green.bold("✓ All tests passed!")}\n`);
  } else {
    lines.push(`\n  ${chalk.red.bold("✗ Some tests failed")}\n`);
  }

  return lines.join("\n");
}

function formatTAP(results) {
  const lines = [`TAP version 13`];
  let testNum = 0;

  for (const suite of results.suites) {
    for (const test of suite.tests) {
      testNum++;
      if (test.status === "pass") {
        lines.push(`ok ${testNum} - ${suite.name}: ${test.name}`);
      } else if (test.status === "skip") {
        lines.push(`ok ${testNum} - ${suite.name}: ${test.name} # SKIP ${test.reason}`);
      } else {
        lines.push(`not ok ${testNum} - ${suite.name}: ${test.name}`);
        if (test.errors) {
          lines.push("  ---");
          for (const err of test.errors) {
            lines.push(`  expected: ${err.expected}`);
            lines.push(`  actual: ${err.actual}`);
          }
          lines.push("  ...");
        }
      }
    }
  }

  lines.push(`1..${testNum}`);
  return lines.join("\n");
}

module.exports = { formatResult, formatSummary, formatTAP };
