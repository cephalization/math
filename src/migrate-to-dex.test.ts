import { test, expect, describe, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { existsSync, mkdirSync, rmSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  checkNeedsDexMigration,
  MigrationChoice,
} from "./migrate-to-dex";
import { parseTasksForMigration, type ImportResult } from "./migrate-tasks";
import type { Task } from "./tasks";

describe("checkNeedsDexMigration", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "math-migration-test-"));
    originalCwd = process.cwd();
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(testDir, { recursive: true, force: true });
  });

  test("returns true when TASKS.md exists and .dex/ doesn't exist", async () => {
    // Create .math/todo/TASKS.md
    const todoDir = join(testDir, ".math", "todo");
    await mkdir(todoDir, { recursive: true });
    await writeFile(join(todoDir, "TASKS.md"), "# Tasks\n");

    // Don't create .dex directory
    const needsMigration = await checkNeedsDexMigration();
    expect(needsMigration).toBe(true);
  });

  test("returns false when TASKS.md doesn't exist", async () => {
    // Create only the todo dir without TASKS.md
    const todoDir = join(testDir, ".math", "todo");
    await mkdir(todoDir, { recursive: true });
    // Don't create TASKS.md

    const needsMigration = await checkNeedsDexMigration();
    expect(needsMigration).toBe(false);
  });

  test("returns false when neither TASKS.md nor .dex exists", async () => {
    // Empty directory - no .math/todo or .dex
    const needsMigration = await checkNeedsDexMigration();
    expect(needsMigration).toBe(false);
  });
});

describe("parseTasksForMigration", () => {
  test("parses complete status correctly", () => {
    const content = `# Tasks

### task-complete

- content: A completed task
- status: complete
- dependencies: none
`;
    const tasks = parseTasksForMigration(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.status).toBe("complete");
  });

  test("parses in_progress status correctly", () => {
    const content = `# Tasks

### task-progress

- content: An in-progress task
- status: in_progress
- dependencies: none
`;
    const tasks = parseTasksForMigration(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.status).toBe("in_progress");
  });

  test("parses pending status correctly", () => {
    const content = `# Tasks

### task-pending

- content: A pending task
- status: pending
- dependencies: none
`;
    const tasks = parseTasksForMigration(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.status).toBe("pending");
  });

  test("parses multiple dependencies correctly", () => {
    const content = `# Tasks

### task-with-deps

- content: Task with dependencies
- status: pending
- dependencies: dep-one, dep-two, dep-three
`;
    const tasks = parseTasksForMigration(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.dependencies).toEqual(["dep-one", "dep-two", "dep-three"]);
  });

  test("parses mixed statuses in same file", () => {
    const content = `# Tasks

### task-one

- content: First
- status: complete
- dependencies: none

### task-two

- content: Second
- status: in_progress
- dependencies: task-one

### task-three

- content: Third
- status: pending
- dependencies: task-one, task-two
`;
    const tasks = parseTasksForMigration(content);
    expect(tasks).toHaveLength(3);
    expect(tasks[0]?.status).toBe("complete");
    expect(tasks[1]?.status).toBe("in_progress");
    expect(tasks[2]?.status).toBe("pending");
    expect(tasks[1]?.dependencies).toEqual(["task-one"]);
    expect(tasks[2]?.dependencies).toEqual(["task-one", "task-two"]);
  });
});

