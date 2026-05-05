/**
 * Tool Registry — Namespaced tool management
 * Separated from agent-runtime.js for maintainability
 */

const guardrails = require("./guardrails");

const DEFAULT_TOOL_TIMEOUT_MS = 30000;

// ── Safe Regex (ReDoS protection) ──────────────────────────────────────

function _safeRegex(pattern, flags = "gi") {
  // Reject patterns with excessive repetition (e.g., (a+)+, (a*){5,})
  const dangerous = /\([^)]*[+*][^)]*\)[+*{]|[*+]{2,}|\([^)]*\){3,}/;
  if (dangerous.test(pattern)) {
    throw new Error(`Regex pattern rejected — potential ReDoS: ${pattern.slice(0, 50)}`);
  }
  return new RegExp(pattern, flags);
}

// ── Command Arg Parser ────────────────────────────────────────────────

function parseCommandArgs(argsStr) {
  if (!argsStr) return [];
  const args = [];
  let current = "";
  let inQuote = null;
  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];
    const next = argsStr[i + 1];
    // Handle escape sequences: \\ \" \'
    if (ch === "\\" && next && (next === '"' || next === "'" || next === "\\")) {
      current += next;
      i++; // skip escaped char
    } else if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === " " || ch === "\t") {
      if (current) {
        args.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current) args.push(current);
  return args;
}

// ── Tool Argument Schemas ─────────────────────────────────────────────

const TOOL_SCHEMAS = {
  "fs.read":       { required: ["path"], optional: ["offset", "limit"] },
  "fs.write":      { required: ["path", "content"], optional: [] },
  "fs.edit":       { required: ["path", "old_string", "new_string"], optional: [] },
  "fs.glob":       { required: ["pattern"], optional: ["path"] },
  "search.grep":   { required: ["pattern"], optional: ["path"] },
  "shell.exec":    { required: ["command"], optional: ["timeout", "cwd"] },
};

function validateToolArgs(toolName, args) {
  const schema = TOOL_SCHEMAS[toolName];
  if (!schema) return null;
  const missing = schema.required.filter(k => args[k] === undefined || args[k] === null);
  if (missing.length > 0) {
    return `Missing required arg(s): ${missing.join(", ")} (required: ${schema.required.join(", ")})`;
  }
  return null;
}

// ── Tool Registry (Namespaced) ────────────────────────────────────────

const LEGACY_ALIAS = {
  Read: "fs.read", Write: "fs.write", Edit: "fs.edit",
  Grep: "search.grep", Glob: "fs.glob", Bash: "shell.exec",
};

