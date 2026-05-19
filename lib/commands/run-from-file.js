/**
 * aiyu-multi-agent run-from-file <path> — Run agent from markdown file with frontmatter
 *
 * Frontmatter spec:
 *   ---
 *   agent: backend-specialist     # required (or use --agent)
 *   provider: groq                # optional
 *   model: llama-3.3-70b-versatile # optional
 *   maxSteps: 10                  # optional
 *   outputFormat: json            # optional
 *   priority: high                # optional (reserved, ignored)
 *   ---
 *   <task body becomes agent input>
 */

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

const utils = require("../utils");
const guardrails = require("../core/guardrails");
const runCmd = require("./run");

const MAX_FILE_SIZE = 1024 * 1024; // 1MB

/**
 * Parse a markdown file with YAML frontmatter into { frontmatter, content }.
 * Body excludes the frontmatter block.
 */
function parseNoteFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
  // Match: "---\n<fm-body>\n---\n<content>" — capture (1)=fm-body (may be empty), (2)=rest.
  // Optional inner newline allows empty frontmatter "---\n---\n..." to be recognised.
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?\r?\n)?---\r?\n?([\s\S]*)$/);
  if (!fmMatch) {
    return { frontmatter: {}, content: raw.trim() };
  }
  const YAML = require("yaml");
  const fmText = (fmMatch[1] || "").replace(/\r?\n$/, "");
  const frontmatter = (fmText.trim() ? YAML.parse(fmText) : null) || {};
  const content = (fmMatch[2] || "").trim();
  return { frontmatter, content };
}

async function runFromFile(filePathArg, options = {}) {
  const projectDir = process.cwd();

  if (!filePathArg) {
    console.log(chalk.red("Usage: aiyu-multi-agent run-from-file <path-to-markdown>\n"));
    return;
  }

  // Resolve and validate the file path against projectDir to prevent traversal
  const resolved = path.isAbsolute(filePathArg)
    ? filePathArg
    : path.resolve(projectDir, filePathArg);

  try {
    guardrails.pathTraversal(resolved, projectDir);
  } catch (err) {
    console.log(chalk.red(`Refused to read file outside project: ${filePathArg}\n  ${err.message}\n`));
    return;
  }

  if (!fs.existsSync(resolved)) {
    console.log(chalk.red(`File not found: ${resolved}\n`));
    return;
  }

  const stat = fs.statSync(resolved);
  if (!stat.isFile()) {
    console.log(chalk.red(`Not a regular file: ${resolved}\n`));
    return;
  }
  if (stat.size > MAX_FILE_SIZE) {
    console.log(chalk.red(`File too large (>${MAX_FILE_SIZE} bytes): ${resolved}\n`));
    return;
  }

  let parsed;
  try {
    parsed = parseNoteFile(resolved);
  } catch (err) {
    console.log(chalk.red(`Failed to parse frontmatter: ${err.message}\n`));
    return;
  }

  const fm = parsed.frontmatter || {};
  const input = parsed.content;

  if (!input || input.length === 0) {
    console.log(chalk.red(`No task body found in file (after frontmatter): ${resolved}\n`));
    return;
  }

  // Resolve agent: CLI flag > frontmatter > default discovery
  const agentName = options.agent || fm.agent || undefined;
  if (agentName && !utils.isValidAgentName(agentName)) {
    console.log(chalk.red(`Invalid agent name from frontmatter or flag: "${agentName}"\n`));
    return;
  }

  // Validate maxSteps if provided
  let maxStepsValue = options.maxSteps;
  if (maxStepsValue === undefined && fm.maxSteps !== undefined) {
    const n = parseInt(fm.maxSteps, 10);
    if (!Number.isFinite(n) || n < 1 || n > 50) {
      console.log(chalk.red(`Invalid maxSteps in frontmatter: ${fm.maxSteps} (expected 1-50)\n`));
      return;
    }
    maxStepsValue = String(n);
  }

  // Check config exists before proceeding (fail early with clear message)
  const config = require("../core/config");
  if (!config.configExists(projectDir)) {
    console.log(chalk.red("No config directory found. Run `aiyu-multi-agent init` first.\n"));
    return;
  }

  const mergedOptions = {
    ...options,
    agent: agentName,
    provider: options.provider || fm.provider,
    model: options.model || fm.model,
    maxSteps: maxStepsValue,
    json: options.json || fm.outputFormat === "json",
    outputFormat: options.outputFormat || fm.outputFormat,
    noForm: options.noForm || fm.noForm,
    noQualityGate: options.noQualityGate || fm.noQualityGate,
    strictQualityGate: options.strictQualityGate || fm.strictQualityGate,
    writeArtifacts: options.writeArtifacts || fm.writeArtifacts,
  };

  if (!options.json && !mergedOptions.json) {
    console.log(chalk.cyan(`\n📄 Running from file: ${path.relative(projectDir, resolved) || resolved}`));
    if (fm.priority) console.log(chalk.gray(`   Priority: ${fm.priority}`));
  }

  return runCmd.run(input, mergedOptions);
}

module.exports = { runFromFile, parseNoteFile };
