/**
 * LLM Providers — OpenAI, Claude, Ollama, Mock
 * Separated from agent-runtime.js for maintainability
 */

const https = require("https");
const http = require("http");

const MAX_RETRIES = 3;
const RETRYABLE_ERRORS = ["429", "503", "rate limit", "overloaded", "timeout", "ECONNRESET", "ETIMEDOUT"];

function isRetryableError(err) {
  const msg = (err.message || "").toLowerCase();
  return RETRYABLE_ERRORS.some(code => msg.includes(code.toLowerCase()));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callLLM(messages, options = {}) {
  const provider = options.provider || "mock";
  const model = options.model || "gpt-4";
  const maxRetries = options.maxRetries ?? MAX_RETRIES;

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      switch (provider) {
        case "openai":
          return await callOpenAI(messages, { ...options, model });
        case "claude":
          return await callClaude(messages, options);
        case "local":
          return await callOllama(messages, options);
        case "mock":
        default:
          return await callMock(messages, options);
      }
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries && isRetryableError(err)) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

async function callOpenAI(messages, options) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set. Run: export OPENAI_API_KEY=sk-...");

  const body = JSON.stringify({
    model: options.model || "gpt-4",
    messages,
    max_tokens: options.maxTokens || 2048,
    temperature: options.temperature ?? 0.7,
  });

  return new Promise((resolve, reject) => {
    const req = https.request("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      timeout: 60000,
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          resolve({
            content: parsed.choices?.[0]?.message?.content || "",
            usage: parsed.usage || {},
            toolCalls: parsed.choices?.[0]?.message?.tool_calls || [],
          });
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("LLM request timeout")); });
    req.write(body);
    req.end();
  });
}

async function callClaude(messages, options) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set. Run: export ANTHROPIC_API_KEY=sk-...");

  const systemMsg = messages.find(m => m.role === "system")?.content || "";
  const chatMessages = messages.filter(m => m.role !== "system");

  const bodyObj = {
    model: options.model || "claude-3-5-sonnet-20241022",
    max_tokens: options.maxTokens || 2048,
    system: systemMsg,
    messages: chatMessages,
  };

  // Claude tool use support
  if (options.tools && options.tools.length > 0) {
    bodyObj.tools = options.tools;
  }

  const body = JSON.stringify(bodyObj);

  return new Promise((resolve, reject) => {
    const req = https.request("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      timeout: 60000,
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));

          // Extract tool calls from Claude's content blocks
          const toolCalls = [];
          let textContent = "";
          for (const block of (parsed.content || [])) {
            if (block.type === "text") {
              textContent += block.text;
            } else if (block.type === "tool_use") {
              toolCalls.push({
                function: { name: block.name, arguments: JSON.stringify(block.input || {}) },
              });
            }
          }

          resolve({
            content: textContent,
            usage: parsed.usage || {},
            toolCalls,
          });
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("LLM request timeout")); });
    req.write(body);
    req.end();
  });
}

async function callOllama(messages, options) {
  const bodyObj = {
    model: options.model || "llama3",
    messages,
    stream: false,
  };

  // Ollama tool support (available in newer models)
  if (options.tools && options.tools.length > 0) {
    bodyObj.tools = options.tools;
  }

  const body = JSON.stringify(bodyObj);

  return new Promise((resolve, reject) => {
    const req = http.request("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      timeout: 120000,
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);

          // Extract tool calls from Ollama response
          const toolCalls = [];
          if (parsed.message?.tool_calls) {
            for (const tc of parsed.message.tool_calls) {
              toolCalls.push({
                function: { name: tc.function?.name || tc.name, arguments: JSON.stringify(tc.function?.arguments || tc.args || {}) },
              });
            }
          }

          resolve({
            content: parsed.message?.content || "",
            usage: {},
            toolCalls,
          });
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Ollama timeout")); });
    req.write(body);
    req.end();
  });
}

async function callMock(messages, options) {
  // Only look at original user messages (not tool result messages)
  const userMsgs = messages.filter(m => m.role === "user" && !m.content.startsWith("Tool result") && !m.content.startsWith("Tool error"));
  const lastUserMsg = userMsgs.pop()?.content || "";
  const hasToolResults = messages.some(m => m.role === "user" && m.content.startsWith("Tool result"));

  // If we already executed a tool, return a final answer (no more tool calls)
  if (hasToolResults) {
    return {
      content: `[Mock Response] Tool executed successfully. Based on the tool result, here is the answer to: "${lastUserMsg.slice(0, 80)}"`,
      usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
      toolCalls: [],
    };
  }

  // Simulate tool calls if the message looks like it needs one
  if (lastUserMsg.toLowerCase().includes("read") || lastUserMsg.toLowerCase().includes("file")) {
    return {
      content: `I'll read that file for you.\n\nTOOL_CALL: fs.read({"path": "package.json"})`,
      usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
      toolCalls: [{
        function: { name: "fs.read", arguments: JSON.stringify({ path: "package.json" }) },
      }],
    };
  }

  if (lastUserMsg.toLowerCase().includes("run") || lastUserMsg.toLowerCase().includes("exec")) {
    return {
      content: `I'll execute that command.\n\nTOOL_CALL: shell.exec({"command": "echo hello"})`,
      usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
      toolCalls: [{
        function: { name: "shell.exec", arguments: JSON.stringify({ command: "echo hello" }) },
      }],
    };
  }

  return {
    content: options.outputFormat === "json"
      ? JSON.stringify({ response: `I received your request: "${lastUserMsg.slice(0, 100)}"`, note: "To get real responses, set OPENAI_API_KEY or ANTHROPIC_API_KEY." })
      : `[Mock Response] I received your request: "${lastUserMsg.slice(0, 100)}"\n\nTo get real responses, set OPENAI_API_KEY or ANTHROPIC_API_KEY.`,
    usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
    toolCalls: [],
  };
}

module.exports = { callLLM, callOpenAI, callClaude, callOllama, callMock };
