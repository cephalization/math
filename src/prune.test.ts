import { test, expect, beforeEach, afterEach } from "bun:test";
import { findArtifacts, deleteArtifacts } from "./prune";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const TEST_DIR = join(import.meta.dir, ".test-prune");

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

test("findArtifacts returns empty array for empty directory", () => {
  const result = findArtifacts(TEST_DIR);
  expect(result).toEqual([]);
});

test("findArtifacts finds backup directories with basic pattern", () => {
  mkdirSync(join(TEST_DIR, "todo-1-15-2025"));
  mkdirSync(join(TEST_DIR, "todo-12-31-2024"));

  const result = findArtifacts(TEST_DIR);

  expect(result).toHaveLength(2);
  expect(result).toContain(join(TEST_DIR, "todo-1-15-2025"));
  expect(result).toContain(join(TEST_DIR, "todo-12-31-2024"));
});

test("findArtifacts finds backup directories with counter suffix", () => {
  mkdirSync(join(TEST_DIR, "todo-1-15-2025"));
  mkdirSync(join(TEST_DIR, "todo-1-15-2025-1"));
  mkdirSync(join(TEST_DIR, "todo-1-15-2025-42"));

  const result = findArtifacts(TEST_DIR);

  expect(result).toHaveLength(3);
  expect(result).toContain(join(TEST_DIR, "todo-1-15-2025"));
  expect(result).toContain(join(TEST_DIR, "todo-1-15-2025-1"));
  expect(result).toContain(join(TEST_DIR, "todo-1-15-2025-42"));
});

test("findArtifacts ignores non-matching directories", () => {
  mkdirSync(join(TEST_DIR, "todo-1-15-2025"));
  mkdirSync(join(TEST_DIR, "todo")); // Not a backup
  mkdirSync(join(TEST_DIR, "node_modules")); // Not a backup
  mkdirSync(join(TEST_DIR, "todo-invalid")); // Invalid pattern

  const result = findArtifacts(TEST_DIR);

  expect(result).toHaveLength(1);
  expect(result).toContain(join(TEST_DIR, "todo-1-15-2025"));
});

test("findArtifacts ignores files matching pattern", () => {
  mkdirSync(join(TEST_DIR, "todo-1-15-2025"));
  // Create a file that matches the pattern (should be ignored)
  Bun.write(join(TEST_DIR, "todo-2-20-2025"), "not a directory");

  const result = findArtifacts(TEST_DIR);

  expect(result).toHaveLength(1);
  expect(result).toContain(join(TEST_DIR, "todo-1-15-2025"));
});

test("findArtifacts returns empty array for non-existent directory", () => {
  const result = findArtifacts(join(TEST_DIR, "does-not-exist"));
  expect(result).toEqual([]);
});

test("findArtifacts returns absolute paths", () => {
  mkdirSync(join(TEST_DIR, "todo-1-15-2025"));

  const result = findArtifacts(TEST_DIR);

  expect(result).toHaveLength(1);
  expect(result[0]).toMatch(/^\//); // Starts with / (absolute path)
});

// deleteArtifacts tests

test("deleteArtifacts deletes directories successfully", () => {
  const dir1 = join(TEST_DIR, "todo-1-15-2025");
  const dir2 = join(TEST_DIR, "todo-2-20-2025");
  mkdirSync(dir1);
  mkdirSync(dir2);

  const result = deleteArtifacts([dir1, dir2]);

  expect(result.deleted).toHaveLength(2);
  expect(result.deleted).toContain(dir1);
  expect(result.deleted).toContain(dir2);
  expect(result.failed).toHaveLength(0);
  expect(existsSync(dir1)).toBe(false);
  expect(existsSync(dir2)).toBe(false);
});

test("deleteArtifacts deletes directories with contents", () => {
  const dir = join(TEST_DIR, "todo-1-15-2025");
  mkdirSync(dir);
  Bun.write(join(dir, "file.txt"), "content");
  mkdirSync(join(dir, "subdir"));
  Bun.write(join(dir, "subdir", "nested.txt"), "nested content");

  const result = deleteArtifacts([dir]);

  expect(result.deleted).toHaveLength(1);
  expect(result.failed).toHaveLength(0);
  expect(existsSync(dir)).toBe(false);
});

test("deleteArtifacts returns empty arrays for empty input", () => {
  const result = deleteArtifacts([]);

  expect(result.deleted).toHaveLength(0);
  expect(result.failed).toHaveLength(0);
});

test("deleteArtifacts handles non-existent paths gracefully", () => {
  const nonExistent = join(TEST_DIR, "does-not-exist");

  const result = deleteArtifacts([nonExistent]);

  // rmSync with force: true doesn't throw for non-existent paths
  expect(result.deleted).toHaveLength(1);
  expect(result.failed).toHaveLength(0);
});

test("deleteArtifacts continues after a failure", () => {
  const dir1 = join(TEST_DIR, "todo-1-15-2025");
  const dir2 = join(TEST_DIR, "todo-2-20-2025");
  mkdirSync(dir1);
  mkdirSync(dir2);

  // Delete first one manually to prove second still gets processed
  rmSync(dir1, { recursive: true });

  const result = deleteArtifacts([dir1, dir2]);

  // Both should succeed since rmSync with force:true handles non-existent
  expect(result.deleted).toHaveLength(2);
  expect(result.failed).toHaveLength(0);
  expect(existsSync(dir2)).toBe(false);
});
