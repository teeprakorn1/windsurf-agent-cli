/**
 * Structured logger with levels and color
 */

const chalk = require("chalk");

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

let currentLevel = LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LEVELS.info;

function setLevel(level) {
  if (LEVELS[level] !== undefined) currentLevel = LEVELS[level];
}

function fmt(prefix, msg) {
  return `${prefix} ${msg}`;
}

module.exports = {
  setLevel,
  debug: (msg) => currentLevel <= LEVELS.debug && console.log(fmt(chalk.gray("[debug]"), msg)),
  info: (msg) => currentLevel <= LEVELS.info && console.log(fmt(chalk.blue("[info]"), msg)),
  warn: (msg) => currentLevel <= LEVELS.warn && console.log(fmt(chalk.yellow("[warn]"), msg)),
  error: (msg) => currentLevel <= LEVELS.error && console.error(fmt(chalk.red("[error]"), msg)),
  success: (msg) => console.log(fmt(chalk.green("✓"), msg)),
  fail: (msg) => console.error(fmt(chalk.red("✗"), msg)),
};
