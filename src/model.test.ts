import { test, expect, describe } from "bun:test";
import {
  validateModel,
  parseModelProvider,
  SUPPORTED_PROVIDERS,
} from "./model";

describe("SUPPORTED_PROVIDERS", () => {
  test("includes openai and anthropic", () => {
    expect(SUPPORTED_PROVIDERS).toContain("openai");
    expect(SUPPORTED_PROVIDERS).toContain("anthropic");
  });
});

describe("validateModel", () => {
  test("returns valid for openai model", () => {
    const result = validateModel("openai/gpt-4");
    expect(result).toEqual({ valid: true, model: "openai/gpt-4" });
  });

  test("returns valid for anthropic model", () => {
    const result = validateModel("anthropic/claude-3-opus");
    expect(result).toEqual({ valid: true, model: "anthropic/claude-3-opus" });
  });

  test("returns valid for model with complex name", () => {
    const result = validateModel("openai/gpt-4-turbo-preview");
    expect(result).toEqual({ valid: true, model: "openai/gpt-4-turbo-preview" });
  });

  test("returns error for unsupported provider", () => {
    const result = validateModel("google/gemini-pro");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("Invalid model format");
      expect(result.error).toContain("google/gemini-pro");
    }
  });

  test("returns error for missing slash", () => {
    const result = validateModel("gpt-4");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("Invalid model format");
    }
  });

  test("returns error for empty string", () => {
    const result = validateModel("");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("non-empty string");
    }
  });

  test("returns error for provider with no model name", () => {
    const result = validateModel("openai/");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("Invalid model format");
    }
  });

  test("error message lists supported providers", () => {
    const result = validateModel("invalid");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("openai");
      expect(result.error).toContain("anthropic");
    }
  });
});

describe("parseModelProvider", () => {
  test("parses openai model", () => {
    const result = parseModelProvider("openai/gpt-4");
    expect(result).toEqual({ provider: "openai", modelName: "gpt-4" });
  });

  test("parses anthropic model", () => {
    const result = parseModelProvider("anthropic/claude-3-opus");
    expect(result).toEqual({ provider: "anthropic", modelName: "claude-3-opus" });
  });

  test("parses model with multiple slashes", () => {
    const result = parseModelProvider("openai/gpt-4/turbo");
    expect(result).toEqual({ provider: "openai", modelName: "gpt-4/turbo" });
  });

  test("returns null for unsupported provider", () => {
    const result = parseModelProvider("google/gemini-pro");
    expect(result).toBeNull();
  });

  test("returns null for missing slash", () => {
    const result = parseModelProvider("gpt-4");
    expect(result).toBeNull();
  });

  test("returns null for empty string", () => {
    const result = parseModelProvider("");
    expect(result).toBeNull();
  });

  test("returns null for provider with no model name", () => {
    const result = parseModelProvider("openai/");
    expect(result).toBeNull();
  });

  test("returns null for slash only", () => {
    const result = parseModelProvider("/");
    expect(result).toBeNull();
  });

  test("returns null for model starting with slash", () => {
    const result = parseModelProvider("/gpt-4");
    expect(result).toBeNull();
  });
});
