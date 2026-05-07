/**
 * Pre-publish validator — check agent before publishing
 */

const fs = require("fs");
const path = require("path");

const config = require("../core/config");

function validate(projectDir, options = {}) {
  const errors = [];
  const warnings = [];

  const cfgDir = config.getConfigDir(projectDir);
  if (!cfgDir) {
    errors.push("No config directory found. Run `aiyu-multi-agent init` first.");
    return { valid: false, errors, warnings };
  }

  // Check config.yaml exists
  const configFile = path.join(cfgDir, "config.yaml");
  if (!fs.existsSync(configFile)) {
    errors.push("Missing config.yaml");
  } else {
    const YAML = require("yaml");
    const content = fs.readFileSync(configFile, "utf-8");
    const cfg = YAML.parse(content);

    if (!cfg.workspace?.name && !cfg.agent?.name) {
      errors.push("config.yaml missing workspace.name or agent.name");
    }
    if (!cfg.workspace?.version && !cfg.agent?.version) {
      warnings.push("No version specified — will default to 1.0.0");
    }
  }

  // Check agents directory
  const agentsDir = path.join(cfgDir, "agents");
  if (!fs.existsSync(agentsDir)) {
    errors.push("Missing agents/ directory");
  } else {
    const agentFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith(".md"));
    if (agentFiles.length === 0) {
      errors.push("No agent .md files found in agents/");
    } else {
      // Validate each agent has frontmatter
      agentFiles.forEach(f => {
        const content = fs.readFileSync(path.join(agentsDir, f), "utf-8");
        if (!content.match(/^---\r?\n[\s\S]*?\r?\n---/)) {
          errors.push(`Agent ${f} missing frontmatter`);
        }
      });
    }
  }

  // Check tests
  const testsDir = path.join(cfgDir, "tests");
  if (fs.existsSync(testsDir)) {
    const testFiles = fs.readdirSync(testsDir).filter(f => f.endsWith(".test.md"));
    if (testFiles.length === 0) {
      warnings.push("No test files found — consider adding tests before publishing");
    }
  } else {
    warnings.push("No tests/ directory — consider adding tests");
  }

  // Secret scanning — detect leaked API keys in ALL config files (not just agents)
  const SECRET_PATTERNS = [
    { pattern: /sk-[a-zA-Z0-9]{20,}/, name: "OpenAI API key" },
    { pattern: /AKIA[A-Z0-9]{16}/, name: "AWS access key" },
    { pattern: /ghp_[a-zA-Z0-9]{36}/, name: "GitHub PAT" },
    { pattern: /npm_[a-zA-Z0-9]{36}/, name: "npm access token" },
    { pattern: /xox[bpsa]-[a-zA-Z0-9-]{10,}/, name: "Slack token" },
  ];

  // Scan all files under cfgDir recursively (agents, skills, workflows, config, etc.)
  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && entry.name !== ".git") scanDir(fullPath);
      } else if (entry.name.endsWith(".md") || entry.name.endsWith(".yaml") || entry.name.endsWith(".yml") || entry.name.endsWith(".json")) {
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          const relPath = path.relative(cfgDir, fullPath);
          for (const { pattern, name } of SECRET_PATTERNS) {
            const matches = content.match(pattern);
            if (matches) {
              const matchSuffix = matches.length > 1 ? "es" : "";
              const msg = `Possible ${name} found in ${relPath} (${matches.length} match${matchSuffix})`;
              if (options.strict) {
                errors.push(msg);
              } else {
                warnings.push(msg);
              }
            }
          }
        } catch { /* skip unreadable files */ }
      }
    }
  }
  scanDir(cfgDir);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

module.exports = { validate };