const BUILTIN_TOOLS = {
  "fs.read": async (args) => {
    const fs = require("fs");
    const projectRoot = args.projectRoot || args.cwd || process.cwd();
    const filePath = guardrails.pathTraversal(args.path || args.file_path, projectRoot);
    if (!fs.existsSync(filePath)) return { error: `File not found: ${filePath}` };
    const stat = fs.statSync(filePath);
    const MAX_FILE_SIZE = 1024 * 1024; // 1MB
    if (stat.size > MAX_FILE_SIZE) return { error: `File too large: ${stat.size} bytes (max ${MAX_FILE_SIZE})` };
    const content = fs.readFileSync(filePath, "utf-8");
    return { content, lines: content.split("\n").length };
  },

  "fs.write": async (args) => {
    const projectRoot = args.projectRoot || args.cwd || process.cwd();
    const filePath = guardrails.pathTraversal(args.path || args.file_path, projectRoot);
    guardrails.safeWrite(filePath, args.content || "", "utf-8", projectRoot);
    return { written: true, path: filePath };
  },

  "fs.edit": async (args) => {
    const fs = require("fs");
    const projectRoot = args.projectRoot || args.cwd || process.cwd();
    const filePath = guardrails.pathTraversal(args.path || args.file_path, projectRoot);
    if (!fs.existsSync(filePath)) return { error: `File not found: ${filePath}` };
    let content = fs.readFileSync(filePath, "utf-8");
    if (!content.includes(args.old_string)) return { error: "old_string not found in file" };
    content = content.replace(args.old_string, args.new_string);
    guardrails.safeWrite(filePath, content, "utf-8", projectRoot);
    return { edited: true, path: filePath };
  },

  "search.grep": async (args) => {
    const { pattern, path: searchPath = "." } = args;
    const projectRoot = args.projectRoot || args.cwd || process.cwd();
    const safePath = guardrails.pathTraversal(searchPath, projectRoot);
    try {
      // ReDoS protection — reject patterns with excessive repetition/alternation nesting
      const regex = _safeRegex(pattern);
      const path = require("path");
      const matches = [];
      const maxDepth = args.maxDepth || 10;
      const maxFileSize = args.maxFileSize || 1024 * 1024; // 1MB
      const maxFiles = args.maxFiles || 1000; // Limit number of files to prevent OOM
      let filesRead = 0;
      function walk(dir, depth) {
        if (depth > maxDepth) return;
        if (!fs.existsSync(dir)) return;
        if (filesRead >= maxFiles) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (filesRead >= maxFiles) return;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (entry.name !== "node_modules" && entry.name !== ".git") walk(full, depth + 1);
          } else {
            try {
              const stat = fs.statSync(full);
              if (stat.size > maxFileSize) continue;
              filesRead++;
              const content = fs.readFileSync(full, "utf-8");
              content.split("\n").forEach((line, i) => {
                if (regex.test(line)) matches.push(`${full}:${i + 1}:${line.trim()}`);
                regex.lastIndex = 0;
              });
            } catch { /* skip unreadable files */ }
          }
        }
      }
      walk(safePath, 0);
      return { matches: matches.slice(0, 200), filesRead, _truncated: filesRead >= maxFiles };
    } catch (e) {
      return { matches: [], error: e.message };
    }
  },

  "fs.glob": async (args) => {
    const { pattern, path: searchPath = "." } = args;
    const projectRoot = args.projectRoot || args.cwd || process.cwd();
    const safePath = guardrails.pathTraversal(searchPath, projectRoot);
    try {
      // Use Node.js for cross-platform compatibility (no find dependency)
      const fs = require("fs");
      const path = require("path");
      const glob = require("glob");
      const files = await new Promise((resolve) => {
        glob(path.join(safePath, "**", pattern), { nodir: true, dot: false }, (err, m) => {
          resolve(err ? [] : (m || []));
        });
      });
      return { files: files.slice(0, 500) };
    } catch {
      // Fallback: simple recursive listing with glob pattern matching
      const fs = require("fs");
      const p = require("path");
      // Convert glob pattern to regex      // Fallback: use Node.js glob-to-regex (with proper escaping)
      const globToRegex = (glob) => {
        // Escape regex special chars first, then unescape glob wildcards
        let regex = glob
          .replace(/[.+^${}()|[\]\\]/g, "\\$&")  // Escape regex metacharacters
          .replace(/\*\*/g, "<<<DOUBLESTAR>>>")
          .replace(/\*/g, "[^/]*")
          .replace(/<<<DOUBLESTAR>>>/g, ".*")
          .replace(/\?/g, ".");
        return new RegExp(`^${regex}$`);
      };
      const patternRegex = globToRegex(pattern);
      const files = [];
      function walk(dir) {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = p.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (entry.name !== "node_modules" && entry.name !== ".git") walk(full);
          } else {
            // Match against relative path from safePath
            const relPath = p.relative(safePath, full);
            if (patternRegex.test(relPath) || patternRegex.test(entry.name)) {
              files.push(full);
            }
          }
        }
      }
      walk(safePath);
      return { files: files.slice(0, 500) };
    }
  },

  "shell.exec": async (args) => {
    const { command, timeout = DEFAULT_TOOL_TIMEOUT_MS } = args;
    try {
      const trimmed = command.trim();
      const base = trimmed.split(/\s+/)[0];

      // Validate base command is allowed (pre-check before sandboxExec for better error messages)
      if (!guardrails.ALLOWED_COMMANDS.includes(base)) {
        return { error: `Command "${base}" not allowed. Allowed: ${guardrails.ALLOWED_COMMANDS.join(", ")}`, exitCode: 1 };
      }

      // Parse args properly — handle quoted strings
      const cmdArgs = parseCommandArgs(trimmed.slice(base.length).trim());

      // Pre-check dangerous patterns in args (defense-in-depth, sandboxExec also validates)
      const dangerousPatterns = ["$(", "`", "rm -rf", "mkfs", "dd if=", ":(){ :|:&", "chmod 777", "chown root"];
      for (const arg of cmdArgs) {
        const lowerArg = arg.toLowerCase();
        for (const pattern of dangerousPatterns) {
          if (lowerArg.includes(pattern.toLowerCase())) {
            return { error: `Command argument contains forbidden pattern: "${pattern}"`, exitCode: 1 };
          }
        }
      }

      // Validate cwd is within project root
      const projectRoot = args.projectRoot || args.cwd || process.cwd();
      const safeCwd = args.cwd ? guardrails.pathTraversal(args.cwd, projectRoot) : projectRoot;

      // Use sandboxExec — single enforcement point for BLOCKED_FLAGS + allowed commands
      const result = guardrails.sandboxExec(base, cmdArgs, {
        timeout,
        cwd: safeCwd,
      });
      return { stdout: result.trim(), exitCode: 0 };
    } catch (e) {
      return { error: e.message, exitCode: e.status || 1 };
    }
  },
};

