import { join } from "node:path";
import { existsSync } from "node:fs";
import { getTodoDir } from "./paths";

export interface Task {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "complete";
  dependencies: string[];
}

export interface TaskCounts {
  pending: number;
  in_progress: number;
  complete: number;
  total: number;
}

/**
 * Parse TASKS.md file and extract all tasks
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
 * Count tasks by status
 */
export function countTasks(tasks: Task[]): TaskCounts {
  const counts: TaskCounts = {
    pending: 0,
    in_progress: 0,
    complete: 0,
    total: tasks.length,
  };

  for (const task of tasks) {
    counts[task.status]++;
  }

  return counts;
}

/**
 * Find the next task to work on:
 * - Status must be "pending"
 * - All dependencies must be "complete"
 */
export function findNextTask(tasks: Task[]): Task | null {
  const completedIds = new Set(
    tasks.filter((t) => t.status === "complete").map((t) => t.id)
  );

  for (const task of tasks) {
    if (task.status !== "pending") continue;

    // Check if all dependencies are complete
    const depsComplete = task.dependencies.every((dep) =>
      completedIds.has(dep)
    );
    if (depsComplete) {
      return task;
    }
  }

  return null;
}

/**
 * Update a task's status in the TASKS.md content
 */
export function updateTaskStatus(
  content: string,
  taskId: string,
  newStatus: Task["status"]
): string {
  const lines = content.split("\n");
  const result: string[] = [];
  let inTargetTask = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";

    // Check if we're entering a task section
    const taskMatch = line.match(/^###\s+(.+)$/);
    if (taskMatch && taskMatch[1]) {
      inTargetTask = taskMatch[1].trim() === taskId;
    }

    // If we're in the target task and this is a status line, replace it
    if (
      inTargetTask &&
      line.match(/^-\s+status:\s*(pending|in_progress|complete)$/)
    ) {
      result.push(`- status: ${newStatus}`);
    } else {
      result.push(line);
    }
  }

  return result.join("\n");
}

/**
 * Read and parse tasks from the todo directory
 */
export async function readTasks(
  todoDir?: string
): Promise<{ tasks: Task[]; content: string }> {
  const dir = todoDir || getTodoDir();
  const tasksPath = join(dir, "TASKS.md");

  if (!existsSync(tasksPath)) {
    throw new Error(`TASKS.md not found at ${tasksPath}`);
  }

  const content = await Bun.file(tasksPath).text();
  const tasks = parseTasks(content);

  return { tasks, content };
}

/**
 * Write updated content to TASKS.md
 */
export async function writeTasks(
  content: string,
  todoDir?: string
): Promise<void> {
  const dir = todoDir || getTodoDir();
  const tasksPath = join(dir, "TASKS.md");
  await Bun.write(tasksPath, content);
}
