/**
 * Tool Definitions — Builtin tool implementations + registry + schemas
 *
 * Separated from tool-registry.js for maintainability.
 * Search tools (grep, glob) live in search-tools.js.
 */

const fs = require("fs");
const path = require("path");
const guardrails = require("./guardrails");
const { parseCommandArgs } = require("./command-parser");
const { searchGrep, fsGlob, DEFAULT_TOOL_TIMEOUT_MS } = require("./search-tools");

// ── Tool Argument Schemas ─────────────────────────────────────────────

const TOOL_SCHEMAS = {
  "fs.read":       { required: ["path"], optional: ["offset", "limit"] },
  "fs.write":      { required: ["path", "content"], optional: [] },
  "fs.edit":       { required: ["path", "old_string", "new_string"], optional: [] },
  "fs.glob":       { required: ["pattern"], optional: ["path"] },
  "search.grep":   { required: ["pattern"], optional: ["path"] },
  "shell.exec":    { required: ["command"], optional: ["timeout", "cwd"] },
  "fetch.url":     { required: ["url"], optional: ["method", "headers", "body", "timeout"] },
  "agent.delegate": { required: ["agent", "input"], optional: ["maxSteps"] },
  "memory.save":   { required: ["key", "value"], optional: [] },
  "memory.load":   { required: ["key"], optional: [] },
  "web.search":    { required: ["query"], optional: ["maxResults"] },
  "plan.create":   { required: ["tasks"], optional: ["name"] },
  "plan.update":   { required: ["planId", "taskId", "status"], optional: [] },
  "plan.list":     { required: [], optional: ["planId"] },
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
  Agent: "agent.delegate",
};

