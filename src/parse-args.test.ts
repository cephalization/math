import { test, expect, describe } from "bun:test";

// Map short flags to their long equivalents
const SHORT_FLAGS: Record<string, string> = {
  m: "model",
};

function parseArgs(args: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        parsed[key] = next;
        i++;
      } else {
        parsed[key] = true;
      }
    } else if (arg.startsWith("-") && arg.length === 2) {
      // Short flag like -m
      const shortKey = arg.slice(1);
      const longKey = SHORT_FLAGS[shortKey] ?? shortKey;
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        parsed[longKey] = next;
        i++;
      } else {
        parsed[longKey] = true;
      }
    }
  }
  return parsed;
}

describe("parseArgs", () => {
  test("parses long flags with values", () => {
    const result = parseArgs(["--model", "claude-opus"]);
    expect(result).toEqual({ model: "claude-opus" });
  });

  test("parses long flags as booleans", () => {
    const result = parseArgs(["--ui", "--quick"]);
    expect(result).toEqual({ ui: true, quick: true });
  });

  test("parses short flag -m as alias for --model", () => {
    const result = parseArgs(["-m", "claude-opus"]);
    expect(result).toEqual({ model: "claude-opus" });
  });

  test("parses mixed short and long flags", () => {
    const result = parseArgs(["-m", "test-model", "--ui", "--max-iterations", "50"]);
    expect(result).toEqual({ model: "test-model", ui: true, "max-iterations": "50" });
  });

  test("short flag without value becomes boolean", () => {
    const result = parseArgs(["-m"]);
    expect(result).toEqual({ model: true });
  });

  test("short flag followed by another flag becomes boolean", () => {
    const result = parseArgs(["-m", "--ui"]);
    expect(result).toEqual({ model: true, ui: true });
  });

  test("unknown short flags pass through using the short key", () => {
    const result = parseArgs(["-x", "value"]);
    expect(result).toEqual({ x: "value" });
  });

  test("handles both -m and --model in same args (last wins)", () => {
    const result = parseArgs(["-m", "first", "--model", "second"]);
    expect(result).toEqual({ model: "second" });
  });
});
