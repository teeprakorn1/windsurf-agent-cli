/**
 * Tool Parser — Parse tool calls from LLM responses
 *
 * Separated from agent-runtime.js for maintainability.
 * Fallback chain: API tool calls → TOOL_CALL regex → JSON code blocks → final answer
 */

const toolRegistry = require("./tool-registry");

function parseToolCalls(content, apiToolCalls) {
  // ── Fallback Chain: JSON → TOOL_CALL regex → final answer ──

  // Strategy 1: Structured API tool calls (OpenAI format)
  if (apiToolCalls && apiToolCalls.length > 0) {
    return apiToolCalls.map(tc => {
      const tool = toolRegistry.resolveToolName(tc.function?.name || tc.name);
      let args = {};
      try {
        args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : (tc.args || {});
      } catch {
        args = { _raw: tc.function?.arguments || "" };
      }
      return { tool, args };
    }).filter(tc => tc.tool);
  }

  // Strategy 2: TOOL_CALL: name(args) regex — handle nested parentheses in JSON args
  const calls = [];
  const tcRegex = /TOOL_CALL:\s*([\w.]+)\(/g;
  tcRegex.lastIndex = 0; // reset to prevent stale state from previous parse
  let tcMatch;
  while ((tcMatch = tcRegex.exec(content)) !== null) {
    const tool = toolRegistry.resolveToolName(tcMatch[1]);
    // Find matching closing paren by counting depth
    const startIdx = tcMatch.index + tcMatch[0].length;
    let depth = 1;
    let endIdx = startIdx;
    let inStr = false;
    let strCh = "";
    let escaped = false;
    for (; endIdx < content.length && depth > 0; endIdx++) {
      const ch = content[endIdx];
      if (inStr) {
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
          continue;
        } else if (ch === strCh) {
          inStr = false;
          continue;
        }
        continue;
      }
      if (ch === '"' || ch === "'") { inStr = true; strCh = ch; continue; }
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
    }
    const argsStr = content.slice(startIdx, endIdx - 1); // exclude closing paren
    let args = {};
    try {
      args = JSON.parse(argsStr || "{}");
    } catch {
      // Strategy 2b: try key=value parsing (double-quoted, single-quoted, unquoted)
      const kvPairs = argsStr.match(/(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^,}]+))/g);
      if (kvPairs) {
        kvPairs.forEach(kv => {
          const eqIdx = kv.indexOf("=");
          const k = kv.slice(0, eqIdx).trim();
          let v = kv.slice(eqIdx + 1).trim();
          if ((v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
              (v.startsWith("'") && v.endsWith("'") && v.length >= 2)) {
            v = v.slice(1, -1);
          }
          args[k] = v;
        });
      } else {
        args = { _raw: argsStr };
      }
    }
    calls.push({ tool, args });
  }
  if (calls.length > 0) return calls;

  // Strategy 3: Try extracting JSON action blocks
  const jsonBlockRegex = /```json\s*\n([\s\S]*?)\n```/g;
  let match;
  while ((match = jsonBlockRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.tool || parsed.action) {
        const tool = toolRegistry.resolveToolName(parsed.tool || parsed.action);
        calls.push({ tool, args: parsed.args || parsed.arguments || {} });
      }
    } catch { /* skip */ }
  }
  if (calls.length > 0) return calls;

  // Strategy 4: No tool calls found → final answer
  return [];
}

module.exports = { parseToolCalls };
