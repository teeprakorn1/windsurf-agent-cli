/**
 * Tool call simulator — mock tool calls and LLM responses for testing
 */

const MOCK_TOOL_RESPONSES = {
  // Namespaced names (canonical)
  "fs.read": { status: "ok", content: "// mock file content" },
  "fs.write": { status: "ok", written: true },
  "fs.edit": { status: "ok", edited: true },
  "search.grep": { status: "ok", matches: [] },
  "fs.glob": { status: "ok", files: [] },
  "shell.exec": { status: "ok", stdout: "mock output", exitCode: 0 },
  // Legacy aliases (backward compat)
  Read: { status: "ok", content: "// mock file content" },
  Write: { status: "ok", written: true },
  Edit: { status: "ok", edited: true },
  Grep: { status: "ok", matches: [] },
  Glob: { status: "ok", files: [] },
  Bash: { status: "ok", stdout: "mock output", exitCode: 0 },
};

function simulateToolCall(toolName, args = {}) {
  const response = MOCK_TOOL_RESPONSES[toolName];
  if (!response) {
    return { status: "error", error: `Unknown tool: ${toolName}` };
  }
  return { ...response, tool: toolName, args };
}

function simulateLLMResponse(prompt, options = {}) {
  return {
    role: "assistant",
    content: options.mockResponse || `Mock response for: ${prompt.slice(0, 100)}`,
    toolCalls: options.mockToolCalls || [],
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
  };
}

function createMockContext(overrides = {}) {
  return {
    tools: overrides.tools || ["Read", "Write", "Edit", "Grep", "Glob", "Bash"],
    provider: overrides.provider || "mock",
    memory: overrides.memory || "none",
    guardrails: overrides.guardrails !== false,
    ...overrides,
  };
}

module.exports = { simulateToolCall, simulateLLMResponse, createMockContext, MOCK_TOOL_RESPONSES };
