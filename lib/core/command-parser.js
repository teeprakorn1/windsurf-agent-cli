/**
 * Command Parser — Shell argument parsing + ReDoS-safe regex
 *
 * Separated from tool-registry.js for maintainability.
 */

function _safeRegex(pattern, flags = "gi") {
  // Reject patterns with excessive repetition (e.g., (a+)+, (a*){5,})
  const dangerous = /\([^)]*[+*][^)]*\)[+*{]|[*+]{2,}|\([^)]*\){3,}/;
  if (dangerous.test(pattern)) {
    throw new Error(`Regex pattern rejected — potential ReDoS: ${pattern.slice(0, 50)}`);
  }
  return new RegExp(pattern, flags);
}

function parseCommandArgs(argsStr) {
  if (!argsStr) return [];
  const args = [];
  let current = "";
  let inQuote = null;
  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];
    const next = argsStr[i + 1];
    // Handle escape sequences: \\ \" \'
    if (ch === "\\" && next && (next === '"' || next === "'" || next === "\\")) {
      current += next;
      i++; // skip escaped char
    } else if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === " " || ch === "\t") {
      if (current) {
        args.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current) args.push(current);
  return args;
}

module.exports = {
  _safeRegex,
  parseCommandArgs,
};
