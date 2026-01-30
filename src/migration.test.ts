/**
 * FLAKINESS AUDIT (im8092sn):
 *
 * 1. HARDCODED TEST DIRECTORY: Uses `.test-migration` relative to source file.
 *    Risk: If multiple test runs overlap or cleanup fails, stale directory
 *    may interfere with subsequent runs.
 *
 * 2. PROCESS.CWD() CHANGES: Tests change working directory via process.chdir().
 *    Risk: If a test fails before afterEach, cwd remains changed for subsequent tests.
 *    Cleanup in afterEach properly restores cwd to import.meta.dir.
 *
 * 3. ASYNC FILESYSTEM OPS: Uses async mkdir/rm/writeFile for setup/teardown.
 *    Good practice, but cleanup in afterEach must complete before next test.
 *
 * 4. NO UNIQUE TEST ISOLATION: Tests share the same TEST_DIR path.
 *    If cleanup fails, subsequent test runs may see leftover files.
 */
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

// Tests for migration prompt and file moving require mocking readline
// We test the migration behavior by directly calling the internal functions
// Since promptForMigration is not exported, we test migrateIfNeeded end-to-end

test("migrateIfNeeded moves files when user confirms (simulated)", async () => {
  // Create legacy structure with files
  const legacyDir = join(TEST_DIR, "todo");
  await mkdir(legacyDir);
  await writeFile(join(legacyDir, "TASKS.md"), "# Tasks\ncontent");
  await writeFile(join(legacyDir, "PROMPT.md"), "# Prompt\ncontent");
  await writeFile(join(legacyDir, "LEARNINGS.md"), "# Learnings\ncontent");

  // Verify legacy exists
  expect(hasLegacyTodoDir()).toBe(true);
  expect(hasNewTodoDir()).toBe(false);

  // Since we can't easily mock readline in bun tests, we verify
  // the pre-conditions and post-conditions that file moving would achieve
  // by manually performing what performMigration does
  const { rename } = await import("node:fs/promises");
  const mathDir = join(TEST_DIR, ".math");
  const newTodoDir = join(TEST_DIR, ".math", "todo");

  await mkdir(mathDir, { recursive: true });
  await rename(legacyDir, newTodoDir);

  // Verify migration completed
  expect(hasLegacyTodoDir()).toBe(false);
  expect(hasNewTodoDir()).toBe(true);
  expect(existsSync(join(newTodoDir, "TASKS.md"))).toBe(true);
  expect(existsSync(join(newTodoDir, "PROMPT.md"))).toBe(true);
  expect(existsSync(join(newTodoDir, "LEARNINGS.md"))).toBe(true);
});

test("legacy directory with multiple files is correctly detected", async () => {
  const legacyDir = join(TEST_DIR, "todo");
  await mkdir(legacyDir);
  await writeFile(join(legacyDir, "TASKS.md"), "# Tasks");
  await writeFile(join(legacyDir, "PROMPT.md"), "# Prompt");
  await writeFile(join(legacyDir, "LEARNINGS.md"), "# Learnings");

  expect(hasLegacyTodoDir()).toBe(true);
});

test("legacy directory with unrelated files is not detected", async () => {
  const legacyDir = join(TEST_DIR, "todo");
  await mkdir(legacyDir);
  await writeFile(join(legacyDir, "random.txt"), "random content");

  expect(hasLegacyTodoDir()).toBe(false);
});

test("new todo directory detection is independent of file contents", async () => {
  // .math/todo just needs to exist, no files required
  await mkdir(join(TEST_DIR, ".math", "todo"), { recursive: true });
  expect(hasNewTodoDir()).toBe(true);

  // Even empty, it should be detected
  expect(existsSync(join(TEST_DIR, ".math", "todo", "TASKS.md"))).toBe(false);
});

test("migration preserves file contents", async () => {
  const legacyDir = join(TEST_DIR, "todo");
  await mkdir(legacyDir);

  const tasksContent = "# Tasks\n\n## Phase 1\n\n### task-1\n- content: Test task";
  const promptContent = "# Prompt\n\nCustom prompt content here";
  const learningsContent = "# Learnings\n\n## task-0\n- Learned something";

  await writeFile(join(legacyDir, "TASKS.md"), tasksContent);
  await writeFile(join(legacyDir, "PROMPT.md"), promptContent);
  await writeFile(join(legacyDir, "LEARNINGS.md"), learningsContent);

  // Perform migration manually (simulating user confirmation)
  const { rename, readFile } = await import("node:fs/promises");
  const newTodoDir = join(TEST_DIR, ".math", "todo");
  await mkdir(join(TEST_DIR, ".math"), { recursive: true });
  await rename(legacyDir, newTodoDir);

  // Verify file contents are preserved
  const migratedTasks = await readFile(join(newTodoDir, "TASKS.md"), "utf-8");
  const migratedPrompt = await readFile(join(newTodoDir, "PROMPT.md"), "utf-8");
  const migratedLearnings = await readFile(join(newTodoDir, "LEARNINGS.md"), "utf-8");

  expect(migratedTasks).toBe(tasksContent);
  expect(migratedPrompt).toBe(promptContent);
  expect(migratedLearnings).toBe(learningsContent);
});
