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
 * Result of creating a task in dex, includes the generated ID
 */
export interface DexCreateResult {
  id: string;
  success: boolean;
  error?: string;
}

/**
 * Import a single task to dex.
 * - Creates the task with `dex create "<content>"`
 * - Sets up dependencies with `dex edit <id> --add-blocker <dep-id>`
 * - Updates status: complete -> `dex complete <id>`, in_progress -> `dex start <id>`
 * 
 * Note: dex generates its own IDs, so we track the mapping from old TASKS.md IDs
 * to new dex IDs via the idMap parameter.
 */
export async function importTaskToDex(
  task: Task,
  idMap: Map<string, string> = new Map()
): Promise<ImportResult> {
  const result: ImportResult = { id: task.id, success: true };

  try {
    // Step 1: Create the task (dex generates its own ID)
    // Use --description to include the original task ID for reference
    const description = `Migrated from TASKS.md (original ID: ${task.id})`;
    const createResult = await $`dex create ${task.content} --description ${description}`.quiet();
    if (createResult.exitCode !== 0) {
      result.success = false;
      result.error = `Failed to create task: ${createResult.stderr.toString()}`;
      return result;
    }

    // Parse the created task ID from the output
    // Expected format: "Created task <id>" or similar
    const output = createResult.text().trim();
    const idMatch = output.match(/(?:Created task|Created)\s+([a-z0-9]+)/i);
    if (!idMatch || !idMatch[1]) {
      result.success = false;
      result.error = `Failed to parse task ID from output: ${output}`;
      return result;
    }
    const newDexId = idMatch[1];
    
    // Store the mapping from old ID to new ID
    idMap.set(task.id, newDexId);

    // Step 2: Set up dependencies (block this task by its dependencies)
    for (const depId of task.dependencies) {
      // Look up the new dex ID for this dependency
      const depDexId = idMap.get(depId);
      if (!depDexId) {
        // Dependency task hasn't been migrated yet or doesn't exist
        // This can happen if dependencies are listed out of order
        result.success = false;
        result.error = `Dependency ${depId} not found - ensure tasks are imported in dependency order`;
        return result;
      }
      
      const editResult =
        await $`dex edit ${newDexId} --add-blocker ${depDexId}`.quiet();
      if (editResult.exitCode !== 0) {
        result.success = false;
        result.error = `Failed to set dependency ${depId}: ${editResult.stderr.toString()}`;
        return result;
      }
    }

    // Step 3: Update status based on task state
    if (task.status === "complete") {
      const completeResult =
        await $`dex complete ${newDexId} --result "Migrated from TASKS.md"`.quiet();
      if (completeResult.exitCode !== 0) {
        result.success = false;
        result.error = `Failed to mark complete: ${completeResult.stderr.toString()}`;
        return result;
      }
    } else if (task.status === "in_progress") {
      const startResult = await $`dex start ${newDexId}`.quiet();
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
 * Topologically sort tasks so dependencies come before dependents.
 * Tasks with no dependencies come first.
 */
function sortTasksByDependencies(tasks: Task[]): Task[] {
  const taskMap = new Map<string, Task>();
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }

  const sorted: Task[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(taskId: string): void {
    if (visited.has(taskId)) return;
    if (visiting.has(taskId)) {
      // Circular dependency - just add it and move on
      return;
    }

    const task = taskMap.get(taskId);
    if (!task) return;

    visiting.add(taskId);

    // Visit dependencies first
    for (const depId of task.dependencies) {
      visit(depId);
    }

    visiting.delete(taskId);
    visited.add(taskId);
    sorted.push(task);
  }

  for (const task of tasks) {
    visit(task.id);
  }

  return sorted;
}

/**
 * Import all tasks from TASKS.md content to dex.
 * Tasks are sorted so dependencies are imported before dependents.
 * Returns a report of imported tasks with any errors.
 */
export async function importAllTasksToDex(
  content: string
): Promise<MigrationReport> {
  const tasks = parseTasksForMigration(content);
  const sortedTasks = sortTasksByDependencies(tasks);
  const results: ImportResult[] = [];
  const idMap = new Map<string, string>();

  for (const task of sortedTasks) {
    const result = await importTaskToDex(task, idMap);
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
