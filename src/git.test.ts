import { test, expect } from "bun:test";
import { generateBranchName } from "./git";

test("generateBranchName produces math/ prefix", () => {
  const result = generateBranchName("my-task");
  expect(result.startsWith("math/")).toBe(true);
});

test("generateBranchName truncates long task IDs to ~20 chars", () => {
  const longTaskId = "this-is-a-very-long-task-id-that-should-be-truncated";
  const result = generateBranchName(longTaskId);

  // Extract the task ID portion (between "math/" and the timestamp)
  const withoutPrefix = result.slice(5); // Remove "math/"
  const taskIdPart = withoutPrefix.split("-").slice(0, -1).join("-"); // Remove timestamp

  // The truncated ID should be at most 20 chars
  expect(taskIdPart.length).toBeLessThanOrEqual(20);
});

test("generateBranchName includes timestamp suffix", () => {
  const result = generateBranchName("task");

  // Should have format: math/task-YYYYMMDDHHmmss
  const timestampPattern = /math\/task-\d{14}$/;
  expect(result).toMatch(timestampPattern);
});

test("generateBranchName handles short task IDs", () => {
  const result = generateBranchName("a");
  expect(result.startsWith("math/a-")).toBe(true);
});

test("generateBranchName handles empty string", () => {
  const result = generateBranchName("");
  // Should still produce valid branch name with just timestamp
  expect(result.startsWith("math/-")).toBe(true);
});

test("generateBranchName produces different names at different times", async () => {
  const result1 = generateBranchName("task");
  // Wait 1 second to ensure different timestamp
  await new Promise((resolve) => setTimeout(resolve, 1100));
  const result2 = generateBranchName("task");

  expect(result1).not.toEqual(result2);
});
