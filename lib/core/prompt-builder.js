/**
 * Prompt Builder — Build system prompts for agent execution
 *
 * Separated from agent-runtime.js for maintainability.
 */

const toolRegistry = require("./tool-registry");
const agentSystem = require("./agent-system");

const MAX_SKILL_INSTRUCTION_CHARS = 8000; // Per-skill instruction limit in system prompt

function truncateSkillContent(content, headingOffset = 0) {
  const budget = MAX_SKILL_INSTRUCTION_CHARS - headingOffset;
  if (budget <= 0) return content.slice(0, 200) + "\n...[truncated]";
  if (content.length <= budget) return content;

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
        if (totalLen + blockLen <= budget) {
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
      if (totalLen + line.length + 1 <= budget) {
        kept.push(line);
        totalLen += line.length + 1;
      }
      continue;
    }

    // Keep regular lines while space allows
    if (totalLen + line.length + 1 <= budget) {
      kept.push(line);
      totalLen += line.length + 1;
    } else {
      // Truncate this line to fit
      const remaining = budget - totalLen;
      if (remaining > 20) {
        kept.push(line.slice(0, remaining - 3) + "...");
      }
      break;
    }
  }

  return kept.join("\n");
}

function buildSystemPrompt(agentSpec, skillInstructions, projectProfile, outputFormat) {
  let prompt = `You are ${agentSpec.name}, an AI agent.\n\n`;
  prompt += `## Description\n${agentSpec.description}\n\n`;
  prompt += `## Instructions\n${agentSpec.instructions}\n\n`;
  prompt += `## Available Tools\n${agentSpec.tools.map(t => `- ${toolRegistry.resolveToolName(t)}`).join("\n")}\n\n`;

  // Dynamic tool list from registry — includes custom/plugin tools
  const allTools = toolRegistry.listTools();
  const toolSchemas = toolRegistry.TOOL_SCHEMAS || {};
  const toolDescriptions = allTools.map(t => {
    const schema = toolSchemas[t];
    const desc = schema?.description || "";
    return `- ${t}${desc ? " — " + desc : ""}`;
  });
  prompt += `## All Available Tools\n${toolDescriptions.join("\n")}\n\n`;

  // Inject auto-detected project context (like Claude Design's design system auto-apply)
  if (projectProfile) {
    prompt += agentSystem.buildProfilePrompt(projectProfile) + "\n\n";
  }

  if (Object.keys(skillInstructions).length > 0) {
    prompt += `## Skills\n`;
    for (const [name, content] of Object.entries(skillInstructions)) {
      const heading = `### ${name}\n`;
      const truncatedContent = truncateSkillContent(content, heading.length);
      prompt += `${heading}${truncatedContent}\n\n`;
    }
  }

  prompt += `## Response Format\n`;
  prompt += `When you need to use a tool, respond with:\n`;
  prompt += `TOOL_CALL: <namespace.tool>(<json_args>)\n`;
  prompt += `Example: TOOL_CALL: fs.read({"path": "/src/index.js"})\n`;
  prompt += `Example: TOOL_CALL: shell.exec({"command": "npm test"})\n\n`;
  prompt += `When you have the final answer, respond with just the answer (no TOOL_CALL prefix).\n`;

  if (outputFormat === "artifact") {
    prompt += `\n## Artifact Output Format\n`;
    prompt += `When returning code or files, wrap each artifact in an <artifact> tag with type and filename attributes.\n`;
    prompt += `Supported types: html, css, js, ts, json, yaml, md, python, shell.\n`;
    prompt += `Example: <artifact type="js" filename="example.js">\nconst x = 1;\n</artifact>\n`;
  }

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
