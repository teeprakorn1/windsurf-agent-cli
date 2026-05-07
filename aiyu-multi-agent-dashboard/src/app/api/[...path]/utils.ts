// Allowed backend paths — prevents catch-all proxy abuse
const ALLOWED_PATHS = new Set([
  "agents/list",
  "agents/statuses",
  "health",
  "metrics",
]);

const ALLOWED_PATH_PREFIXES = ["agents/", "jobs/"];

export function isPathAllowed(path: string): boolean {
  if (ALLOWED_PATHS.has(path)) return true;
  return ALLOWED_PATH_PREFIXES.some((p) => path.startsWith(p));
}
