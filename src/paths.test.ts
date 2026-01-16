import { test, expect } from "bun:test";
import { getMathDir, getTodoDir, getBackupsDir } from "./paths";
import { join } from "node:path";

test("getMathDir returns .math in current directory", () => {
  const result = getMathDir();
  const expected = join(process.cwd(), ".math");
  expect(result).toBe(expected);
});

test("getTodoDir returns .math/todo in current directory", () => {
  const result = getTodoDir();
  const expected = join(process.cwd(), ".math", "todo");
  expect(result).toBe(expected);
});

test("getBackupsDir returns .math/backups in current directory", () => {
  const result = getBackupsDir();
  const expected = join(process.cwd(), ".math", "backups");
  expect(result).toBe(expected);
});

test("all paths are absolute", () => {
  expect(getMathDir()).toMatch(/^\//);
  expect(getTodoDir()).toMatch(/^\//);
  expect(getBackupsDir()).toMatch(/^\//);
});

test("paths have correct hierarchy", () => {
  const mathDir = getMathDir();
  const todoDir = getTodoDir();
  const backupsDir = getBackupsDir();

  expect(todoDir.startsWith(mathDir)).toBe(true);
  expect(backupsDir.startsWith(mathDir)).toBe(true);
});
