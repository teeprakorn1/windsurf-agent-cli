/**
 * Input Sanitizer — Input validation + prompt injection detection
 *
 * Separated from agent-runtime.js for maintainability.
 */

const logger = require("./logger");

const MAX_INPUT_LENGTH = 100000; // ~25k tokens — prevent oversized input

// Prompt injection indicators (heuristic, not foolproof)
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /disregard\s+(all\s+)?previous/i,
  /you\s+are\s+now\s+/i,
  /system\s*:\s*/i,
  /\<\/?system\>/i,
];

function sanitizeInput(input) {
  if (typeof input !== "string") throw new Error("Input must be a string");
  if (input.length > MAX_INPUT_LENGTH) {
    throw new Error(`Input too long (${input.length} chars, max ${MAX_INPUT_LENGTH}). Trim or split your request.`);
  }
  // Heuristic prompt injection warning (not a block — LLM should handle it, but log it)
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      logger.warn(`Possible prompt injection detected in input (pattern: ${pattern.source})`);
      break;
    }
  }
  return input;
}

function safeStringify(obj) {
  try { return JSON.stringify(obj, null, 2); }
  catch { return "[unserializable result]"; }
}

module.exports = {
  sanitizeInput,
  safeStringify,
  MAX_INPUT_LENGTH,
  PROMPT_INJECTION_PATTERNS,
};
