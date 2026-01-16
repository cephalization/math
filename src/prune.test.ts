import { test, expect, beforeEach, afterEach } from "bun:test";
import { findArtifacts, deleteArtifacts, confirmPrune } from "./prune";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const TEST_DIR = join(import.meta.dir, ".test-prune");
const BACKUPS_DIR = join(TEST_DIR, ".math", "backups");

// Store original cwd to restore after tests
let originalCwd: string;

beforeEach(() => {
  originalCwd = process.cwd();
  mkdirSync(BACKUPS_DIR, { recursive: true });
  process.chdir(TEST_DIR);
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(TEST_DIR, { recursive: true, force: true });
});

test("findArtifacts returns empty array for empty .math/backups directory", () => {
  const result = findArtifacts();
  expect(result).toEqual([]);
});

test("findArtifacts finds all backup directories in .math/backups", () => {
  mkdirSync(join(BACKUPS_DIR, "core-infrastructure"));
  mkdirSync(join(BACKUPS_DIR, "auth-setup"));

  const result = findArtifacts();

  expect(result).toHaveLength(2);
  expect(result).toContain(join(BACKUPS_DIR, "core-infrastructure"));
  expect(result).toContain(join(BACKUPS_DIR, "auth-setup"));
});

test("findArtifacts finds backup directories with numeric suffixes", () => {
  mkdirSync(join(BACKUPS_DIR, "core-infrastructure"));
  mkdirSync(join(BACKUPS_DIR, "core-infrastructure-1"));
  mkdirSync(join(BACKUPS_DIR, "core-infrastructure-42"));

  const result = findArtifacts();

  expect(result).toHaveLength(3);
  expect(result).toContain(join(BACKUPS_DIR, "core-infrastructure"));
  expect(result).toContain(join(BACKUPS_DIR, "core-infrastructure-1"));
  expect(result).toContain(join(BACKUPS_DIR, "core-infrastructure-42"));
});

test("findArtifacts only returns directories", () => {
  mkdirSync(join(BACKUPS_DIR, "core-infrastructure"));
  mkdirSync(join(BACKUPS_DIR, "auth-setup"));
  // Create a file that should be ignored
  Bun.write(join(BACKUPS_DIR, "some-file.txt"), "not a directory");

  const result = findArtifacts();

  expect(result).toHaveLength(2);
  expect(result).toContain(join(BACKUPS_DIR, "core-infrastructure"));
  expect(result).toContain(join(BACKUPS_DIR, "auth-setup"));
});

test("findArtifacts ignores files in .math/backups", () => {
  mkdirSync(join(BACKUPS_DIR, "core-infrastructure"));
  // Create a file that should be ignored
  Bun.write(join(BACKUPS_DIR, "readme.md"), "not a directory");

  const result = findArtifacts();

  expect(result).toHaveLength(1);
  expect(result).toContain(join(BACKUPS_DIR, "core-infrastructure"));
});

test("findArtifacts returns empty array when .math/backups does not exist", () => {
  // Remove the backups directory
  rmSync(BACKUPS_DIR, { recursive: true, force: true });

  const result = findArtifacts();
  expect(result).toEqual([]);
});

test("findArtifacts returns absolute paths", () => {
  mkdirSync(join(BACKUPS_DIR, "core-infrastructure"));

  const result = findArtifacts();

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

// confirmPrune tests

test("confirmPrune returns confirmed: true with force flag", async () => {
  const paths = ["/some/path/todo-1-15-2025", "/some/path/todo-2-20-2025"];

  const result = await confirmPrune(paths, { force: true });

  expect(result.confirmed).toBe(true);
  expect(result.paths).toEqual(paths);
});

test("confirmPrune returns confirmed: true with empty paths", async () => {
  const result = await confirmPrune([]);

  expect(result.confirmed).toBe(true);
  expect(result.paths).toEqual([]);
});

test("confirmPrune returns paths even with force flag", async () => {
  const paths = ["/a/todo-1-1-2025", "/b/todo-2-2-2025"];

  const result = await confirmPrune(paths, { force: true });

  expect(result.paths).toHaveLength(2);
  expect(result.paths).toContain("/a/todo-1-1-2025");
  expect(result.paths).toContain("/b/todo-2-2-2025");
});
