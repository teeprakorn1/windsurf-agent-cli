/**
 * MCP Server — Model Context Protocol integration for aiyu-multi-agent
 *
 * Exposes 3 tools: list_agents, run_agent, inspect_agent
 * Transport: stdio (compatible with Claude Code, Cursor, Zed, Windsurf)
 *
 * Uses dynamic import for @modelcontextprotocol/sdk (ESM-only)
 */

const path = require("path");
const { listAgents } = require("./tools/list-agents");
const { runAgent } = require("./tools/run-agent");
const { inspectAgent } = require("./tools/inspect-agent");

const PKG = require("../../package.json");

async function startServer(projectDir) {
  // Dynamic import — SDK is ESM-only
  const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
  const { z } = await import("zod");

  const server = new McpServer({
    name: "aiyu-multi-agent",
    version: PKG.version,
  });

  // ── Tool: list_agents ─────────────────────────────────────────────
  server.tool(
    "list_agents",
    "List all available agents in the current project with their descriptions and capabilities",
    { verbose: z.boolean().optional().describe("Include skills and tools in output") },
    async ({ verbose }) => {
      const result = listAgents(projectDir, verbose);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // ── Tool: run_agent ───────────────────────────────────────────────
  server.tool(
    "run_agent",
    "Run an aiyu agent with the given input and return the result",
    {
      agent_name: z.string().optional().describe("Agent to run (omit for default)"),
      input: z.string().describe("The task/input for the agent"),
      provider: z.enum(["openai", "claude", "local", "mock"]).optional().describe("LLM provider override"),
      model: z.string().optional().describe("LLM model override"),
      max_steps: z.number().optional().describe("Max ReAct loop steps (default: 10)"),
    },
    async (params) => {
      const maxSteps = Math.min(params.max_steps || 10, 20); // Cap at 20 for MCP safety
      const MCP_TIMEOUT_MS = 120000; // 2 minutes — MCP clients typically timeout around 3-5 min
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`MCP run_agent timed out after ${MCP_TIMEOUT_MS / 1000}s`)), MCP_TIMEOUT_MS)
      );
      const provider = params.provider || undefined;
      const runPromise = runAgent({ ...params, max_steps: maxSteps, projectDir, provider });
      let result;
      try {
        result = await Promise.race([runPromise, timeoutPromise]);
      } catch (err) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: err.message, status: "timeout" }) }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // ── Tool: inspect_agent ───────────────────────────────────────────
  server.tool(
    "inspect_agent",
    "Get detailed information about a specific agent (skills, tools, instructions)",
    {
      agent_name: z.string().describe("Name of the agent to inspect"),
    },
    async ({ agent_name }) => {
      const result = inspectAgent(projectDir, agent_name);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // ── Start ─────────────────────────────────────────────────────────
  const healthCheck = require("../core/health-check");
  healthCheck.markInitialized();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  return server;
}

module.exports = { startServer };
