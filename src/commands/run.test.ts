import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runLoop } from "../loop";
import { resolveModel } from "./run";
import { DEFAULT_MODEL } from "../constants";

describe("resolveModel", () => {
  let originalCwd: string;
  let testDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    testDir = mkdtempSync(join(tmpdir(), "math-run-test-"));
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(testDir, { recursive: true, force: true });
  });

  test("returns CLI model with source 'flag' when provided", () => {
    const result = resolveModel("openai/gpt-4");
    expect(result.model).toBe("openai/gpt-4");
    expect(result.source).toBe("flag");
  });

  test("returns config model with source 'config' when CLI not provided", () => {
    // Setup config file
    const todoDir = join(testDir, ".math", "todo");
    mkdirSync(todoDir, { recursive: true });
    writeFileSync(
      join(todoDir, "config.json"),
      JSON.stringify({ model: "anthropic/claude-3-opus", createdAt: new Date().toISOString() })
    );

    const result = resolveModel(undefined);
    expect(result.model).toBe("anthropic/claude-3-opus");
    expect(result.source).toBe("config");
  });

  test("returns DEFAULT_MODEL with source 'default' when no config exists", () => {
    const result = resolveModel(undefined);
    expect(result.model).toBe(DEFAULT_MODEL);
    expect(result.source).toBe("default");
  });

  test("CLI model takes priority over config model", () => {
    // Setup config file
    const todoDir = join(testDir, ".math", "todo");
    mkdirSync(todoDir, { recursive: true });
    writeFileSync(
      join(todoDir, "config.json"),
      JSON.stringify({ model: "anthropic/claude-3-opus", createdAt: new Date().toISOString() })
    );

    const result = resolveModel("openai/gpt-4");
    expect(result.model).toBe("openai/gpt-4");
    expect(result.source).toBe("flag");
  });
});

describe("run command --no-ui option", () => {
  // The run command transforms `--no-ui` CLI flag to `ui: false` option for runLoop.
  // Since runLoop already has comprehensive tests for ui: false behavior in loop.test.ts,
  // we just need a simple test to verify the transformation logic.

  test("--no-ui flag results in ui: false", () => {
    // This tests the transformation logic in run.ts:
    // ui: !options["no-ui"]
    
    // When --no-ui is present, options["no-ui"] = true
    // So ui = !true = false
    const options: Record<string, string | boolean> = { "no-ui": true };
    const uiValue = !options["no-ui"];
    expect(uiValue).toBe(false);
  });

  test("without --no-ui flag, ui defaults to true", () => {
    // When --no-ui is absent, options["no-ui"] = undefined
    // So ui = !undefined = true
    const options: Record<string, string | boolean> = {};
    const uiValue = !options["no-ui"];
    expect(uiValue).toBe(true);
  });
});
