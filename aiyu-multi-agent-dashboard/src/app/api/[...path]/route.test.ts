import { isPathAllowed } from "./utils";

describe("API proxy path whitelist", () => {
  it("allows explicitly whitelisted paths", () => {
    expect(isPathAllowed("agents/list")).toBe(true);
    expect(isPathAllowed("agents/statuses")).toBe(true);
    expect(isPathAllowed("health")).toBe(true);
    expect(isPathAllowed("metrics")).toBe(true);
  });

  it("allows prefixed paths (agents/*, jobs/*)", () => {
    expect(isPathAllowed("agents/123")).toBe(true);
    expect(isPathAllowed("agents/my-agent")).toBe(true);
    expect(isPathAllowed("jobs/abc")).toBe(true);
    expect(isPathAllowed("jobs/run-42/steps")).toBe(true);
  });

  it("blocks unknown paths", () => {
    expect(isPathAllowed("admin/config")).toBe(false);
    expect(isPathAllowed("secrets/env")).toBe(false);
    expect(isPathAllowed("internal/debug")).toBe(false);
    expect(isPathAllowed("")).toBe(false);
  });

  it("blocks sensitive subpaths", () => {
    expect(isPathAllowed("agents/intervene")).toBe(false);
  });

  it("blocks partial prefix matches", () => {
    expect(isPathAllowed("agents")).toBe(false);
    expect(isPathAllowed("jobs")).toBe(false);
    expect(isPathAllowed("agentsx/foo")).toBe(false);
  });
});
