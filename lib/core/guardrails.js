/**
 * Guardrails — Security & safety layer
 */

const path = require("path");
const fs = require("fs");
const os = require("os");

const ALLOWED_COMMANDS = [
  "python3", "node", "git", "npm", "npx", "bun",
  "ls", "cat", "echo", "mkdir", "cp", "mv",
  "grep", "find", "head", "tail", "wc", "sort", "uniq",
];

const DEFAULT_SANDBOX_TIMEOUT = 30000;
const DEFAULT_MAX_BUFFER = 2 * 1024 * 1024;

const rateLimits = new Map();

function pathTraversal(filePath, projectRoot) {
  const resolved = path.normalize(path.resolve(filePath));
  const root = path.normalize(projectRoot || process.cwd());
  if (!resolved.startsWith(root)) {
    throw new Error(`Path traversal blocked: ${filePath} escapes project root`);
  }
  return resolved;
}

function safeWrite(filePath, content, encoding = "utf-8", projectRoot) {
  const safePath = pathTraversal(filePath, projectRoot);
  const dir = path.dirname(safePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(os.tmpdir(), `aiyu-multi-agent-${Date.now()}-${path.basename(safePath)}`);
  fs.writeFileSync(tmp, content, encoding);
  try {
    fs.renameSync(tmp, safePath);
  } catch (err) {
    if (err.code === "EXDEV") {
      // Cross-partition rename — copy then unlink
      fs.copyFileSync(tmp, safePath);
      fs.unlinkSync(tmp);
    } else {
      throw err;
    }
  }
  return safePath;
}

function rateLimit(key, maxPerMin = 60) {
  const now = Date.now();
  const window = 60000;

  // Cleanup: remove expired entries to prevent unbounded growth
  if (rateLimits.size > 100) {
    for (const [k, v] of rateLimits) {
      if (now - v.start > window) rateLimits.delete(k);
    }
  }

  const record = rateLimits.get(key) || { count: 0, start: now };
  if (now - record.start > window) {
    record.count = 0;
    record.start = now;
  }
  record.count++;
  rateLimits.set(key, record);
  if (record.count > maxPerMin) {
    throw new Error(`Rate limit exceeded: ${key} (${record.count}/${maxPerMin} per min)`);
  }
}

function sandboxExec(cmd, args = [], options = {}) {
  const base = path.basename(cmd);
  if (!ALLOWED_COMMANDS.includes(base)) {
    throw new Error(`Sandbox: command "${base}" not allowed. Allowed: ${ALLOWED_COMMANDS.join(", ")}`);
  }
  const { execFileSync } = require("child_process");
  return execFileSync(cmd, args, {
    encoding: "utf-8",
    cwd: options.cwd || process.cwd(),
    timeout: options.timeout || DEFAULT_SANDBOX_TIMEOUT,
    maxBuffer: options.maxBuffer || DEFAULT_MAX_BUFFER,
    env: options.env || process.env,
  });
}

module.exports = { pathTraversal, safeWrite, rateLimit, sandboxExec, ALLOWED_COMMANDS };
