const BLACKLIST = [
  { pattern: /I'd be happy to help/i, severity: "p1", message: "Avoid generic assistant filler." },
  { pattern: /Let me know if you need anything else/i, severity: "p2", message: "Avoid unnecessary closing filler." },
  { pattern: /console\.log\((['\"])?here\1?\)/i, severity: "p1", message: "Remove debug console.log statements." },
  { pattern: /\beval\s*\(/, severity: "p0", message: "Avoid eval()." },
  { pattern: /(api[_-]?key|secret|token)\s*[:=]\s*['\"][^'\"]{8,}['\"]/i, severity: "p0", message: "Do not hardcode secrets." },
];

const SEVERITY_WEIGHT = { p0: 40, p1: 20, p2: 10 };

function checkQuality(output, options = {}) {
  const text = String(output || "");
  const violations = [];

  for (const rule of BLACKLIST) {
    if (rule.pattern.test(text)) {
      violations.push({ severity: rule.severity, message: rule.message });
    }
  }

  if (text.length > (options.maxOutputChars || 200000)) {
    violations.push({ severity: "p1", message: "Output is unusually large." });
  }

  const penalty = violations.reduce((sum, violation) => sum + (SEVERITY_WEIGHT[violation.severity] || 10), 0);
  const score = Math.max(0, 100 - penalty);
  const threshold = options.threshold ?? 70;
  const hasP0 = violations.some(v => v.severity === "p0");

  return {
    pass: !hasP0 && score >= threshold,
    score,
    threshold,
    violations,
    mode: options.strict ? "strict" : "warn",
  };
}

function applyQualityGate(state, options = {}) {
  if (!state || state.output == null || options.noQualityGate) return state;
  const quality = checkQuality(state.output, options);
  state.quality = quality;
  if (options.strict && !quality.pass) {
    state.status = "error";
    state.error = `Quality gate failed: ${quality.violations.map(v => v.message).join("; ")}`;
  }
  return state;
}

module.exports = {
  BLACKLIST,
  checkQuality,
  applyQualityGate,
};
