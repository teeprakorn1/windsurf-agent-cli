import { validateIdentifier, validateInput } from "@/lib/use-websocket";

describe("validateIdentifier", () => {
  it("returns null for undefined", () => {
    expect(validateIdentifier(undefined, "test")).toBeNull();
  });

  it("returns null for null", () => {
    expect(validateIdentifier(null, "test")).toBeNull();
  });

  it("returns the string for valid identifiers", () => {
    expect(validateIdentifier("my-agent", "Agent name")).toBe("my-agent");
  });

  it("throws for non-string types", () => {
    expect(() => validateIdentifier(123, "test")).toThrow("test must be a string");
    expect(() => validateIdentifier(true, "test")).toThrow("test must be a string");
  });

  it("throws for strings exceeding max length (256)", () => {
    const long = "a".repeat(257);
    expect(() => validateIdentifier(long, "ID")).toThrow("ID exceeds max length (256)");
  });

  it("accepts strings at max length", () => {
    const exact = "a".repeat(256);
    expect(validateIdentifier(exact, "ID")).toBe(exact);
  });
});

describe("validateInput", () => {
  it("accepts valid input", () => {
    expect(() => validateInput("hello", "Field", 100)).not.toThrow();
  });

  it("trims and rejects empty strings", () => {
    expect(() => validateInput("   ", "Field", 100)).toThrow("Field is required");
    expect(() => validateInput("", "Field", 100)).toThrow("Field is required");
  });

  it("rejects strings exceeding max length", () => {
    const long = "a".repeat(101);
    expect(() => validateInput(long, "Field", 100)).toThrow("Field exceeds max length (100)");
  });

  it("accepts strings at max length after trim", () => {
    const exact = "a".repeat(100);
    expect(() => validateInput(exact, "Field", 100)).not.toThrow();
  });

  it("trims before length check", () => {
    const padded = "  " + "a".repeat(101) + "  ";
    expect(() => validateInput(padded, "Field", 100)).toThrow("Field exceeds max length (100)");
  });
});
