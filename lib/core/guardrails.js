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

// Flags that allow arbitrary code execution — blocked even for allowed commands
const BLOCKED_FLAGS = ["-e", "--eval", "-i", "--interactive", "--repl", "-c", "--command"];

const DEFAULT_SANDBOX_TIMEOUT = 30000;
const DEFAULT_MAX_BUFFER = 2 * 1024 * 1024;

const rateLimits = new Map();
let _lastRateCleanup = Date.now();

function pathTraversal(filePath, projectRoot) {
  const root = path.normalize(projectRoot || process.cwd());
  const resolved = path.normalize(path.resolve(filePath));
  // Resolve symlinks to prevent directory traversal via symlink attacks
  let realResolved;
  try {
    realResolved = fs.realpathSync(resolved);
  } catch {
    // Path doesn't exist yet — resolve parent and join basename
    const parent = path.dirname(resolved);
    const base = path.basename(resolved);
    const realParent = fs.existsSync(parent) ? fs.realpathSync(parent) : parent;
    realResolved = path.join(realParent, base);
  }
  const realRoot = fs.realpathSync(root);
  if (!realResolved.startsWith(realRoot)) {
    throw new Error(`Path traversal blocked: ${filePath} escapes project root`);
  }
  return realResolved;
}

function safeWrite(filePath, content, encoding = "utf-8", projectRoot) {
  const safePath = pathTraversal(filePath, projectRoot);
  const dir = path.dirname(safePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const crypto = require("crypto");
  const tmp = path.join(os.tmpdir(), `aiyu-multi-agent-${crypto.randomUUID()}`);
  try {
    fs.writeFileSync(tmp, content, encoding);
  } catch (writeErr) {
    try { fs.unlinkSync(tmp); } catch { /* best effort */ }
    throw writeErr;
  }
  try {
    fs.renameSync(tmp, safePath);
  } catch (err) {
    if (err.code === "EXDEV") {
      // Cross-partition rename — copy then unlink
      try {
        fs.copyFileSync(tmp, safePath);
      } finally {
        try { fs.unlinkSync(tmp); } catch { /* best effort */ }
      }
    } else {
      try { fs.unlinkSync(tmp); } catch { /* best effort */ }
      throw err;
    }
  }
  return safePath;
}

function rateLimit(key, maxPerWindow = 60, windowMs = 60000) {
  const now = Date.now();

  // Cleanup: remove expired entries to prevent unbounded growth
  if (rateLimits.size > 100 || now - _lastRateCleanup > 60000) {
    for (const [k, v] of rateLimits) {
      if (now - v.start > v.window) rateLimits.delete(k);
    }
    _lastRateCleanup = now;
  }

  const record = rateLimits.get(key) || { count: 0, start: now, window: windowMs };
  if (now - record.start > record.window) {
    record.count = 0;
    record.start = now;
    record.window = windowMs;
  }
  record.count++;
  rateLimits.set(key, record);
  const windowLabel = windowMs < 1000 ? `${maxPerWindow} per ${windowMs}ms` : windowMs < 60000 ? `${maxPerWindow} per ${Math.round(windowMs / 1000)}s` : `${maxPerWindow} per min`;
  if (record.count > maxPerWindow) {
    throw new Error(`Rate limit exceeded: ${key} (${record.count}/${windowLabel})`);
  }
}

function _isBlockedFlag(arg) {
  for (const flag of BLOCKED_FLAGS) {
    if (arg === flag) return flag;
    if (arg.startsWith(flag + "=")) return flag;
    // Short flags (2 chars like -e, -c, -i): catch -ecode, -ccode, etc.
    if (flag.length === 2 && arg.length > 2 && arg[0] === flag[0] && arg[1] === flag[1]) return flag;
  }
  return null;
}

function sandboxExec(cmd, args = [], options = {}) {
  const base = cmd.includes(path.sep) ? path.basename(cmd) : cmd;
  if (!ALLOWED_COMMANDS.includes(base)) {
    throw new Error(`Sandbox: command "${base}" not allowed. Allowed: ${ALLOWED_COMMANDS.join(", ")}`);
  }
  // Block flags that enable arbitrary code execution (e.g., node -e "require('child_process').execSync('rm -rf /')")
  for (const arg of args) {
    const blocked = _isBlockedFlag(arg);
    if (blocked) {
      throw new Error(`Sandbox: flag "${blocked}" not allowed on ${base} — arbitrary code execution blocked`);
    }
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

module.exports = { pathTraversal, safeWrite, rateLimit, sandboxExec, ALLOWED_COMMANDS, BLOCKED_FLAGS };
