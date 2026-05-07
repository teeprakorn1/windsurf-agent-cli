/**
 * Search Tools — search.grep + fs.glob implementations
 *
 * Separated from tool-registry.js for maintainability.
 * These are the most complex tools with recursive file walking.
 */

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const guardrails = require("./guardrails");
const { _safeRegex } = require("./command-parser");

const DEFAULT_TOOL_TIMEOUT_MS = 30000;

const searchGrep = async (args) => {
  const { pattern, path: searchPath = "." } = args;
  const projectRoot = args.projectRoot || args.cwd || process.cwd();
  const safePath = guardrails.pathTraversal(searchPath, projectRoot);
  try {
    const regex = _safeRegex(pattern);
    const matches = [];
    const maxDepth = args.maxDepth || 10;
    const maxFileSize = args.maxFileSize || 1024 * 1024; // 1MB
    const maxFiles = args.maxFiles || 1000;
    let filesRead = 0;
    async function walk(dir, depth) {
      if (depth > maxDepth) return;
      if (filesRead >= maxFiles) return;
      let entries;
      try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        if (filesRead >= maxFiles) return;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", ".cache", "coverage", ".turbo", ".vercel"]);
          if (!SKIP_DIRS.has(entry.name)) await walk(full, depth + 1);
        } else {
          try {
            const stat = await fsp.stat(full);
            if (stat.size > maxFileSize) continue;
            filesRead++;
            const content = await fsp.readFile(full, "utf-8");
            const lines = content.split("\n");
            for (let i = 0; i < lines.length; i++) {
              regex.lastIndex = 0;
              try {
                if (regex.test(lines[i])) matches.push(`${full}:${i + 1}:${lines[i].trim()}`);
              } catch { /* skip regex errors on individual lines */ }
              if (matches.length >= 200) break;
            }
          } catch { /* skip unreadable files */ }
        }
        if (filesRead % 50 === 0) await new Promise(r => setImmediate(r));
      }
    }
    await walk(safePath, 0);
    return { matches: matches.slice(0, 200), filesRead, _truncated: filesRead >= maxFiles };
  } catch (e) {
    return { matches: [], error: e.message };
  }
};

const fsGlob = async (args) => {
  const { pattern, path: searchPath = "." } = args;
  const projectRoot = args.projectRoot || args.cwd || process.cwd();
  const safePath = guardrails.pathTraversal(searchPath, projectRoot);
  try {
    const glob = require("glob");
    let files;
    try {
      files = await glob(path.join(safePath, "**", pattern), { nodir: true, dot: false });
    } catch {
      files = await new Promise((resolve) => {
        glob(path.join(safePath, "**", pattern), { nodir: true, dot: false }, (err, m) => {
          resolve(err ? [] : (m || []));
        });
      });
    }
    return { files: (files || []).slice(0, 500) };
  } catch {
    // Fallback: simple recursive listing with glob pattern matching
    const p = require("path");
    const globToRegex = (globPattern) => {
      const braceGroups = [];
      let expanded = globPattern.replace(/\{([^}]+)\}/g, (_, inner) => {
        const alternatives = inner.split(",").map(part => part.trim());
        const placeholder = `<<<BRACE${braceGroups.length}>>>`;
        const escaped = alternatives.map(part =>
          part.replace(/[.+^${}()\[\]\\]/g, "\\$&")
            .replace(/\*\*/g, ".*")
            .replace(/\*/g, "[^/]*")
            .replace(/\?/g, "[^/]")
        ).join("|");
        braceGroups.push(`(${escaped})`);
        return placeholder;
      });
      // Escape literal brackets: [[] → literal [, []] → literal ]
      const literalBrackets = [];
      expanded = expanded.replace(/\[\[\]/g, () => {
        literalBrackets.push("\\[");
        return `<<<LBRACKET${literalBrackets.length - 1}>>>`;
      });
      expanded = expanded.replace(/\[\]\]/g, () => {
        literalBrackets.push("\\]");
        return `<<<RBRACKET${literalBrackets.length - 1}>>>`;
      });
      const charClasses = [];
      expanded = expanded.replace(/\[([^\]]*)\]/g, (match) => {
        charClasses.push(match);
        return `<<<CHARCLASS${charClasses.length - 1}>>>`;
      });
      let regex = expanded
        .replace(/\*\*/g, "<<<DOUBLESTAR>>>")
        .replace(/\*/g, "<<<STAR>>>")
        .replace(/\?/g, "<<<QUESTION>>>")
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/<<<DOUBLESTAR>>>/g, ".*")
        .replace(/<<<STAR>>>/g, "[^/]*")
        .replace(/<<<QUESTION>>>/g, "[^/]");
      charClasses.forEach((cc, i) => {
        regex = regex.replace(`<<<CHARCLASS${i}>>>`, cc);
      });
      braceGroups.forEach((group, i) => {
        regex = regex.replace(`<<<BRACE${i}>>>`, group);
      });
      literalBrackets.forEach((lb, i) => {
        regex = regex.replace(`<<<LBRACKET${i}>>>`, lb);
        regex = regex.replace(`<<<RBRACKET${i}>>>`, lb);
      });
      return new RegExp(`^${regex}$`);
    };
    const patternRegex = globToRegex(pattern);
    const files = [];
    const globMaxDepth = args.maxDepth || 20;
    async function walk(dir, depth) {
      if (depth > globMaxDepth) return;
      let entries;
      try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        const full = p.join(dir, entry.name);
        if (entry.isDirectory()) {
          const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", ".cache", "coverage", ".turbo", ".vercel"]);
          if (!SKIP_DIRS.has(entry.name)) await walk(full, depth + 1);
        } else {
          const relPath = p.relative(safePath, full);
          if (patternRegex.test(relPath) || patternRegex.test(entry.name)) {
            files.push(full);
          }
        }
      }
    }
    await walk(safePath, 0);
    return { files: files.slice(0, 500) };
  }
};

module.exports = {
  searchGrep,
  fsGlob,
  DEFAULT_TOOL_TIMEOUT_MS,
};
