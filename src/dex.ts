import { $ } from "bun";

/**
 * Dex task as returned by list/show commands
 */
export interface DexTask {
  id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  priority: number;
  completed: boolean;
  result: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  blockedBy: string[];
  blocks: string[];
  children: string[];
}

/**
 * Extended task details from dex show
 */
export interface DexTaskDetails extends DexTask {
  ancestors: string[];
  depth: number;
  subtasks: {
    pending: number;
    completed: number;
    children: string[];
  };
  grandchildren: string[] | null;
  isBlocked: boolean;
}

/**
 * Stats from dex status
 */
export interface DexStats {
  total: number;
  pending: number;
  completed: number;
  blocked: number;
  ready: number;
  inProgress: number;
}

/**
 * Full status response from dex status --json
 */
export interface DexStatus {
  stats: DexStats;
  inProgressTasks: DexTask[];
  readyTasks: DexTask[];
  blockedTasks: DexTask[];
  recentlyCompleted: DexTask[];
}

/**
 * Check if dex CLI is available in PATH
 */
export async function isDexAvailable(): Promise<boolean> {
  try {
    const result = await $`dex --version`.quiet();
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Get the dex directory path (.dex)
 * Returns the path where dex stores tasks (git root or pwd)
 */
export async function getDexDir(): Promise<string | null> {
  try {
    const result = await $`dex dir`.quiet();
    if (result.exitCode === 0) {
      return result.text().trim();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get task counts and status overview via dex status --json
 */
export async function dexStatus(): Promise<DexStatus> {
  const result = await $`dex status --json`.quiet();
  if (result.exitCode !== 0) {
    throw new Error(`dex status failed: ${result.stderr.toString()}`);
  }
  return JSON.parse(result.text()) as DexStatus;
}

/**
 * Get ready tasks (not blocked, not started) via dex list --ready --json
 */
export async function dexListReady(): Promise<DexTask[]> {
  const result = await $`dex list --ready --json`.quiet();
  if (result.exitCode !== 0) {
    throw new Error(`dex list --ready failed: ${result.stderr.toString()}`);
  }
  return JSON.parse(result.text()) as DexTask[];
}

/**
 * Get task details via dex show <id> --json
 */
export async function dexShow(id: string): Promise<DexTaskDetails> {
  const result = await $`dex show ${id} --json`.quiet();
  if (result.exitCode !== 0) {
    throw new Error(`dex show ${id} failed: ${result.stderr.toString()}`);
  }
  return JSON.parse(result.text()) as DexTaskDetails;
}

/**
 * Mark task as in-progress via dex start <id>
 */
export async function dexStart(id: string): Promise<void> {
  const result = await $`dex start ${id}`.quiet();
  if (result.exitCode !== 0) {
    throw new Error(`dex start ${id} failed: ${result.stderr.toString()}`);
  }
}

/**
 * Complete task with result via dex complete <id> --result "..."
 */
export async function dexComplete(id: string, result: string): Promise<void> {
  const cmdResult = await $`dex complete ${id} --result ${result}`.quiet();
  if (cmdResult.exitCode !== 0) {
    throw new Error(
      `dex complete ${id} failed: ${cmdResult.stderr.toString()}`
    );
  }
}

/**
 * Result from archiving tasks
 */
export interface DexArchiveResult {
  archivedCount: number;
  archivedIds: string[];
  errors: { id: string; error: string }[];
}

/**
 * Archive a single completed task via dex archive <id>
 * Note: Task and all descendants must be completed, task must not have incomplete ancestors
 */
export async function dexArchive(id: string): Promise<void> {
  const result = await $`dex archive ${id}`.quiet();
  if (result.exitCode !== 0) {
    throw new Error(`dex archive ${id} failed: ${result.stderr.toString()}`);
  }
}

/**
 * Archive all completed top-level tasks by archiving each individually.
 * Returns the number of tasks archived and any errors.
 */
export async function dexArchiveCompleted(): Promise<DexArchiveResult> {
  const status = await dexStatus();
  const completedTasks = status.recentlyCompleted;
  
  const result: DexArchiveResult = {
    archivedCount: 0,
    archivedIds: [],
    errors: [],
  };
  
  for (const task of completedTasks) {
    // Only archive top-level tasks (no parent)
    if (task.parent_id !== null) {
      continue;
    }
    
    try {
      await dexArchive(task.id);
      result.archivedCount++;
      result.archivedIds.push(task.id);
    } catch (error) {
      result.errors.push({
        id: task.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  return result;
}
