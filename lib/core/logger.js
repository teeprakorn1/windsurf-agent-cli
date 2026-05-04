/**
 * Structured logger with levels, JSON output, and tracing support
 */

const chalk = require("chalk");

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
let currentLevel = LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LEVELS.info;
let jsonOutput = process.env.LOG_FORMAT === "json";

function setLevel(level) {
  if (LEVELS[level] !== undefined) currentLevel = LEVELS[level];
}

function setJsonOutput(enabled) {
  jsonOutput = enabled;
}

function fmt(prefix, msg) {
  return `${prefix} ${msg}`;
}

function structuredLog(level, msg, meta = {}) {
  if (LEVELS[level] === undefined || currentLevel > LEVELS[level]) return;

  if (jsonOutput) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message: msg,
      ...meta,
    };
    const line = JSON.stringify(entry);
    if (level === "error") console.error(line);
    else console.log(line);
    return;
  }

  const prefixMap = {
    debug: chalk.gray("[debug]"),
    info: chalk.blue("[info]"),
    warn: chalk.yellow("[warn]"),
    error: chalk.red("[error]"),
  };

  const prefix = prefixMap[level] || "[log]";
  const metaStr = Object.keys(meta).length > 0 ? chalk.gray(` ${JSON.stringify(meta)}`) : "";
  const output = `${fmt(prefix, msg)}${metaStr}`;

  if (level === "error") console.error(output);
  else console.log(output);
}

module.exports = {
  setLevel,
  setJsonOutput,
  debug: (msg, meta) => structuredLog("debug", msg, meta),
  info: (msg, meta) => structuredLog("info", msg, meta),
  warn: (msg, meta) => structuredLog("warn", msg, meta),
  error: (msg, meta) => structuredLog("error", msg, meta),
  success: (msg) => console.log(fmt(chalk.green("✓"), msg)),
  fail: (msg) => console.error(fmt(chalk.red("✗"), msg)),
};
