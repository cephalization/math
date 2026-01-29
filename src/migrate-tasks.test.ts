import { test, expect, mock } from "bun:test";
import { parseTasksForMigration } from "./migrate-tasks";

const SAMPLE_TASKS_MD = `# Project Tasks

Task tracker for testing.

## How to Use

1. Find the first task with \`status: pending\`
2. Implement it
3. Done

---

## Phase 1: Test Tasks

### task-one

- content: First task description
- status: complete
- dependencies: none

### task-two

- content: Second task depends on first
- status: in_progress
- dependencies: task-one

### task-three

- content: Third task depends on first two
- status: pending
- dependencies: task-one, task-two

### task-four

- content: Fourth task no deps
- status: pending
- dependencies: none
`;

test("parseTasksForMigration parses all tasks", () => {
  const tasks = parseTasksForMigration(SAMPLE_TASKS_MD);
  expect(tasks).toHaveLength(4);
});

test("parseTasksForMigration extracts task ids correctly", () => {
  const tasks = parseTasksForMigration(SAMPLE_TASKS_MD);
  const ids = tasks.map((t) => t.id);
  expect(ids).toEqual(["task-one", "task-two", "task-three", "task-four"]);
});

test("parseTasksForMigration extracts task content correctly", () => {
  const tasks = parseTasksForMigration(SAMPLE_TASKS_MD);
  expect(tasks[0]?.content).toBe("First task description");
  expect(tasks[1]?.content).toBe("Second task depends on first");
  expect(tasks[2]?.content).toBe("Third task depends on first two");
  expect(tasks[3]?.content).toBe("Fourth task no deps");
});

test("parseTasksForMigration extracts status correctly", () => {
  const tasks = parseTasksForMigration(SAMPLE_TASKS_MD);
  expect(tasks[0]?.status).toBe("complete");
  expect(tasks[1]?.status).toBe("in_progress");
  expect(tasks[2]?.status).toBe("pending");
  expect(tasks[3]?.status).toBe("pending");
});

test("parseTasksForMigration extracts dependencies correctly", () => {
  const tasks = parseTasksForMigration(SAMPLE_TASKS_MD);
  expect(tasks[0]?.dependencies).toEqual([]);
  expect(tasks[1]?.dependencies).toEqual(["task-one"]);
  expect(tasks[2]?.dependencies).toEqual(["task-one", "task-two"]);
  expect(tasks[3]?.dependencies).toEqual([]);
});

test("parseTasksForMigration handles empty content", () => {
  const tasks = parseTasksForMigration("");
  expect(tasks).toHaveLength(0);
});

test("parseTasksForMigration handles content with no tasks", () => {
  const content = `# Project Tasks

Some header text without any tasks.
`;
  const tasks = parseTasksForMigration(content);
  expect(tasks).toHaveLength(0);
});
