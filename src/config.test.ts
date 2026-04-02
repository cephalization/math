import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  IterationConfigSchema,
  loadIterationConfig,
  saveIterationConfig,
  type IterationConfig,
} from "./config";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "config-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// Schema validation tests
test("IterationConfigSchema validates valid config with model", () => {
  const config = {
    model: "anthropic/claude-sonnet-4-20250514",
    createdAt: "2026-04-02T15:00:00.000Z",
  };
  const result = IterationConfigSchema.safeParse(config);
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.model).toBe("anthropic/claude-sonnet-4-20250514");
    expect(result.data.createdAt).toBe("2026-04-02T15:00:00.000Z");
  }
});

test("IterationConfigSchema validates valid config without model", () => {
  const config = {
    createdAt: "2026-04-02T15:00:00.000Z",
  };
  const result = IterationConfigSchema.safeParse(config);
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.model).toBeUndefined();
    expect(result.data.createdAt).toBe("2026-04-02T15:00:00.000Z");
  }
});

test("IterationConfigSchema rejects invalid datetime", () => {
  const config = {
    createdAt: "not-a-datetime",
  };
  const result = IterationConfigSchema.safeParse(config);
  expect(result.success).toBe(false);
});

test("IterationConfigSchema rejects missing createdAt", () => {
  const config = {
    model: "anthropic/claude-sonnet-4-20250514",
  };
  const result = IterationConfigSchema.safeParse(config);
  expect(result.success).toBe(false);
});

// loadIterationConfig tests
test("loadIterationConfig returns null for missing file", () => {
  const result = loadIterationConfig(tempDir);
  expect(result).toBeNull();
});

test("loadIterationConfig returns null for invalid JSON", async () => {
  const configPath = join(tempDir, "config.json");
  await Bun.write(configPath, "not valid json");
  const result = loadIterationConfig(tempDir);
  expect(result).toBeNull();
});

test("loadIterationConfig returns null for invalid schema", async () => {
  const configPath = join(tempDir, "config.json");
  await Bun.write(configPath, JSON.stringify({ foo: "bar" }));
  const result = loadIterationConfig(tempDir);
  expect(result).toBeNull();
});

test("loadIterationConfig returns parsed config for valid file", async () => {
  const configPath = join(tempDir, "config.json");
  const config = {
    model: "openai/gpt-4",
    createdAt: "2026-04-02T15:00:00.000Z",
  };
  await Bun.write(configPath, JSON.stringify(config));
  const result = loadIterationConfig(tempDir);
  expect(result).not.toBeNull();
  expect(result?.model).toBe("openai/gpt-4");
  expect(result?.createdAt).toBe("2026-04-02T15:00:00.000Z");
});

test("loadIterationConfig handles config without model", async () => {
  const configPath = join(tempDir, "config.json");
  const config = {
    createdAt: "2026-04-02T15:00:00.000Z",
  };
  await Bun.write(configPath, JSON.stringify(config));
  const result = loadIterationConfig(tempDir);
  expect(result).not.toBeNull();
  expect(result?.model).toBeUndefined();
  expect(result?.createdAt).toBe("2026-04-02T15:00:00.000Z");
});

// saveIterationConfig tests
test("saveIterationConfig writes valid config", async () => {
  const config: IterationConfig = {
    model: "anthropic/claude-sonnet-4-20250514",
    createdAt: "2026-04-02T15:00:00.000Z",
  };
  saveIterationConfig(tempDir, config);

  const configPath = join(tempDir, "config.json");
  const content = JSON.parse(await Bun.file(configPath).text());
  expect(content.model).toBe("anthropic/claude-sonnet-4-20250514");
  expect(content.createdAt).toBe("2026-04-02T15:00:00.000Z");
});

test("saveIterationConfig writes config without model", async () => {
  const config: IterationConfig = {
    createdAt: "2026-04-02T15:00:00.000Z",
  };
  saveIterationConfig(tempDir, config);

  const configPath = join(tempDir, "config.json");
  const content = JSON.parse(await Bun.file(configPath).text());
  expect(content.model).toBeUndefined();
  expect(content.createdAt).toBe("2026-04-02T15:00:00.000Z");
});

test("saveIterationConfig throws for invalid config", () => {
  const invalidConfig = {
    createdAt: "not-a-datetime",
  } as IterationConfig;
  expect(() => saveIterationConfig(tempDir, invalidConfig)).toThrow();
});

// Round-trip test
test("saveIterationConfig and loadIterationConfig round-trip", () => {
  const config: IterationConfig = {
    model: "anthropic/claude-opus-4-20250514",
    createdAt: "2026-04-02T15:30:00.000Z",
  };
  saveIterationConfig(tempDir, config);
  const loaded = loadIterationConfig(tempDir);
  expect(loaded).toEqual(config);
});
