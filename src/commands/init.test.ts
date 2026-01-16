import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { existsSync } from "node:fs";
import { rm, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { init } from "./init";
import { getTodoDir } from "../paths";

const TEST_DIR = join(import.meta.dir, ".test-init");

// Store original cwd to restore after tests
let originalCwd: string;

beforeEach(async () => {
  originalCwd = process.cwd();

  // Clean up and create fresh test directory
  if (existsSync(TEST_DIR)) {
    await rm(TEST_DIR, { recursive: true });
  }
  await mkdir(TEST_DIR, { recursive: true });

  // Change to test directory so getTodoDir() resolves to test location
  process.chdir(TEST_DIR);
});

afterEach(async () => {
  // Restore original working directory
  process.chdir(originalCwd);

  // Clean up test directory
  if (existsSync(TEST_DIR)) {
    await rm(TEST_DIR, { recursive: true });
  }
});

describe("init command", () => {
  test("creates .math/todo directory structure", async () => {
    // Run init with skipPlan to avoid interactive prompt
    await init({ skipPlan: true });

    const todoDir = getTodoDir();

    // Verify directory was created
    expect(existsSync(todoDir)).toBe(true);

    // Verify template files were created
    expect(existsSync(join(todoDir, "PROMPT.md"))).toBe(true);
    expect(existsSync(join(todoDir, "TASKS.md"))).toBe(true);
    expect(existsSync(join(todoDir, "LEARNINGS.md"))).toBe(true);
  });

  test("uses getTodoDir for path resolution", () => {
    // Verify getTodoDir returns the expected .math/todo path relative to cwd
    const todoDir = getTodoDir();
    expect(todoDir).toContain(".math");
    expect(todoDir).toContain("todo");
    expect(todoDir.endsWith(".math/todo")).toBe(true);
    // Should resolve relative to our test directory
    expect(todoDir.startsWith(TEST_DIR)).toBe(true);
  });

  test("does not overwrite if directory already exists", async () => {
    // First init
    await init({ skipPlan: true });

    const todoDir = getTodoDir();
    const originalContent = await readFile(join(todoDir, "TASKS.md"), "utf-8");

    // Modify a file
    await Bun.write(join(todoDir, "TASKS.md"), "modified content");

    // Second init should not overwrite
    await init({ skipPlan: true });

    // Verify content was not overwritten
    const newContent = await readFile(join(todoDir, "TASKS.md"), "utf-8");
    expect(newContent).toBe("modified content");
  });
});
