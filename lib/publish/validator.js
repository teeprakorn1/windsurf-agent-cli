/**
 * Pre-publish validator — check agent before publishing
 */

const fs = require("fs");
const path = require("path");

const config = require("../core/config");

function validate(projectDir) {
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

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

module.exports = { validate };
