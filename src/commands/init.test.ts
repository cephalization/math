import { test, expect, describe } from "bun:test";
import { existsSync } from "node:fs";
import { rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { init } from "./init";
import { getTodoDir } from "../paths";

describe("init command", () => {
  const testDir = join(process.cwd(), ".math");

  // Clean up after each test
  async function cleanup() {
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true });
    }
  }

  test("creates .math/todo directory structure", async () => {
    await cleanup();

    // Run init with skipPlan to avoid interactive prompt
    await init({ skipPlan: true });

    const todoDir = getTodoDir();

    // Verify directory was created
    expect(existsSync(todoDir)).toBe(true);

    // Verify template files were created
    expect(existsSync(join(todoDir, "PROMPT.md"))).toBe(true);
    expect(existsSync(join(todoDir, "TASKS.md"))).toBe(true);
    expect(existsSync(join(todoDir, "LEARNINGS.md"))).toBe(true);

    await cleanup();
  });

  test("uses getTodoDir for path resolution", () => {
    // Verify getTodoDir returns the expected .math/todo path
    const todoDir = getTodoDir();
    expect(todoDir).toContain(".math");
    expect(todoDir).toContain("todo");
    expect(todoDir.endsWith(".math/todo")).toBe(true);
  });

  test("does not create if directory already exists", async () => {
    await cleanup();

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

    await cleanup();
  });
});
