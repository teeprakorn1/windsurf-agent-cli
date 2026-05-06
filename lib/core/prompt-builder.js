/**
 * Prompt Builder — Build system prompts for agent execution
 *
 * Separated from agent-runtime.js for maintainability.
 */

const toolRegistry = require("./tool-registry");
const agentSystem = require("./agent-system");

const MAX_SKILL_INSTRUCTION_CHARS = 8000; // Per-skill instruction limit in system prompt

function truncateSkillContent(content) {
  if (content.length <= MAX_SKILL_INSTRUCTION_CHARS) return content;

  // Section-aware truncation: keep headings + first paragraph of each section
  const lines = content.split("\n");
  const kept = [];
  let totalLen = 0;
  let inCodeBlock = false;
  let codeBlockLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track code blocks — always include them whole or skip entirely
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        codeBlockLines.push(line);
        const blockLen = codeBlockLines.join("\n").length;
        if (totalLen + blockLen <= MAX_SKILL_INSTRUCTION_CHARS) {
          kept.push(...codeBlockLines);
          totalLen += blockLen;
        }
        inCodeBlock = false;
        codeBlockLines = [];
      } else {
        inCodeBlock = true;
        codeBlockLines = [line];
      }
      continue;
    }
    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Always keep headings (## or ###)
    if (/^#{1,3}\s/.test(line)) {
      if (totalLen + line.length + 1 <= MAX_SKILL_INSTRUCTION_CHARS) {
        kept.push(line);
        totalLen += line.length + 1;
      }
      continue;
    }

    // Keep regular lines while space allows
    if (totalLen + line.length + 1 <= MAX_SKILL_INSTRUCTION_CHARS) {
      kept.push(line);
      totalLen += line.length + 1;
    } else {
      // Truncate this line to fit
      const remaining = MAX_SKILL_INSTRUCTION_CHARS - totalLen;
      if (remaining > 20) {
        kept.push(line.slice(0, remaining - 3) + "...");
      }
      break;
    }
  }

  return kept.join("\n");
}

function buildSystemPrompt(agentSpec, skillInstructions, projectProfile) {
  let prompt = `You are ${agentSpec.name}, an AI agent.\n\n`;
  prompt += `## Description\n${agentSpec.description}\n\n`;
  prompt += `## Instructions\n${agentSpec.instructions}\n\n`;
  prompt += `## Available Tools\n${agentSpec.tools.map(t => `- ${toolRegistry.resolveToolName(t)}`).join("\n")}\n\n`;
  prompt += `## All Available Tools\n- fs.read — Read file contents\n- fs.write — Write file contents\n- fs.edit — Edit file (replace old_string with new_string)\n- fs.glob — Find files by pattern\n- search.grep — Search file contents\n- shell.exec — Execute shell command\n- fetch.url — Fetch HTTP(S) URL\n- agent.delegate — Delegate task to another agent (max depth 3)\n- memory.save — Save key-value to agent memory\n- memory.load — Load value from agent memory\n- web.search — Search the web (SearXNG/Serper/Tavily)\n- plan.create — Create structured task plan\n- plan.update — Update task status in plan\n- plan.list — List plans or get plan details\n\n`;

  // Inject auto-detected project context (like Claude Design's design system auto-apply)
  if (projectProfile) {
    prompt += agentSystem.buildProfilePrompt(projectProfile) + "\n\n";
  }

  if (Object.keys(skillInstructions).length > 0) {
    prompt += `## Skills\n`;
    for (const [name, content] of Object.entries(skillInstructions)) {
      prompt += `### ${name}\n${truncateSkillContent(content)}\n\n`;
    }
  }

  prompt += `## Response Format\n`;
  prompt += `When you need to use a tool, respond with:\n`;
  prompt += `TOOL_CALL: <namespace.tool>(<json_args>)\n`;
  prompt += `Example: TOOL_CALL: fs.read({"path": "/src/index.js"})\n`;
  prompt += `Example: TOOL_CALL: shell.exec({"command": "npm test"})\n\n`;
  prompt += `When you have the final answer, respond with just the answer (no TOOL_CALL prefix).\n`;

  if (agentSpec.guardrails) {
    prompt += `\n## Guardrails\n- Never access files outside the project directory\n- Use safe write for all file operations\n- Respect rate limits\n- Only use allowed commands\n`;
    prompt += `\n## Behavioral Rules (Karpathy Principles)\n1. THINK FIRST: State assumptions explicitly. If uncertain, ASK — don't guess silently.\n2. SIMPLICITY: Minimum code that solves the problem. No speculative features or abstractions for single-use code.\n3. SURGICAL: Touch only what you must. Every changed line must trace directly to the user's request.\n4. GOAL-DRIVEN: Define success criteria before implementing. Write tests first, then make them pass.\n`;
  }

  return prompt;
}

module.exports = {
  buildSystemPrompt,
  truncateSkillContent,
  MAX_SKILL_INSTRUCTION_CHARS,
};
