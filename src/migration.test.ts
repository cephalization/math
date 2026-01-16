import { test, expect, beforeEach, afterEach, mock } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { hasLegacyTodoDir, hasNewTodoDir, migrateIfNeeded } from "./migration";

// Use a temp directory for testing
const TEST_DIR = join(import.meta.dir, ".test-migration");

beforeEach(async () => {
  // Clean up and create fresh test directory
  if (existsSync(TEST_DIR)) {
    await rm(TEST_DIR, { recursive: true });
  }
  await mkdir(TEST_DIR, { recursive: true });

  // Change to test directory
  process.chdir(TEST_DIR);
});

afterEach(async () => {
  // Go back to original directory and clean up
  process.chdir(import.meta.dir);
  if (existsSync(TEST_DIR)) {
    await rm(TEST_DIR, { recursive: true });
  }
});

test("hasLegacyTodoDir returns false when no todo/ exists", () => {
  expect(hasLegacyTodoDir()).toBe(false);
});

test("hasLegacyTodoDir returns false when todo/ exists but is empty", async () => {
  await mkdir(join(TEST_DIR, "todo"));
  expect(hasLegacyTodoDir()).toBe(false);
});

test("hasLegacyTodoDir returns true when todo/ has TASKS.md", async () => {
  await mkdir(join(TEST_DIR, "todo"));
  await writeFile(join(TEST_DIR, "todo", "TASKS.md"), "# Tasks");
  expect(hasLegacyTodoDir()).toBe(true);
});

test("hasLegacyTodoDir returns true when todo/ has PROMPT.md", async () => {
  await mkdir(join(TEST_DIR, "todo"));
  await writeFile(join(TEST_DIR, "todo", "PROMPT.md"), "# Prompt");
  expect(hasLegacyTodoDir()).toBe(true);
});

test("hasLegacyTodoDir returns true when todo/ has LEARNINGS.md", async () => {
  await mkdir(join(TEST_DIR, "todo"));
  await writeFile(join(TEST_DIR, "todo", "LEARNINGS.md"), "# Learnings");
  expect(hasLegacyTodoDir()).toBe(true);
});

test("hasNewTodoDir returns false when .math/todo/ does not exist", () => {
  expect(hasNewTodoDir()).toBe(false);
});

test("hasNewTodoDir returns true when .math/todo/ exists", async () => {
  await mkdir(join(TEST_DIR, ".math", "todo"), { recursive: true });
  expect(hasNewTodoDir()).toBe(true);
});

test("migrateIfNeeded returns true when already migrated", async () => {
  // Create new structure
  await mkdir(join(TEST_DIR, ".math", "todo"), { recursive: true });

  const result = await migrateIfNeeded();
  expect(result).toBe(true);
});

test("migrateIfNeeded returns true when no legacy directory exists", async () => {
  const result = await migrateIfNeeded();
  expect(result).toBe(true);
});
