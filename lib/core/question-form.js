const TRIGGER_RE = /\b(build|create|implement|design|dashboard|page|feature|refactor|fix|add|change)\b/i;
const BYPASS_RE = /^\s*(skip|default|proceed|continue)\s*$/i;

const FORM_INSTRUCTION = `Before implementing, ask these structured discovery questions and wait for the user's answers:
1. Purpose — What problem does this solve?
2. Users — Who will use this?
3. Scope — MVP or full feature?
4. Constraints — Tech stack, timeline, compatibility, or safety limits?
5. Success criteria — How do we know it works?`;

function shouldInjectQuestionForm(input, options = {}) {
  if (options.noForm || options.disableQuestionForm) return false;
  if (options.turn !== undefined && options.turn !== 1) return false;
  if (!input || BYPASS_RE.test(input)) return false;
  return TRIGGER_RE.test(input);
}

function buildQuestionFormMessage() {
  return `[Question-Form Guardrail]\n${FORM_INSTRUCTION}\n\nIf the user explicitly says skip/default/proceed, continue with safe defaults.`;
}

function maybeInjectQuestionForm(messages, input, options = {}) {
  if (!shouldInjectQuestionForm(input, options)) return false;
  messages.splice(1, 0, { role: "system", content: buildQuestionFormMessage() });
  return true;
}

module.exports = {
  FORM_INSTRUCTION,
  shouldInjectQuestionForm,
  buildQuestionFormMessage,
  maybeInjectQuestionForm,
};
