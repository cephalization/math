import { $ } from "bun";

/**
 * Task interface for migration purposes.
 * Represents a task from TASKS.md format.
 */
export interface Task {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "complete";
  dependencies: string[];
}

/**
 * Result of importing a single task to dex
 */
export interface ImportResult {
  id: string;
  success: boolean;
  error?: string;
}

/**
 * Report of all imported tasks
 */
export interface MigrationReport {
  total: number;
  successful: number;
  failed: number;
  results: ImportResult[];
}

/**
 * Parse TASKS.md file and extract all tasks.
 * 
 * Expected format:
 * ### task-id
 * - content: Description of the task
 * - status: pending | in_progress | complete
 * - dependencies: task-1, task-2
 */
export function parseTasks(content: string): Task[] {
  const tasks: Task[] = [];
  const lines = content.split("\n");

  let currentTask: Partial<Task> | null = null;

  for (const line of lines) {
    // New task starts with ### task-id
    const taskMatch = line.match(/^###\s+(.+)$/);
    if (taskMatch && taskMatch[1]) {
      // Save previous task if exists
      if (currentTask?.id) {
        tasks.push({
          id: currentTask.id,
          content: currentTask.content || "",
          status: currentTask.status || "pending",
          dependencies: currentTask.dependencies || [],
        });
      }
      currentTask = { id: taskMatch[1].trim() };
      continue;
    }

    if (!currentTask) continue;

    // Parse content line
    const contentMatch = line.match(/^-\s+content:\s*(.+)$/);
    if (contentMatch && contentMatch[1]) {
      currentTask.content = contentMatch[1].trim();
      continue;
    }

    // Parse status line
    const statusMatch = line.match(
      /^-\s+status:\s*(pending|in_progress|complete)$/
    );
    if (statusMatch && statusMatch[1]) {
      currentTask.status = statusMatch[1] as Task["status"];
      continue;
    }

    // Parse dependencies line
    const depsMatch = line.match(/^-\s+dependencies:\s*(.*)$/);
    if (depsMatch && depsMatch[1]) {
      const deps = depsMatch[1].trim();
      if (deps && deps.toLowerCase() !== "none") {
        currentTask.dependencies = deps
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean);
      } else {
        currentTask.dependencies = [];
      }
      continue;
    }
  }

  // Don't forget the last task
  if (currentTask?.id) {
    tasks.push({
      id: currentTask.id,
      content: currentTask.content || "",
      status: currentTask.status || "pending",
      dependencies: currentTask.dependencies || [],
    });
  }

  return tasks;
}

/**
 * Parse TASKS.md content for migration purposes.
 * Alias for parseTasks for backwards compatibility.
 */
export function parseTasksForMigration(content: string): Task[] {
  return parseTasks(content);
}

/**
 * Import a single task to dex.
 * - Adds the task with `dex add "<content>" --id <id>`
 * - Sets up dependencies with `dex block <id> --by <dep-id>`
 * - Updates status: complete -> `dex complete <id>`, in_progress -> `dex start <id>`
 */
export async function importTaskToDex(task: Task): Promise<ImportResult> {
  const result: ImportResult = { id: task.id, success: true };

  try {
    // Step 1: Add the task
    const addResult = await $`dex add ${task.content} --id ${task.id}`.quiet();
    if (addResult.exitCode !== 0) {
      result.success = false;
      result.error = `Failed to add task: ${addResult.stderr.toString()}`;
      return result;
    }

    // Step 2: Set up dependencies (block this task by its dependencies)
    for (const depId of task.dependencies) {
      const blockResult =
        await $`dex block ${task.id} --by ${depId}`.quiet();
      if (blockResult.exitCode !== 0) {
        result.success = false;
        result.error = `Failed to set dependency ${depId}: ${blockResult.stderr.toString()}`;
        return result;
      }
    }

    // Step 3: Update status based on task state
    if (task.status === "complete") {
      const completeResult =
        await $`dex complete ${task.id} --result "Migrated from TASKS.md"`.quiet();
      if (completeResult.exitCode !== 0) {
        result.success = false;
        result.error = `Failed to mark complete: ${completeResult.stderr.toString()}`;
        return result;
      }
    } else if (task.status === "in_progress") {
      const startResult = await $`dex start ${task.id}`.quiet();
      if (startResult.exitCode !== 0) {
        result.success = false;
        result.error = `Failed to mark in_progress: ${startResult.stderr.toString()}`;
        return result;
      }
    }
    // pending tasks don't need status updates - that's the default

    return result;
  } catch (err) {
    result.success = false;
    result.error = err instanceof Error ? err.message : String(err);
    return result;
  }
}

/**
 * Import all tasks from TASKS.md content to dex.
 * Returns a report of imported tasks with any errors.
 */
export async function importAllTasksToDex(
  content: string
): Promise<MigrationReport> {
  const tasks = parseTasksForMigration(content);
  const results: ImportResult[] = [];

  for (const task of tasks) {
    const result = await importTaskToDex(task);
    results.push(result);
  }

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return {
    total: tasks.length,
    successful,
    failed,
    results,
  };
}
