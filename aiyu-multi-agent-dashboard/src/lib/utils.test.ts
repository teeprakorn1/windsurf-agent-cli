import { formatUptime, cn } from "@/lib/utils";

describe("formatUptime", () => {
  it("formats minutes only", () => {
    expect(formatUptime(5 * 60 * 1000)).toBe("5m");
    expect(formatUptime(0)).toBe("0m");
  });

  it("formats hours and minutes", () => {
    expect(formatUptime(2 * 3600_000 + 30 * 60_000)).toBe("2h 30m");
  });

  it("formats days, hours, and minutes", () => {
    expect(formatUptime(3 * 86400_000 + 5 * 3600_000 + 15 * 60_000)).toBe("3d 5h 15m");
  });

  it("handles exactly 1 hour", () => {
    expect(formatUptime(3600_000)).toBe("1h 0m");
  });

  it("handles exactly 1 day", () => {
    expect(formatUptime(86400_000)).toBe("1d 0h 0m");
  });
});

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "extra")).toBe("base extra");
  });

  it("deduplicates tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
