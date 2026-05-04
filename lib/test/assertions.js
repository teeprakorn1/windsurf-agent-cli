/**
 * Test assertions — parse .test.md files and evaluate assertions
 */

function parseTestFile(content) {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const frontmatter = fmMatch ? fmMatch[1] : "";

  const name = frontmatter.match(/name:\s*(.+)/)?.[1]?.trim() || "unnamed";
  const description = frontmatter.match(/description:\s*(.+)/)?.[1]?.trim() || "";

  const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---/, "").trim();
  const tests = [];

  // Parse test sections: ## Test N: <name>
  const testRegex = /##\s+Test\s+\d+[:\s]+(.+?)(?=\n##\s+Test\s+\d+|$)/gs;
  let match;

  const sections = [];
  const sectionRegex = /##\s+Test\s+\d+[:\s]+(.+)/g;
  let sectionMatch;
  while ((sectionMatch = sectionRegex.exec(body)) !== null) {
    sections.push({
      name: sectionMatch[1].trim(),
      startIndex: sectionMatch.index + sectionMatch[0].length,
    });
  }

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const nextIndex = i + 1 < sections.length ? sections[i + 1].startIndex : body.length;
    const sectionBody = body.slice(section.startIndex, nextIndex).trim();

    const test = {
      name: section.name,
      assertions: [],
      skip: false,
      skipReason: "",
    };

    // Parse assertions: - assert: <type> [value]  or  - skip: <reason>
    const lines = sectionBody.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();

      const assertMatch = trimmed.match(/^- assert:\s*(.+)/);
      if (assertMatch) {
        const raw = assertMatch[1].trim();
        test.assertions.push(parseAssertion(raw));
        continue;
      }

      const skipMatch = trimmed.match(/^- skip:\s*(.+)/);
      if (skipMatch) {
        test.skip = true;
        test.skipReason = skipMatch[1].trim();
      }
    }

    tests.push(test);
  }

  return { name, description, tests };
}

function parseAssertion(raw) {
  // "agent name is X" → { type: "agent_name", value: "X" }
  // "config exists" → { type: "config_exists", value: true }
  // "provider is X" → { type: "provider", value: "X" }
  // "memory strategy is X" → { type: "memory", value: "X" }
  // "path traversal protection enabled" → { type: "path_traversal_protection" }
  // "safe write enabled" → { type: "safe_write_enabled" }
  // "rate limit enabled" → { type: "rate_limit_enabled" }
  // "guardrails active" or "path traversal protection enabled" → guardrails
  // "tool <name> available" → { type: "tool_available", value: name }
  // "skill <name> loaded" → { type: "skill_loaded", value: name }

  const lower = raw.toLowerCase();

  if (lower.includes("config exists")) return { type: "config_exists", value: true };
  if (lower.match(/agent name\s+(?:is\s+)?["']?(.+?)["']?$/)) return { type: "agent_name", value: lower.match(/agent name\s+(?:is\s+)?["']?(.+?)["']?$/)[1] };
  if (lower.match(/provider\s+(?:is\s+)?["']?(.+?)["']?$/)) return { type: "provider", value: lower.match(/provider\s+(?:is\s+)?["']?(.+?)["']?$/)[1] };
  if (lower.match(/memory\s+(?:strategy\s+)?(?:is\s+)?["']?(.+?)["']?$/)) return { type: "memory", value: lower.match(/memory\s+(?:strategy\s+)?(?:is\s+)?["']?(.+?)["']?$/)[1] };
  if (lower.includes("guardrails") && (lower.includes("enabled") || lower.includes("active"))) return { type: "guardrails_enabled" };
  if (lower.includes("path traversal") && lower.includes("enabled")) return { type: "path_traversal_protection" };
  if (lower.includes("safe write") && lower.includes("enabled")) return { type: "safe_write_enabled" };
  if (lower.includes("rate limit") && lower.includes("enabled")) return { type: "rate_limit_enabled" };
  if (lower.match(/tool\s+["']?(\S+?)["']?\s+available/)) return { type: "tool_available", value: lower.match(/tool\s+["']?(\S+?)["']?\s+available/)[1] };
  if (lower.match(/skill\s+["']?(\S+?)["']?\s+loaded/)) return { type: "skill_loaded", value: lower.match(/skill\s+["']?(\S+?)["']?\s+loaded/)[1] };

  // Fallback: treat the whole string as a generic assertion
  return { type: "custom", value: raw };
}

module.exports = { parseTestFile, parseAssertion };
