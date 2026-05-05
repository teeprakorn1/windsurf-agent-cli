#!/usr/bin/env node

/**
 * Isolated Tool Runner — runs a single tool call in a child process
 * with restricted permissions passed via environment variables.
 *
 * Usage: node tool-runner.js <toolName> <argsJSON>
 *
 * Environment:
 *   PERMISSIONS_FS     — "true"/"false" — allow filesystem access
 *   PERMISSIONS_NETWORK — "true"/"false" — allow network access
 *   PERMISSIONS_EXEC    — "true"/"false" — allow command execution
 *   PERMISSIONS_ENV     — "true"/"false" — allow env access
 */

const toolRegistry = require("./tool-registry");

const toolName = process.argv[2];
const argsJSON = process.argv[3] || "{}";

if (!toolName) {
  process.stderr.write(JSON.stringify({ error: "No tool name provided" }));
  process.exit(1);
}

// Permission checks
const perms = {
  fs: process.env.PERMISSIONS_FS !== "false",
  network: process.env.PERMISSIONS_NETWORK !== "false",
  exec: process.env.PERMISSIONS_EXEC !== "false",
  env: process.env.PERMISSIONS_ENV !== "false",
};

// Enforce permissions on tool categories
const FS_TOOLS = ["fs.read", "fs.write", "fs.edit", "fs.glob"];
const EXEC_TOOLS = ["shell.exec"];
const NET_TOOLS = ["search.grep", "fetch.url"];

if (FS_TOOLS.includes(toolName) && !perms.fs) {
  process.stdout.write(JSON.stringify({ error: `Permission denied: ${toolName} requires fs access` }));
  process.exit(1);
}

if (EXEC_TOOLS.includes(toolName) && !perms.exec) {
  process.stdout.write(JSON.stringify({ error: `Permission denied: ${toolName} requires exec access` }));
  process.exit(1);
}

if (NET_TOOLS.includes(toolName) && !perms.network) {
  process.stdout.write(JSON.stringify({ error: `Permission denied: ${toolName} requires network access` }));
  process.exit(1);
}

// Parse args
let args;
try {
  args = JSON.parse(argsJSON);
} catch {
  process.stdout.write(JSON.stringify({ error: "Invalid args JSON" }));
  process.exit(1);
}

// Validate args
const validationErr = toolRegistry.validateToolArgs(toolName, args);
if (validationErr) {
  process.stdout.write(JSON.stringify({ error: validationErr }));
  process.exit(1);
}

// Execute tool
const tool = toolRegistry.getTool(toolName);
if (!tool) {
  process.stdout.write(JSON.stringify({ error: `Tool not found: ${toolName}` }));
  process.exit(1);
}

(async () => {
  try {
    const result = await tool(args);

    // Truncate large results
    const MAX_SIZE = 100 * 1024;
    const resultStr = JSON.stringify(result);
    if (resultStr.length > MAX_SIZE) {
      const truncated = { ...result, _truncated: true };
      const HALF_MAX = MAX_SIZE / 2;
      if (truncated.content) truncated.content = truncated.content.slice(0, HALF_MAX) + "...[truncated]";
      if (truncated.stdout) truncated.stdout = truncated.stdout.slice(0, HALF_MAX) + "...[truncated]";
      if (truncated.matches && JSON.stringify(truncated.matches).length > MAX_SIZE) truncated.matches = truncated.matches.slice(0, 50);
      if (truncated.files && JSON.stringify(truncated.files).length > MAX_SIZE) truncated.files = truncated.files.slice(0, 50);
      process.stdout.write(JSON.stringify(truncated));
    } else {
      process.stdout.write(resultStr);
    }
  } catch (e) {
    process.stdout.write(JSON.stringify({ error: e.message, exitCode: e.status || 1 }));
  }
})();