const BUILTIN_TOOLS = {
  "fs.read": async (args) => {
    const projectRoot = args.projectRoot || args.cwd || process.cwd();
    const filePath = guardrails.pathTraversal(args.path || args.file_path, projectRoot);
    if (!fs.existsSync(filePath)) return { error: `File not found: ${filePath}` };
    const stat = fs.statSync(filePath);
    const MAX_FILE_SIZE = 1024 * 1024; // 1MB
    if (stat.size > MAX_FILE_SIZE) return { error: `File too large: ${stat.size} bytes (max ${MAX_FILE_SIZE})` };
    let content = fs.readFileSync(filePath, "utf-8");
    if (args.offset || args.limit) {
      const lines = content.split("\n");
      const start = Math.max(0, (args.offset || 1) - 1);
      const end = args.limit ? start + args.limit : lines.length;
      content = lines.slice(start, end).join("\n");
      return { content, lines: content.split("\n").length, totalLines: lines.length, offset: args.offset || 1 };
    }
    return { content, lines: content.split("\n").length };
  },

  "fs.write": async (args) => {
    const projectRoot = args.projectRoot || args.cwd || process.cwd();
    const filePath = guardrails.pathTraversal(args.path || args.file_path, projectRoot);
    guardrails.safeWrite(filePath, args.content || "", "utf-8", projectRoot);
    return { written: true, path: filePath };
  },

  "fs.edit": async (args) => {
    const projectRoot = args.projectRoot || args.cwd || process.cwd();
    const filePath = guardrails.pathTraversal(args.path || args.file_path, projectRoot);
    if (!fs.existsSync(filePath)) return { error: `File not found: ${filePath}` };
    let content = fs.readFileSync(filePath, "utf-8");
    if (!content.includes(args.old_string)) return { error: "old_string not found in file" };
    const occurrences = content.split(args.old_string).length - 1;
    if (occurrences > 1) return { error: `old_string found ${occurrences} times — must be unique. Add more context to old_string.`, occurrences };
    content = content.replace(args.old_string, args.new_string);
    guardrails.safeWrite(filePath, content, "utf-8", projectRoot);
    return { edited: true, path: filePath };
  },

  "search.grep": searchGrep,
  "fs.glob": fsGlob,

  "shell.exec": async (args) => {
    const { command, timeout = DEFAULT_TOOL_TIMEOUT_MS } = args;
    try {
      const trimmed = command.trim();
      const firstToken = trimmed.split(/\s+/)[0];
      const base = firstToken.includes(path.sep) ? path.basename(firstToken) : firstToken;

      if (!guardrails.ALLOWED_COMMANDS.includes(base)) {
        return { error: `Command "${base}" not allowed. Allowed: ${guardrails.ALLOWED_COMMANDS.join(", ")}`, exitCode: 1 };
      }

      if (firstToken.includes(path.sep) || firstToken.includes("/")) {
        return { error: `Path-prefixed commands not allowed (use bare command name): ${firstToken}`, exitCode: 1 };
      }

      const cmdArgs = parseCommandArgs(trimmed.slice(firstToken.length).trim());

      const dangerousPatterns = ["$(", "`", "rm -rf", "mkfs", "dd if=", ":(){ :|:&", "chmod 777", "chown root"];
      for (const arg of cmdArgs) {
        const lowerArg = arg.toLowerCase();
        for (const pattern of dangerousPatterns) {
          if (lowerArg.includes(pattern.toLowerCase())) {
            return { error: `Command argument contains forbidden pattern: "${pattern}"`, exitCode: 1 };
          }
        }
      }

      const projectRoot = args.projectRoot || args.cwd || process.cwd();
      const safeCwd = args.cwd ? guardrails.pathTraversal(args.cwd, projectRoot) : projectRoot;

      const result = guardrails.sandboxExec(base, cmdArgs, {
        timeout,
        cwd: safeCwd,
      });
      return { stdout: result.trim(), exitCode: 0 };
    } catch (e) {
      return { error: e.message, exitCode: e.status || 1 };
    }
  },

  "fetch.url": async (args) => {
    const http = require("http");
    const https = require("https");
    const { URL } = require("url");
    const dns = require("dns");

    const FETCH_TIMEOUT_MS = args.timeout || 15000;
    const MAX_RESPONSE_SIZE = 1024 * 1024; // 1MB
    const MAX_REDIRECTS = 3;

    let parsedUrl;
    try {
      parsedUrl = new URL(args.url);
    } catch {
      return { error: `Invalid URL: ${args.url}` };
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return { error: `Unsupported protocol: ${parsedUrl.protocol} (only http/https allowed)` };
    }

    // SSRF protection — block private/link-local IPs
    const _isPrivateIP = (ip) => {
      if (!ip) return false;
      // IPv4: loopback, link-local, RFC1918, broadcast
      if (/^(127\.|0\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|255\.)/.test(ip)) return true;
      // IPv6: loopback, link-local, unique-local
      if (/^(::1|fe80:|fd|fc)/i.test(ip)) return true;
      return false;
    };

    const _resolveAndCheckHost = (hostname) => new Promise((resolve, reject) => {
      dns.lookup(hostname, (err, address) => {
        if (err) return reject(err);
        if (_isPrivateIP(address)) return reject(new Error(`SSRF blocked: ${hostname} resolves to private IP ${address}`));
        resolve(address);
      });
    });

    try {
      await _resolveAndCheckHost(parsedUrl.hostname);
    } catch (ssrfErr) {
      return { error: ssrfErr.message };
    }

    const method = (args.method || "GET").toUpperCase();
    const headers = args.headers || {};
    const body = args.body ?? null;

    function doFetch(url, redirectCount) {
      return new Promise((resolve) => {
        const transport = url.protocol === "https:" ? https : http;

        const reqOpts = {
          hostname: url.hostname,
          port: url.port || (url.protocol === "https:" ? 443 : 80),
          path: url.pathname + url.search,
          method,
          headers: {
            "User-Agent": "aiyu-multi-agent/fetch",
            ...headers,
          },
          timeout: FETCH_TIMEOUT_MS,
        };

        const req = transport.request(reqOpts, (res) => {
          if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
            if (redirectCount >= MAX_REDIRECTS) {
              resolve({ error: `Too many redirects (max ${MAX_REDIRECTS})`, status: res.statusCode });
              return;
            }
            try {
              const redirectUrl = new URL(res.headers.location, url);
              if (!["http:", "https:"].includes(redirectUrl.protocol)) {
                resolve({ error: `Redirect to unsupported protocol: ${redirectUrl.protocol}` });
                return;
              }
              // SSRF check on redirect target
              _resolveAndCheckHost(redirectUrl.hostname).then(() => {
                res.resume();
                resolve(doFetch(redirectUrl, redirectCount + 1));
              }).catch((ssrfErr) => {
                res.resume();
                resolve({ error: ssrfErr.message });
              });
              return;
            } catch {
              resolve({ error: `Invalid redirect URL: ${res.headers.location}` });
              return;
            }
          }

          const chunks = [];
          let byteSize = 0;

          res.on("data", (chunk) => {
            byteSize += chunk.length;
            if (byteSize <= MAX_RESPONSE_SIZE) {
              chunks.push(chunk);
            }
          });

          res.on("end", () => {
            const truncated = byteSize >= MAX_RESPONSE_SIZE;
            const data = Buffer.concat(chunks).toString("utf-8").slice(0, 100000);

            resolve({
              status: res.statusCode,
              headers: { "content-type": res.headers["content-type"] || "" },
              body: data,
              _truncated: truncated,
            });
          });
        });

        req.on("error", (err) => {
          resolve({ error: `Fetch failed: ${err.message}` });
        });

        req.on("timeout", () => {
          req.destroy();
          resolve({ error: `Fetch timeout after ${FETCH_TIMEOUT_MS}ms` });
        });

        if (body !== null) {
          req.write(typeof body === "string" ? body : JSON.stringify(body));
        }

        req.end();
      });
    }

    return doFetch(parsedUrl, 0);
  },

  // ── Agent Tool: Delegate task to another agent ──────────────────────
  "agent.delegate": async (args) => {
    const MAX_DELEGATE_DEPTH = 3;
    const DELEGATE_TIMEOUT_MS = 60000;

    const depth = args._delegateDepth || 0;
    if (depth >= MAX_DELEGATE_DEPTH) {
      return { error: `Max delegate depth (${MAX_DELEGATE_DEPTH}) exceeded. Cannot delegate further.` };
    }
    if (args.agent === args._currentAgent) {
      return { error: `Cannot delegate to self (${args.agent}).` };
    }

    const projectDir = args.projectRoot || args.cwd || process.cwd();
    const agentName = args.agent;
    const input = args.input;
    const maxSteps = Math.min(parseInt(args.maxSteps, 10) || 10, 20);

    // Broadcast delegate started (v2.7.0 — dashboard support)
    try {
      const { broadcastDelegateStarted, broadcastDelegateComplete } = require("../api/ws");
      const runId = args._runId || null;
      const parentAgent = args._currentAgent || "unknown";
      broadcastDelegateStarted(runId, parentAgent, agentName, depth + 1);
    } catch { /* ws module not loaded — CLI-only mode */ }

    try {
      const { loadAgentSpec, loadSkillInstructions } = require("./agent-loader");
      const agentSpec = loadAgentSpec(projectDir, agentName);
      const skillInstructions = loadSkillInstructions(projectDir, agentSpec.skills);
      const { buildSystemPrompt } = require("./prompt-builder");
      const agentSystem = require("./agent-system");
      const projectProfile = agentSystem.detect(projectDir);
      const systemPrompt = buildSystemPrompt(agentSpec, skillInstructions, projectProfile);

      const provider = args._provider || agentSpec.provider || undefined;
      const model = args._model || agentSpec.model || "gpt-4";

      const { callLLMWithFailover } = require("./failover");
      const { parseToolCalls } = require("./tool-parser");
      const { sanitizeInput, safeStringify } = require("./input-sanitizer");

      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: sanitizeInput(input) },
      ];

      let output = null;
      let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      let delegateTimeoutId;
      const delegateTimeout = new Promise((_, reject) => {
        delegateTimeoutId = setTimeout(() => reject(new Error(`Delegate timeout after ${DELEGATE_TIMEOUT_MS / 1000}s`)), DELEGATE_TIMEOUT_MS);
      });

      const runPromise = (async () => {
        for (let step = 0; step < maxSteps; step++) {
          let response;
          try {
            const result = await callLLMWithFailover(messages, { provider, model, outputFormat: "text" });
            response = result.response;
            if (response.usage) {
              totalUsage.promptTokens += response.usage.promptTokens || 0;
              totalUsage.completionTokens += response.usage.completionTokens || 0;
              totalUsage.totalTokens += response.usage.totalTokens || 0;
            }
          } catch (err) {
            return { error: `Delegate LLM call failed: ${err.message}`, usage: totalUsage };
          }

          const content = response.content || "";
          const toolCalls = parseToolCalls(content, response.toolCalls);

          if (toolCalls.length === 0) {
            return { output: content, steps: step + 1, agent: agentName, usage: totalUsage };
          }

          messages.push({ role: "assistant", content });

          for (const tc of toolCalls) {
            const resolvedName = resolveToolName(tc.tool);
            const tool = getTool(resolvedName);
            if (!tool) {
              messages.push({ role: "user", content: `Tool error: "${resolvedName}" not found.` });
              continue;
            }
            const toolArgs = { ...tc.args, projectRoot: projectDir, _delegateDepth: depth + 1, _currentAgent: agentName, _provider: provider, _model: model };
            try {
              const result = await tool(toolArgs);
              messages.push({ role: "user", content: `Tool result (${resolvedName}): ${safeStringify(result)}` });
            } catch (err) {
              messages.push({ role: "user", content: `Tool error (${resolvedName}): ${err.message}` });
            }
          }

          // Enforce context size limit to prevent OOM in long-running delegates
          const DELEGATE_MAX_CONTEXT = 100000;
          const totalChars = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
          if (totalChars > DELEGATE_MAX_CONTEXT) {
            const excess = totalChars - DELEGATE_MAX_CONTEXT;
            const trimmable = messages.filter(m => m.role !== "system");
            if (trimmable.length > 0) {
              const trimPerMsg = Math.ceil(excess / trimmable.length) + 100;
              for (const m of trimmable) {
                if (m.content && m.content.length > trimPerMsg * 2) {
                  m.content = m.content.slice(0, Math.max(100, m.content.length - trimPerMsg)) + "\n...[truncated for context limit]";
                }
              }
            }
            while (messages.reduce((sum, m) => sum + (m.content?.length || 0), 0) > DELEGATE_MAX_CONTEXT && messages.length > 3) {
              // Pair-preservation: don't orphan user(tool result) without preceding assistant
              if (messages[1]?.role === "assistant" && messages[2]?.role === "user") {
                messages.splice(1, 2);
              } else if (messages[1]?.role === "assistant") {
                messages.splice(1, 1);
              } else {
                // Orphaned user message — include preceding assistant if it exists
                messages.splice(1, 1);
              }
            }
          }
        }
        return { output: messages[messages.length - 1]?.content || "Max steps reached", steps: maxSteps, agent: agentName, maxStepsReached: true, usage: totalUsage };
      })();

      const result = await Promise.race([runPromise, delegateTimeout]);
      clearTimeout(delegateTimeoutId);

      // Broadcast delegate complete (v2.7.0 — dashboard support)
      try {
        const { broadcastDelegateComplete } = require("../api/ws");
        const runId = args._runId || null;
        const status = result.error ? "error" : (result.maxStepsReached ? "max_steps" : "completed");
        broadcastDelegateComplete(runId, agentName, status);
      } catch { /* ws module not loaded — CLI-only mode */ }

      return result;
    } catch (err) {
      // Broadcast delegate error
      try {
        const { broadcastDelegateComplete } = require("../api/ws");
        const runId = args._runId || null;
        broadcastDelegateComplete(runId, agentName, "error");
      } catch { /* ws module not loaded */ }
      return { error: `Delegate failed: ${err.message}` };
    }
  },

  // ── Memory Tools: Save/Load agent memory ────────────────────────────
  "memory.save": async (args) => {
    const projectDir = args.projectRoot || args.cwd || process.cwd();
    const agentName = (args._currentAgent || "default").replace(/[^a-zA-Z0-9_-]/g, "_");
    const key = args.key.replace(/[^a-zA-Z0-9_-]/g, "_");
    const value = args.value;

    const memoryDir = path.join(projectDir, ".agent", "memory", agentName);
    fs.mkdirSync(memoryDir, { recursive: true });

    const filePath = path.join(memoryDir, `${key}.json`);
    guardrails.pathTraversal(filePath, projectDir);
    const data = {
      key,
      value,
      agent: agentName,
      savedAt: new Date().toISOString(),
    };
    guardrails.safeWrite(filePath, JSON.stringify(data, null, 2), "utf-8", projectDir);
    return { saved: true, key, path: filePath };
  },

  "memory.load": async (args) => {
    const projectDir = args.projectRoot || args.cwd || process.cwd();
    const agentName = (args._currentAgent || "default").replace(/[^a-zA-Z0-9_-]/g, "_");
    const key = (args.key || "default").replace(/[^a-zA-Z0-9_-]/g, "_");
    const memoryDir = path.join(projectDir, ".agent", "memory", agentName);
    const memoryFile = path.join(memoryDir, `${key}.json`);
    guardrails.pathTraversal(memoryFile, projectDir);
    if (!fs.existsSync(memoryFile)) {
      return { error: `Memory key not found: ${key}`, key };
    }
    try {
      const data = JSON.parse(fs.readFileSync(memoryFile, "utf-8"));
      return { key: data.key, value: data.value, savedAt: data.savedAt };
    } catch {
      return { error: `Failed to read memory key: ${key}` };
    }
  },

  // ── Web Search Tool: Configurable multi-provider ─────────────────────
  "web.search": async (args) => {
    const query = args.query;
    const maxResults = Math.min(parseInt(args.maxResults, 10) || 5, 10);
    const projectDir = args.projectRoot || args.cwd || process.cwd();

    // Load web search config from config.yaml
    let searchConfig = { provider: "searxng" };
    try {
      const config = require("./config");
      const cfgDir = config.getConfigDir(projectDir);
      if (cfgDir) {
        const configPath = path.join(cfgDir, "config.yaml");
        if (fs.existsSync(configPath)) {
          const YAML = require("yaml");
          const cfg = YAML.parse(fs.readFileSync(configPath, "utf-8"));
          if (cfg.webSearch) searchConfig = { ...searchConfig, ...cfg.webSearch };
        }
      }
    } catch { /* use defaults */ }

    const provider = searchConfig.provider || "serpapi";
    const apiKey = searchConfig.apiKey || process.env.WEB_SEARCH_API_KEY || "";

    try {
      if (provider === "searxng") {
        const baseUrl = searchConfig.baseUrl || process.env.SEARXNG_URL || "http://localhost:8080";
        const http = require("http");
        const url = new URL(`/search?q=${encodeURIComponent(query)}&format=json&limit=${maxResults}`, baseUrl);
        return await new Promise((resolve) => {
          http.get(url, { timeout: 10000 }, (res) => {
            let data = "";
            res.on("data", (chunk) => { data += chunk; });
            res.on("end", () => {
              try {
                const json = JSON.parse(data);
                const results = (json.results || []).slice(0, maxResults).map(r => ({
                  title: r.title || "", url: r.url || "", snippet: r.content || "",
                }));
                resolve({ query, provider, results, count: results.length });
              } catch {
                resolve({ error: "Failed to parse SearXNG response", query, provider });
              }
            });
          }).on("error", (err) => {
            resolve({ error: `SearXNG request failed: ${err.message}`, query, provider });
          });
        });
      }

      if (provider === "serper") {
        if (!apiKey) return { error: "Serper API key required. Set webSearch.apiKey in config.yaml or WEB_SEARCH_API_KEY env var.", query, provider };
        const https = require("https");
        return await new Promise((resolve) => {
          const postData = JSON.stringify({ q: query, num: maxResults });
          const req = https.request("https://google.serper.dev/search", {
            method: "POST",
            headers: { "X-API-KEY": apiKey, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(postData) },
            timeout: 10000,
          }, (res) => {
            let data = "";
            res.on("data", (chunk) => { data += chunk; });
            res.on("end", () => {
              try {
                const json = JSON.parse(data);
                const results = (json.organic || []).map(r => ({
                  title: r.title || "", url: r.link || "", snippet: r.snippet || "",
                }));
                resolve({ query, provider, results, count: results.length });
              } catch {
                resolve({ error: "Failed to parse Serper response", query, provider });
              }
            });
          });
          req.on("error", (err) => { resolve({ error: `Serper request failed: ${err.message}`, query, provider }); });
          req.write(postData);
          req.end();
        });
      }

      if (provider === "tavily") {
        if (!apiKey) return { error: "Tavily API key required. Set webSearch.apiKey in config.yaml or WEB_SEARCH_API_KEY env var.", query, provider };
        const https = require("https");
        return await new Promise((resolve) => {
          const postData = JSON.stringify({ query, max_results: maxResults, api_key: apiKey });
          const req = https.request("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(postData) },
            timeout: 10000,
          }, (res) => {
            let data = "";
            res.on("data", (chunk) => { data += chunk; });
            res.on("end", () => {
              try {
                const json = JSON.parse(data);
                const results = (json.results || []).map(r => ({
                  title: r.title || "", url: r.url || "", snippet: r.content || "",
                }));
                resolve({ query, provider, results, count: results.length });
              } catch {
                resolve({ error: "Failed to parse Tavily response", query, provider });
              }
            });
          });
          req.on("error", (err) => { resolve({ error: `Tavily request failed: ${err.message}`, query, provider }); });
          req.write(postData);
          req.end();
        });
      }

      return { error: `Unknown web search provider: ${provider}. Supported: searxng, serper, tavily.`, query, provider };
    } catch (err) {
      return { error: `Web search failed: ${err.message}`, query, provider };
    }
  },

  // ── Plan Tools: Structured task planning ─────────────────────────────
  "plan.create": async (args) => {
    const projectDir = args.projectRoot || args.cwd || process.cwd();
    const planName = (args.name || `plan-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, "_");
    const tasks = args.tasks;

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return { error: "tasks must be a non-empty array of { id, content, status? }" };
    }

    const planDir = path.join(projectDir, ".agent", "plans");
    fs.mkdirSync(planDir, { recursive: true });

    const plan = {
      id: planName,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      tasks: tasks.map(t => ({
        id: t.id || `task-${Date.now()}`,
        content: t.content || "",
        status: t.status || "pending",
      })),
    };

    const filePath = path.join(planDir, `${planName}.json`);
    guardrails.safeWrite(filePath, JSON.stringify(plan, null, 2), "utf-8", projectDir);
    return { created: true, planId: planName, taskCount: plan.tasks.length, path: filePath };
  },

  "plan.update": async (args) => {
    const projectDir = args.projectRoot || args.cwd || process.cwd();
    const { planId, taskId, status } = args;

    const validStatuses = ["pending", "in_progress", "completed", "blocked", "skipped"];
    if (!validStatuses.includes(status)) {
      return { error: `Invalid status: ${status}. Valid: ${validStatuses.join(", ")}` };
    }

    const safePlanId = planId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filePath = path.join(projectDir, ".agent", "plans", `${safePlanId}.json`);
    guardrails.pathTraversal(filePath, projectDir);
    if (!fs.existsSync(filePath)) {
      return { error: `Plan not found: ${planId}` };
    }

    try {
      const plan = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const task = plan.tasks.find(t => t.id === taskId);
      if (!task) return { error: `Task not found: ${taskId} in plan ${planId}` };

      task.status = status;
      plan.updated = new Date().toISOString();
      guardrails.safeWrite(filePath, JSON.stringify(plan, null, 2), "utf-8", projectDir);

      const completed = plan.tasks.filter(t => t.status === "completed").length;
      const total = plan.tasks.length;
      return { updated: true, planId, taskId, status, progress: `${completed}/${total}` };
    } catch {
      return { error: `Failed to update plan: ${planId}` };
    }
  },

  "plan.list": async (args) => {
    const projectDir = args.projectRoot || args.cwd || process.cwd();
    const planDir = path.join(projectDir, ".agent", "plans");

    if (args.planId) {
      const safePlanId = args.planId.replace(/[^a-zA-Z0-9_-]/g, "_");
      const filePath = path.join(planDir, `${safePlanId}.json`);
      guardrails.pathTraversal(filePath, projectDir);
      if (!fs.existsSync(filePath)) return { error: `Plan not found: ${args.planId}` };
      try {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
      } catch {
        return { error: `Failed to read plan: ${args.planId}` };
      }
    }

    if (!fs.existsSync(planDir)) return { plans: [], count: 0 };

    const files = fs.readdirSync(planDir).filter(f => f.endsWith(".json"));
    const plans = files.map(f => {
      try {
        const plan = JSON.parse(fs.readFileSync(path.join(planDir, f), "utf-8"));
        const completed = plan.tasks?.filter(t => t.status === "completed").length || 0;
        const total = plan.tasks?.length || 0;
        return { id: plan.id, created: plan.created, updated: plan.updated, progress: `${completed}/${total}` };
      } catch { return null; }
    }).filter(Boolean);

    return { plans, count: plans.length };
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
  const truncated = Array.isArray(result) ? [...result] : { ...result };
  truncated._truncated = true;
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
  try {
    const finalStr = JSON.stringify(truncated);
    if (finalStr.length > MAX_RESULT_SIZE * 1.5) {
      return { _truncated: true, _summary: `Result too large (${finalStr.length} bytes), truncated` };
    }
  } catch {
    return { _truncated: true, _summary: `Result too large, could not serialize` };
  }
  return truncated;
}

async function executeToolIsolated(toolName, args, permissions = {}) {
  const { fork } = require("child_process");

  const runnerPath = path.join(__dirname, "tool-runner.js");
  const projectRoot = args.projectRoot || args.cwd || process.cwd();
  const env = { ...process.env };
  // Strip sensitive env vars to prevent secret leakage to child processes
  for (const key of Object.keys(env)) {
    if (/(?:API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|PRIVATE_KEY)/i.test(key)) {
      delete env[key];
    }
  }
  env.PERMISSIONS_FS = permissions.fs !== false ? "true" : "false";
  env.PERMISSIONS_NETWORK = permissions.network !== false ? "true" : "false";
  env.PERMISSIONS_EXEC = permissions.exec !== false ? "true" : "false";
  env.PERMISSIONS_ENV = permissions.env !== false ? "true" : "false";

  return new Promise((resolve, reject) => {
    const child = fork(runnerPath, [toolName, JSON.stringify(args)], {
      cwd: projectRoot,
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
