import { $ } from "bun";
import { type Task, parseTasks } from "./tasks";

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
 * Parse TASKS.md content for migration purposes.
 * Reuses the existing parseTasks function from src/tasks.ts.
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