let customTools = {};

function registerTool(name, handler) {
  if (!name.includes(".")) {
    throw new Error(`Tool must be namespaced (e.g., fs.read), got: "${name}"`);
  }
  customTools[name] = handler;
}

function resolveToolName(name) {
  if (LEGACY_ALIAS[name]) return LEGACY_ALIAS[name];
  return name;
}

function getTool(name) {
  const resolved = resolveToolName(name);
  return BUILTIN_TOOLS[resolved] || customTools[resolved] || null;
}

function listTools() {
  return [...Object.keys(BUILTIN_TOOLS), ...Object.keys(customTools)];
}

const MAX_RESULT_SIZE = 100 * 1024; // 100KB

function truncateResult(result) {
  let str;
  try {
    str = JSON.stringify(result);
  } catch {
    return { _truncated: true, _error: "Result contains circular references" };
  }
  if (str.length <= MAX_RESULT_SIZE) return result;
  const truncated = { ...result };
  truncated._truncated = true;
  // Truncate largest string fields first
  const HALF_MAX = MAX_RESULT_SIZE / 2;
  if (typeof truncated.content === "string" && truncated.content.length > HALF_MAX) {
    truncated.content = truncated.content.slice(0, HALF_MAX) + "...[truncated]";
  }
  if (typeof truncated.stdout === "string" && truncated.stdout.length > HALF_MAX) {
    truncated.stdout = truncated.stdout.slice(0, HALF_MAX) + "...[truncated]";
  }
  if (Array.isArray(truncated.matches)) {
    const matchesStr = JSON.stringify(truncated.matches);
    if (matchesStr.length > HALF_MAX) {
      truncated.matches = truncated.matches.slice(0, 50);
    }
  }
  if (Array.isArray(truncated.files)) {
    const filesStr = JSON.stringify(truncated.files);
    if (filesStr.length > HALF_MAX) {
      truncated.files = truncated.files.slice(0, 50);
    }
  }
  // Final size check — if still too large, do a hard truncation on the whole result
  const finalStr = JSON.stringify(truncated);
  if (finalStr.length > MAX_RESULT_SIZE * 1.5) {
    return { _truncated: true, _summary: `Result too large (${finalStr.length} bytes), truncated` };
  }
  return truncated;
}

async function executeToolIsolated(toolName, args, permissions = {}) {
  const { fork } = require("child_process");
  const path = require("path");

  const runnerPath = path.join(__dirname, "tool-runner.js");
  const env = {
    ...process.env,
    PERMISSIONS_FS: permissions.fs !== false ? "true" : "false",
    PERMISSIONS_NETWORK: permissions.network !== false ? "true" : "false",
    PERMISSIONS_EXEC: permissions.exec !== false ? "true" : "false",
    PERMISSIONS_ENV: permissions.env !== false ? "true" : "false",
  };

  return new Promise((resolve, reject) => {
    const child = fork(runnerPath, [toolName, JSON.stringify(args)], {
      env,
      stdio: ["pipe", "pipe", "pipe", "ipc"],
      timeout: 30000,
    });

    let output = "";
    child.stdout.on("data", (data) => { output += data; });
    child.stderr.on("data", () => {});

    child.on("close", (code) => {
      try {
        const result = JSON.parse(output || "{}");
        resolve(result);
      } catch {
        reject(new Error(`Tool runner failed (exit code ${code})`));
      }
    });

    child.on("error", reject);
  });
}

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
  MAX_RESULT_SIZE,
};
