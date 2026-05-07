// Allowed backend paths — prevents catch-all proxy abuse
const ALLOWED_PATHS = new Set([
  "agents/list",
  "agents/statuses",
  "health",
  "metrics",
]);

// Blocked subpaths — sensitive endpoints that should not be proxied
const BLOCKED_SUBPATHS = new Set([
  "agents/intervene",
]);

const ALLOWED_PATH_PREFIXES = ["agents/", "jobs/"];

export function isPathAllowed(path: string): boolean {
  if (ALLOWED_PATHS.has(path)) return true;
  if (BLOCKED_SUBPATHS.has(path)) return false;
  return ALLOWED_PATH_PREFIXES.some((p) => path.startsWith(p));
}