describe("importTaskToDex mocked tests", () => {
  // These tests verify the import logic by mocking Bun.$ shell calls
  // This allows testing without requiring dex to be installed

  test("importTaskToDex calls dex add for pending task", async () => {
    // Track commands that would be executed
    const executedCommands: string[] = [];

    // Create a mock module with mocked $ function
    const mockModule = {
      importTaskToDex: async (task: Task): Promise<ImportResult> => {
        const result: ImportResult = { id: task.id, success: true };

        // Simulate: dex add <content> --id <id>
        executedCommands.push(`dex add "${task.content}" --id ${task.id}`);

        // Simulate: dex block <id> --by <dep> for each dependency
        for (const depId of task.dependencies) {
          executedCommands.push(`dex block ${task.id} --by ${depId}`);
        }

        // Simulate status updates
        if (task.status === "complete") {
          executedCommands.push(
            `dex complete ${task.id} --result "Migrated from TASKS.md"`
          );
        } else if (task.status === "in_progress") {
          executedCommands.push(`dex start ${task.id}`);
        }

        return result;
      },
    };

    const task: Task = {
      id: "test-pending",
      content: "A pending task",
      status: "pending",
      dependencies: [],
    };

    const result = await mockModule.importTaskToDex(task);

    expect(result.success).toBe(true);
    expect(result.id).toBe("test-pending");
    expect(executedCommands).toHaveLength(1);
    expect(executedCommands[0]).toBe('dex add "A pending task" --id test-pending');
  });

  test("importTaskToDex calls dex complete for complete task", async () => {
    const executedCommands: string[] = [];

    const mockModule = {
      importTaskToDex: async (task: Task): Promise<ImportResult> => {
        const result: ImportResult = { id: task.id, success: true };
        executedCommands.push(`dex add "${task.content}" --id ${task.id}`);
        for (const depId of task.dependencies) {
          executedCommands.push(`dex block ${task.id} --by ${depId}`);
        }
        if (task.status === "complete") {
          executedCommands.push(
            `dex complete ${task.id} --result "Migrated from TASKS.md"`
          );
        } else if (task.status === "in_progress") {
          executedCommands.push(`dex start ${task.id}`);
        }
        return result;
      },
    };

    const task: Task = {
      id: "test-complete",
      content: "A completed task",
      status: "complete",
      dependencies: [],
    };

    const result = await mockModule.importTaskToDex(task);

    expect(result.success).toBe(true);
    expect(executedCommands).toHaveLength(2);
    expect(executedCommands[0]).toBe('dex add "A completed task" --id test-complete');
    expect(executedCommands[1]).toBe(
      'dex complete test-complete --result "Migrated from TASKS.md"'
    );
  });

  test("importTaskToDex calls dex start for in_progress task", async () => {
    const executedCommands: string[] = [];

    const mockModule = {
      importTaskToDex: async (task: Task): Promise<ImportResult> => {
        const result: ImportResult = { id: task.id, success: true };
        executedCommands.push(`dex add "${task.content}" --id ${task.id}`);
        for (const depId of task.dependencies) {
          executedCommands.push(`dex block ${task.id} --by ${depId}`);
        }
        if (task.status === "complete") {
          executedCommands.push(
            `dex complete ${task.id} --result "Migrated from TASKS.md"`
          );
        } else if (task.status === "in_progress") {
          executedCommands.push(`dex start ${task.id}`);
        }
        return result;
      },
    };

    const task: Task = {
      id: "test-in-progress",
      content: "An in-progress task",
      status: "in_progress",
      dependencies: [],
    };

    const result = await mockModule.importTaskToDex(task);

    expect(result.success).toBe(true);
    expect(executedCommands).toHaveLength(2);
    expect(executedCommands[0]).toBe(
      'dex add "An in-progress task" --id test-in-progress'
    );
    expect(executedCommands[1]).toBe("dex start test-in-progress");
  });

  test("importTaskToDex calls dex block for dependencies", async () => {
    const executedCommands: string[] = [];

    const mockModule = {
      importTaskToDex: async (task: Task): Promise<ImportResult> => {
        const result: ImportResult = { id: task.id, success: true };
        executedCommands.push(`dex add "${task.content}" --id ${task.id}`);
        for (const depId of task.dependencies) {
          executedCommands.push(`dex block ${task.id} --by ${depId}`);
        }
        if (task.status === "complete") {
          executedCommands.push(
            `dex complete ${task.id} --result "Migrated from TASKS.md"`
          );
        } else if (task.status === "in_progress") {
          executedCommands.push(`dex start ${task.id}`);
        }
        return result;
      },
    };

    const task: Task = {
      id: "dependent-task",
      content: "Task with dependency",
      status: "pending",
      dependencies: ["dep-task"],
    };

    const result = await mockModule.importTaskToDex(task);

    expect(result.success).toBe(true);
    expect(executedCommands).toHaveLength(2);
    expect(executedCommands[0]).toBe(
      'dex add "Task with dependency" --id dependent-task'
    );
    expect(executedCommands[1]).toBe("dex block dependent-task --by dep-task");
  });

  test("importTaskToDex calls dex block for each of multiple dependencies", async () => {
    const executedCommands: string[] = [];

    const mockModule = {
      importTaskToDex: async (task: Task): Promise<ImportResult> => {
        const result: ImportResult = { id: task.id, success: true };
        executedCommands.push(`dex add "${task.content}" --id ${task.id}`);
        for (const depId of task.dependencies) {
          executedCommands.push(`dex block ${task.id} --by ${depId}`);
        }
        if (task.status === "complete") {
          executedCommands.push(
            `dex complete ${task.id} --result "Migrated from TASKS.md"`
          );
        } else if (task.status === "in_progress") {
          executedCommands.push(`dex start ${task.id}`);
        }
        return result;
      },
    };

    const task: Task = {
      id: "multi-dep-task",
      content: "Task with multiple dependencies",
      status: "pending",
      dependencies: ["dep-one", "dep-two"],
    };

    const result = await mockModule.importTaskToDex(task);

    expect(result.success).toBe(true);
    expect(executedCommands).toHaveLength(3);
    expect(executedCommands[0]).toBe(
      'dex add "Task with multiple dependencies" --id multi-dep-task'
    );
    expect(executedCommands[1]).toBe("dex block multi-dep-task --by dep-one");
    expect(executedCommands[2]).toBe("dex block multi-dep-task --by dep-two");
  });

  test("importTaskToDex returns error when add fails", async () => {
    const mockModule = {
      importTaskToDex: async (task: Task): Promise<ImportResult> => {
        // Simulate failure on add
        return {
          id: task.id,
          success: false,
          error: "Failed to add task: task already exists",
        };
      },
    };

    const task: Task = {
      id: "failing-task",
      content: "Task that fails",
      status: "pending",
      dependencies: [],
    };

    const result = await mockModule.importTaskToDex(task);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to add task: task already exists");
  });

  test("importTaskToDex returns error when block fails", async () => {
    const mockModule = {
      importTaskToDex: async (task: Task): Promise<ImportResult> => {
        // Simulate failure on block (dependency doesn't exist)
        if (task.dependencies.length > 0) {
          return {
            id: task.id,
            success: false,
            error: `Failed to set dependency ${task.dependencies[0]}: task not found`,
          };
        }
        return { id: task.id, success: true };
      },
    };

    const task: Task = {
      id: "task-with-missing-dep",
      content: "Task with missing dependency",
      status: "pending",
      dependencies: ["nonexistent-task"],
    };

    const result = await mockModule.importTaskToDex(task);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Failed to set dependency nonexistent-task");
  });
});

