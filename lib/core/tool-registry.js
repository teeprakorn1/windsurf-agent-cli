/**
 * Tool Registry — Namespaced tool management
 *
 * Decomposed into focused modules (V2.6):
 *   - tool-definitions.js — Builtin tools, schemas, registry, truncation
 *   - search-tools.js     — search.grep + fs.glob implementations
 *   - command-parser.js   — Shell arg parsing + ReDoS-safe regex
 *
 * This file re-exports all public APIs for backward compatibility.
 */

const {
  BUILTIN_TOOLS,
  TOOL_SCHEMAS,
  LEGACY_ALIAS,
  registerTool,
  resolveToolName,
  getTool,
  listTools,
  validateToolArgs,
  truncateResult,
  executeToolIsolated,
  MAX_RESULT_SIZE,
} = require("./tool-definitions");

const { parseCommandArgs, _safeRegex } = require("./command-parser");
const { searchGrep, fsGlob } = require("./search-tools");

module.exports = {
  BUILTIN_TOOLS,
  TOOL_SCHEMAS,
  LEGACY_ALIAS,
  registerTool,
  resolveToolName,
  getTool,
  listTools,
  validateToolArgs,
  truncateResult,
  parseCommandArgs,
  executeToolIsolated,
  _safeRegex,
  searchGrep,
  fsGlob,
  MAX_RESULT_SIZE,
};
