/**
 * npm registry wrapper — publish agent package
 */

const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

function publish(pkgDir, options = {}) {
  const args = ["publish"];

  if (options.dryRun) args.push("--dry-run");
  if (options.access) args.push("--access", options.access);
  if (options.tag) args.push("--tag", options.tag);

  try {
    const result = execFileSync("npm", args, {
      cwd: pkgDir,
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 120000,
    });
    return { success: true, output: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function whoami() {
  try {
    const result = execFileSync("npm", ["whoami"], {
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 10000,
    });
    return result.trim();
  } catch {
    return null;
  }
}

module.exports = { publish, whoami };