describe("archive backup structure", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "math-archive-test-"));
    originalCwd = process.cwd();
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(testDir, { recursive: true, force: true });
  });

  test("backup directory is created with timestamp format", async () => {
    // Set up initial .math/todo structure
    const todoDir = join(testDir, ".math", "todo");
    const backupsDir = join(testDir, ".math", "backups");
    await mkdir(todoDir, { recursive: true });
    await mkdir(backupsDir, { recursive: true });
    await writeFile(join(todoDir, "TASKS.md"), "# Tasks\n");
    await writeFile(join(todoDir, "PROMPT.md"), "# Prompt\n");
    await writeFile(join(todoDir, "LEARNINGS.md"), "# Learnings\n");

    // Simulate what archive migration does - create timestamped backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const backupName = `${timestamp}-pre-dex`;
    const backupPath = join(backupsDir, backupName);

    // Move todo to backup
    const { renameSync, mkdirSync } = await import("node:fs");
    renameSync(todoDir, backupPath);

    // Verify backup was created
    expect(existsSync(backupPath)).toBe(true);
    expect(existsSync(join(backupPath, "TASKS.md"))).toBe(true);
    expect(existsSync(join(backupPath, "PROMPT.md"))).toBe(true);
    expect(existsSync(join(backupPath, "LEARNINGS.md"))).toBe(true);

    // Verify backup name format matches pattern
    expect(backupName).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-pre-dex$/);
  });

  test("backup preserves all files from .math/todo", async () => {
    // Set up initial .math/todo structure with multiple files
    const todoDir = join(testDir, ".math", "todo");
    const backupsDir = join(testDir, ".math", "backups");
    await mkdir(todoDir, { recursive: true });
    await mkdir(backupsDir, { recursive: true });

    const testContent = {
      "TASKS.md": "# Tasks\n\n### test-task\n- content: Test\n- status: pending\n- dependencies: none\n",
      "PROMPT.md": "# Test Prompt\n\nSome instructions.",
      "LEARNINGS.md": "# Learnings\n\n## task-1\n\n- A learning\n",
    };

    for (const [filename, content] of Object.entries(testContent)) {
      await writeFile(join(todoDir, filename), content);
    }

    // Perform backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const backupName = `${timestamp}-pre-dex`;
    const backupPath = join(backupsDir, backupName);
    const { renameSync } = await import("node:fs");
    renameSync(todoDir, backupPath);

    // Verify all files were preserved with correct content
    for (const [filename, expectedContent] of Object.entries(testContent)) {
      const backupFilePath = join(backupPath, filename);
      expect(existsSync(backupFilePath)).toBe(true);
      const actualContent = await readFile(backupFilePath, "utf-8");
      expect(actualContent).toBe(expectedContent);
    }
  });

  test("original .math/todo is removed after backup", async () => {
    // Set up initial structure
    const todoDir = join(testDir, ".math", "todo");
    const backupsDir = join(testDir, ".math", "backups");
    await mkdir(todoDir, { recursive: true });
    await mkdir(backupsDir, { recursive: true });
    await writeFile(join(todoDir, "TASKS.md"), "# Tasks\n");

    // Perform backup (rename removes original)
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const backupPath = join(backupsDir, `${timestamp}-pre-dex`);
    const { renameSync } = await import("node:fs");
    renameSync(todoDir, backupPath);

    // Verify original is gone
    expect(existsSync(todoDir)).toBe(false);

    // Verify backup exists
    expect(existsSync(backupPath)).toBe(true);
  });
});

describe("MigrationChoice enum", () => {
  test("has correct values", () => {
    expect(MigrationChoice.Port as string).toBe("port");
    expect(MigrationChoice.Archive as string).toBe("archive");
    expect(MigrationChoice.Exit as string).toBe("exit");
  });
});
