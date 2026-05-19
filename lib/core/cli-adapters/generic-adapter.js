const { spawn } = require("child_process");

const MAX_OUTPUT_BYTES = 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_ENV_KEYS = ["PATH", "HOME", "TERM"];

function messagesToPrompt(messages) {
  return messages
    .map(message => `${message.role.toUpperCase()}: ${message.content || ""}`)
    .join("\n\n");
}

function buildEnv(extraKeys = []) {
  const env = {};
  for (const key of [...DEFAULT_ENV_KEYS, ...extraKeys]) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return env;
}

function parseArgs(template = ["{prompt}"], prompt) {
  return template.map(arg => arg === "{prompt}" ? prompt : arg);
}

function callCliEngine(engine, messages, options = {}) {
  if (!engine || !engine.path) throw new Error("CLI engine path is required");

  const prompt = options.prompt || messagesToPrompt(messages);
  const timeoutMs = options.timeoutMs || engine.timeoutMs || DEFAULT_TIMEOUT_MS;
  const args = parseArgs(engine.args || ["{prompt}"], prompt);
  const env = buildEnv(engine.envAllowlist || options.envAllowlist || []);
  const cwd = options.projectDir || process.cwd();

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let outputBytes = 0;
    let settled = false;

    const child = spawn(engine.path, args, {
      cwd,
      env,
      shell: false,
      windowsHide: true,
    });

    const finish = (err, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(result);
    };

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error(`CLI engine ${engine.name} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", chunk => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        child.kill("SIGKILL");
        finish(new Error(`CLI engine ${engine.name} output exceeded ${MAX_OUTPUT_BYTES} bytes`));
        return;
      }
      stdout += chunk.toString("utf-8");
    });

    child.stderr.on("data", chunk => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        child.kill("SIGKILL");
        finish(new Error(`CLI engine ${engine.name} output exceeded ${MAX_OUTPUT_BYTES} bytes`));
        return;
      }
      stderr += chunk.toString("utf-8");
    });

    child.on("error", err => finish(err));
    child.on("close", code => {
      if (code !== 0) {
        finish(new Error(`CLI engine ${engine.name} exited with code ${code}: ${stderr.slice(0, 500)}`));
        return;
      }
      finish(null, {
        content: stdout.trim(),
        usage: {},
        toolCalls: [],
        providerMeta: { engine: engine.name, stderr: stderr.trim() || undefined },
      });
    });
  });
}

module.exports = {
  callCliEngine,
  messagesToPrompt,
  DEFAULT_TIMEOUT_MS,
  MAX_OUTPUT_BYTES,
};
