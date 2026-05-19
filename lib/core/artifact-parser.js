const path = require("path");

const SUPPORTED_TYPES = new Set(["html", "css", "js", "ts", "json", "yaml", "md", "python", "shell"]);
const ARTIFACT_RE = /<artifact\s+([^>]*)>([\s\S]*?)<\/artifact>/gi;
const ATTR_RE = /(\w+)=("[^"]*"|'[^']*')/g;

function parseAttributes(raw) {
  const attrs = {};
  let match;
  while ((match = ATTR_RE.exec(raw)) !== null) {
    attrs[match[1]] = match[2].slice(1, -1);
  }
  return attrs;
}

function sanitizeFilename(filename, fallback) {
  const raw = filename || fallback;
  const normalized = raw.replace(/\\/g, "/").split("/").filter(Boolean).join("/");
  const clean = path.posix.normalize(normalized).replace(/^\.\.\/+/g, "");
  if (!clean || clean.startsWith("..") || path.isAbsolute(clean)) return fallback;
  return clean;
}

function parseArtifacts(text) {
  const source = String(text || "");
  if (source.includes("<artifact") && !source.includes("</artifact>")) {
    return { artifacts: [], text: source };
  }

  const artifacts = [];
  let outputText = "";
  let lastIndex = 0;
  let match;

  while ((match = ARTIFACT_RE.exec(source)) !== null) {
    outputText += source.slice(lastIndex, match.index);
    lastIndex = match.index + match[0].length;

    const attrs = parseAttributes(match[1] || "");
    const type = String(attrs.type || "text").toLowerCase();
    if (!SUPPORTED_TYPES.has(type)) {
      outputText += match[0];
      continue;
    }

    artifacts.push({
      type,
      filename: sanitizeFilename(attrs.filename, `artifact-${artifacts.length + 1}.${type}`),
      content: match[2].replace(/^\r?\n/, "").replace(/\r?\n$/, ""),
    });
  }

  outputText += source.slice(lastIndex);
  return { artifacts, text: outputText.trim() };
}

module.exports = {
  SUPPORTED_TYPES,
  parseArtifacts,
  sanitizeFilename,
};
