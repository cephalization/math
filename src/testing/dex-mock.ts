import type { DexTask, DexTaskDetails, DexStatus, DexStats, DexClient } from "../dex";

/**
 * Call record for tracking method invocations
 */
export interface DexMockCall {
  method: string;
  args: unknown[];
  timestamp: number;
}

/**
 * Internal task state with mutable status tracking
 */
interface InternalTask extends DexTask {
  inProgress: boolean;
}

/**
 * DexMock - a minimal mock for dex commands
 *
 * Provides in-memory implementations of core dex operations
 * for testing agent and loop code without requiring the real dex CLI.
 * 
 * Implements the DexClient interface for dependency injection.
 */
export class DexMock implements DexClient {
  private tasks: Map<string, InternalTask> = new Map();
  private statusConfig: DexStatus | null = null;
  private calls: DexMockCall[] = [];

  /**
   * Set the initial task state
   */
  setTasks(tasks: DexTask[]): void {
    this.tasks.clear();
    for (const task of tasks) {
      this.tasks.set(task.id, { ...task, inProgress: task.started_at !== null && !task.completed });
    }
  }

  /**
   * Set the status response (overrides computed status from tasks)
   */
  setStatus(status: DexStatus): void {
    this.statusConfig = status;
  }

  /**
   * Clear all state
   */
  reset(): void {
    this.tasks.clear();
    this.statusConfig = null;
    this.calls = [];
  }

  /**
   * Get call history for assertions
   */
  getCalls(): DexMockCall[] {
    return [...this.calls];
  }

  private recordCall(method: string, args: unknown[]): void {
    this.calls.push({ method, args, timestamp: Date.now() });
  }

  /**
   * Check if a task is blocked (has incomplete blocking tasks)
   */
  private isTaskBlocked(task: InternalTask): boolean {
    return task.blockedBy.some((blockerId) => {
      const blocker = this.tasks.get(blockerId);
      return blocker && !blocker.completed;
    });
  }

  /**
   * Check if a task is ready (not completed, not in progress, not blocked)
   */
  private isTaskReady(task: InternalTask): boolean {
    return !task.completed && !task.inProgress && !this.isTaskBlocked(task);
  }

  /**
   * Check if dex is available (always true for mock)
   */
  async isAvailable(): Promise<boolean> {
    this.recordCall("isAvailable", []);
    return true;
  }

  /**
   * Get status - returns configured status or computes from tasks
   */
  async status(): Promise<DexStatus> {
    this.recordCall("status", []);

    if (this.statusConfig) {
      return this.statusConfig;
    }

    // Compute status from tasks
    const allTasks = Array.from(this.tasks.values());
    const stats: DexStats = {
      total: allTasks.length,
      pending: allTasks.filter((t) => !t.completed && !t.inProgress).length,
      completed: allTasks.filter((t) => t.completed).length,
      blocked: allTasks.filter((t) => !t.completed && this.isTaskBlocked(t)).length,
      ready: allTasks.filter((t) => this.isTaskReady(t)).length,
      inProgress: allTasks.filter((t) => t.inProgress && !t.completed).length,
    };

    return {
      stats,
      inProgressTasks: allTasks.filter((t) => t.inProgress && !t.completed),
      readyTasks: allTasks.filter((t) => this.isTaskReady(t)),
      blockedTasks: allTasks.filter((t) => !t.completed && this.isTaskBlocked(t)),
      recentlyCompleted: allTasks.filter((t) => t.completed),
    };
  }

  /**
   * List ready tasks (not blocked, not started, not completed)
   */
  async listReady(): Promise<DexTask[]> {
    this.recordCall("listReady", []);

    return Array.from(this.tasks.values()).filter((t) => this.isTaskReady(t));
  }

  /**
   * Show task details
   */
  async show(id: string): Promise<DexTaskDetails> {
    this.recordCall("show", [id]);

    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }

    const isBlocked = this.isTaskBlocked(task);

    return {
      ...task,
      ancestors: [],
      depth: 0,
      subtasks: {
        pending: 0,
        completed: 0,
        children: task.children,
      },
      grandchildren: null,
      isBlocked,
    };
  }

  /**
   * Start a task (marks as in_progress)
   */
  start(id: string): void {
    this.recordCall("start", [id]);

    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }

    if (task.completed) {
      throw new Error(`Task already completed: ${id}`);
    }

    if (task.inProgress) {
      throw new Error(`Task already started: ${id}`);
    }

    task.inProgress = true;
    task.started_at = new Date().toISOString();
    task.updated_at = new Date().toISOString();
  }

  /**
   * Complete a task with result
   */
  complete(id: string, result: string): void {
    this.recordCall("complete", [id, result]);

    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }

    if (task.completed) {
      throw new Error(`Task already completed: ${id}`);
    }

    task.completed = true;
    task.result = result;
    task.completed_at = new Date().toISOString();
    task.updated_at = new Date().toISOString();
    task.inProgress = false;
  }
}
