/**
 * Agent System Auto-Apply — Project context detection and agent auto-configuration
 *
 * Inspired by Claude Design's "Design System auto-apply" where brand assets
 * are read during onboarding and applied to every project automatically.
 *
 * This module reads project context (package.json, tsconfig, .windsurf/rules)
 * and produces an agent profile that gets injected into the system prompt,
 * making agent output consistent with the project's conventions.
 *
 * Usage:
 *   const profile = agentSystem.detect(projectDir);
 *   // → { language, framework, testRunner, styleGuide, rules, ... }
 *
 *   const prompt = agentSystem.buildProfilePrompt(profile);
 *   // → Injected into system prompt automatically
 */

const fs = require("fs");
const path = require("path");
const config = require("./config");
const logger = require("./logger");

function detect(projectDir) {
  const profile = {
    language: null,
    framework: null,
    testRunner: null,
    packageManager: null,
    styleGuide: null,
    rules: [],
    conventions: [],
  };

  // ── Detect from package.json ──────────────────────────────────
  const pkgPath = path.join(projectDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Language
      if (deps.typescript || deps["@types/node"]) profile.language = "typescript";
      else if (fs.existsSync(path.join(projectDir, "tsconfig.json"))) profile.language = "typescript";
      else profile.language = "javascript";

      // Framework
      if (deps.next) profile.framework = "nextjs";
      else if (deps.nuxt) profile.framework = "nuxtjs";
      else if (deps.react) profile.framework = "react";
      else if (deps.vue) profile.framework = "vue";
      else if (deps.svelte) profile.framework = "svelte";
      else if (deps.express) profile.framework = "express";
      else if (deps.fastify) profile.framework = "fastify";
      else if (deps.nestjs || deps["@nestjs/core"]) profile.framework = "nestjs";
      else if (deps.hono) profile.framework = "hono";

      // Test runner
      if (deps.jest) profile.testRunner = "jest";
      else if (deps.vitest) profile.testRunner = "vitest";
      else if (deps.mocha) profile.testRunner = "mocha";
      else if (deps.pytest || fs.existsSync(path.join(projectDir, "pytest.ini"))) profile.testRunner = "pytest";

      // Package manager
      if (fs.existsSync(path.join(projectDir, "pnpm-lock.yaml"))) profile.packageManager = "pnpm";
      else if (fs.existsSync(path.join(projectDir, "yarn.lock"))) profile.packageManager = "yarn";
      else if (fs.existsSync(path.join(projectDir, "bun.lockb"))) profile.packageManager = "bun";
      else if (fs.existsSync(path.join(projectDir, "package-lock.json"))) profile.packageManager = "npm";

      // Style guide
      if (deps.eslint) profile.styleGuide = "eslint";
      if (deps.prettier) profile.conventions.push("prettier formatting");
      if (deps.husky) profile.conventions.push("pre-commit hooks");

    } catch { /* skip malformed package.json */ }
  }

  // ── Detect from Python projects ────────────────────────────────
  if (fs.existsSync(path.join(projectDir, "pyproject.toml")) || fs.existsSync(path.join(projectDir, "setup.py"))) {
    if (!profile.language) profile.language = "python";
    if (fs.existsSync(path.join(projectDir, "requirements.txt"))) profile.packageManager = "pip";
    if (fs.existsSync(path.join(projectDir, "Pipfile"))) profile.packageManager = "pipenv";
    if (fs.existsSync(path.join(projectDir, "poetry.lock"))) profile.packageManager = "poetry";
  }

  // ── Detect from .windsurf/rules/ ──────────────────────────────
  const cfgDir = config.getConfigDir(projectDir);
  if (cfgDir) {
    const rulesDir = path.join(cfgDir, "rules");
    if (fs.existsSync(rulesDir)) {
      try {
        const ruleFiles = fs.readdirSync(rulesDir).filter(f => f.endsWith(".md"));
        for (const rf of ruleFiles.slice(0, 10)) {
          const content = fs.readFileSync(path.join(rulesDir, rf), "utf-8");
          // Extract first line as rule name (after frontmatter)
          const afterFm = content.replace(/^---\r?\n[\s\S]*?\r?\n---/, "").trim();
          const headingMatch = afterFm.match(/^#+\s*(.+)/m);
          const ruleName = headingMatch ? headingMatch[1].trim() : afterFm.split("\n")[0]?.replace(/^#+\s*/, "").trim();
          if (ruleName) {
            profile.rules.push(ruleName);
          }
        }
      } catch { /* skip unreadable rules */ }
    }
  }

  // ── Detect from config.yaml ───────────────────────────────────
  if (cfgDir) {
    const configPath = path.join(cfgDir, "config.yaml");
    if (fs.existsSync(configPath)) {
      try {
        const YAML = require("yaml");
        const cfg = YAML.parse(fs.readFileSync(configPath, "utf-8"));
        if (cfg.workspace?.name) profile.projectName = cfg.workspace.name;
        if (cfg.workspace?.version) profile.specVersion = cfg.workspace.version;
      } catch { /* skip */ }
    }
  }

  logger.info(`Agent system detected: ${profile.language}/${profile.framework || "vanilla"} (${profile.packageManager || "unknown"})`);
  return profile;
}

function buildProfilePrompt(profile) {
  const parts = ["## Project Context (Auto-Detected)"];

  if (profile.language) parts.push(`- Language: ${profile.language}`);
  if (profile.framework) parts.push(`- Framework: ${profile.framework}`);
  if (profile.testRunner) parts.push(`- Test runner: ${profile.testRunner}`);
  if (profile.packageManager) parts.push(`- Package manager: ${profile.packageManager}`);
  if (profile.styleGuide) parts.push(`- Style guide: ${profile.styleGuide}`);
  if (profile.projectName) parts.push(`- Project: ${profile.projectName}`);

  if (profile.conventions.length > 0) {
    parts.push(`- Conventions: ${profile.conventions.join(", ")}`);
  }

  if (profile.rules.length > 0) {
    parts.push(`\n### Active Rules`);
    for (const rule of profile.rules) {
      parts.push(`- ${rule}`);
    }
  }

  parts.push(`\n### Behavioral Guidelines`);
  if (profile.language === "typescript") {
    parts.push("- Use TypeScript strict mode conventions");
    parts.push("- Prefer interfaces over type aliases for object shapes");
  }
  if (profile.framework === "nextjs") {
    parts.push("- Use App Router conventions (app/ directory)");
    parts.push("- Prefer Server Components by default");
  }
  if (profile.framework === "react") {
    parts.push("- Use functional components with hooks");
  }
  if (profile.testRunner) {
    parts.push(`- Write tests using ${profile.testRunner}`);
    parts.push("- Follow AAA pattern (Arrange-Act-Assert)");
  }

  return parts.join("\n");
}

module.exports = { detect, buildProfilePrompt };
