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

  // Secret scanning — detect leaked API keys in agent markdown
  const SECRET_PATTERNS = [
    { pattern: /sk-[a-zA-Z0-9]{20,}/g, name: "OpenAI API key" },
    { pattern: /AKIA[A-Z0-9]{16}/g, name: "AWS access key" },
    { pattern: /ghp_[a-zA-Z0-9]{36}/g, name: "GitHub PAT" },
    { pattern: /npm_[a-zA-Z0-9]{36}/g, name: "npm access token" },
    { pattern: /xox[bpsa]-[a-zA-Z0-9-]{10,}/g, name: "Slack token" },
  ];

  const agentsDir2 = path.join(cfgDir, "agents");
  if (fs.existsSync(agentsDir2)) {
    for (const f of fs.readdirSync(agentsDir2).filter(f => f.endsWith(".md"))) {
      const content = fs.readFileSync(path.join(agentsDir2, f), "utf-8");
      for (const { pattern, name } of SECRET_PATTERNS) {
        const matches = content.match(pattern);
        if (matches) {
          const msg = `Possible ${name} found in ${f} (${matches.length} match${matches.length > 1 ? "es" : ""})`;
          if (options.strict) {
            errors.push(msg);
          } else {
            warnings.push(msg);
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

module.exports = { validate };
