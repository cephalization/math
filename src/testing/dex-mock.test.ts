import { test, expect, describe, beforeEach } from "bun:test";
import { DexMock } from "./dex-mock";
import type { DexTask, DexStatus } from "../dex";

/**
 * Helper to create a minimal DexTask for testing
 */
function createTask(overrides: Partial<DexTask> = {}): DexTask {
  return {
    id: "task-1",
    parent_id: null,
    name: "Test task",
    description: null,
    priority: 1,
    completed: false,
    result: null,
    metadata: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    started_at: null,
    completed_at: null,
    blockedBy: [],
    blocks: [],
    children: [],
    ...overrides,
  };
}

describe("DexMock", () => {
  let mock: DexMock;

  beforeEach(() => {
    mock = new DexMock();
  });

  describe("setTasks", () => {
    test("sets initial task state", async () => {
      const tasks = [
        createTask({ id: "task-1", name: "First" }),
        createTask({ id: "task-2", name: "Second" }),
      ];

      mock.setTasks(tasks);

      const ready = await mock.listReady();
      expect(ready).toHaveLength(2);
      expect(ready.map((t) => t.id)).toContain("task-1");
      expect(ready.map((t) => t.id)).toContain("task-2");
    });

    test("replaces existing tasks on subsequent calls", async () => {
      mock.setTasks([createTask({ id: "old-task" })]);
      mock.setTasks([createTask({ id: "new-task" })]);

      const ready = await mock.listReady();
      expect(ready).toHaveLength(1);
      expect(ready[0]?.id).toBe("new-task");
    });

    test("marks tasks with started_at as in-progress", async () => {
      mock.setTasks([
        createTask({ id: "task-1", started_at: "2024-01-02T00:00:00Z" }),
      ]);

      const ready = await mock.listReady();
      expect(ready).toHaveLength(0);

      const status = await mock.status();
      expect(status.stats.inProgress).toBe(1);
    });
  });

  describe("setStatus", () => {
    test("overrides computed status", async () => {
      const customStatus: DexStatus = {
        stats: {
          total: 100,
          pending: 50,
          completed: 30,
          blocked: 10,
          ready: 10,
          inProgress: 5,
        },
        inProgressTasks: [],
        readyTasks: [],
        blockedTasks: [],
        recentlyCompleted: [],
      };

      mock.setStatus(customStatus);
      const status = await mock.status();

      expect(status.stats.total).toBe(100);
      expect(status.stats.pending).toBe(50);
    });
  });

  describe("reset", () => {
    test("clears all state", async () => {
      mock.setTasks([createTask({ id: "task-1" })]);
      mock.setStatus({
        stats: { total: 1, pending: 1, completed: 0, blocked: 0, ready: 1, inProgress: 0 },
        inProgressTasks: [],
        readyTasks: [],
        blockedTasks: [],
        recentlyCompleted: [],
      });
      await mock.listReady(); // Generate some calls

      mock.reset();

      expect(await mock.listReady()).toHaveLength(0);
      expect(mock.getCalls()).toHaveLength(1); // Only the listReady after reset
      expect((await mock.status()).stats.total).toBe(0);
    });
  });

  describe("getCalls", () => {
    test("tracks method calls with arguments", async () => {
      mock.setTasks([createTask({ id: "task-1" })]);

      await mock.status();
      await mock.listReady();
      await mock.show("task-1");
      mock.start("task-1");
      mock.complete("task-1", "Done!");

      const calls = mock.getCalls();
      expect(calls).toHaveLength(5);
      expect(calls[0]?.method).toBe("status");
      expect(calls[0]?.args).toEqual([]);
      expect(calls[1]?.method).toBe("listReady");
      expect(calls[2]?.method).toBe("show");
      expect(calls[2]?.args).toEqual(["task-1"]);
      expect(calls[3]?.method).toBe("start");
      expect(calls[3]?.args).toEqual(["task-1"]);
      expect(calls[4]?.method).toBe("complete");
      expect(calls[4]?.args).toEqual(["task-1", "Done!"]);
    });

    test("includes timestamps", async () => {
      const before = Date.now();
      await mock.status();
      const after = Date.now();

      const calls = mock.getCalls();
      expect(calls[0]?.timestamp).toBeGreaterThanOrEqual(before);
      expect(calls[0]?.timestamp).toBeLessThanOrEqual(after);
    });

    test("returns a copy of calls array", async () => {
      await mock.status();
      const calls1 = mock.getCalls();
      const calls2 = mock.getCalls();

      expect(calls1).not.toBe(calls2);
      expect(calls1).toEqual(calls2);
    });
  });

  describe("status", () => {
    test("returns empty stats for no tasks", async () => {
      const status = await mock.status();

      expect(status.stats.total).toBe(0);
      expect(status.stats.pending).toBe(0);
      expect(status.stats.completed).toBe(0);
      expect(status.stats.blocked).toBe(0);
      expect(status.stats.ready).toBe(0);
      expect(status.stats.inProgress).toBe(0);
    });

    test("computes stats from tasks", async () => {
      mock.setTasks([
        createTask({ id: "ready-1" }),
        createTask({ id: "ready-2" }),
        createTask({ id: "blocked", blockedBy: ["ready-1"] }),
        createTask({ id: "in-progress", started_at: "2024-01-02T00:00:00Z" }),
        createTask({ id: "completed", completed: true, result: "Done" }),
      ]);

      const status = await mock.status();

      expect(status.stats.total).toBe(5);
      expect(status.stats.ready).toBe(2);
      expect(status.stats.blocked).toBe(1);
      expect(status.stats.inProgress).toBe(1);
      expect(status.stats.completed).toBe(1);
    });

    test("populates task lists", async () => {
      mock.setTasks([
        createTask({ id: "ready-1", name: "Ready task" }),
        createTask({ id: "blocked", blockedBy: ["ready-1"] }),
        createTask({ id: "in-progress", started_at: "2024-01-02T00:00:00Z" }),
        createTask({ id: "completed", completed: true }),
      ]);

      const status = await mock.status();

      expect(status.readyTasks.map((t) => t.id)).toContain("ready-1");
      expect(status.blockedTasks.map((t) => t.id)).toContain("blocked");
      expect(status.inProgressTasks.map((t) => t.id)).toContain("in-progress");
      expect(status.recentlyCompleted.map((t) => t.id)).toContain("completed");
    });
  });

  describe("listReady", () => {
    test("returns tasks that are not blocked, not started, not completed", async () => {
      mock.setTasks([
        createTask({ id: "ready-1" }),
        createTask({ id: "ready-2" }),
        createTask({ id: "blocked", blockedBy: ["ready-1"] }),
        createTask({ id: "in-progress", started_at: "2024-01-02T00:00:00Z" }),
        createTask({ id: "completed", completed: true }),
      ]);

      const ready = await mock.listReady();

      expect(ready).toHaveLength(2);
      expect(ready.map((t) => t.id)).toContain("ready-1");
      expect(ready.map((t) => t.id)).toContain("ready-2");
    });

    test("returns empty array when no tasks", async () => {
      const ready = await mock.listReady();
      expect(ready).toHaveLength(0);
    });
  });

  describe("show", () => {
    test("returns task details", async () => {
      mock.setTasks([
        createTask({
          id: "task-1",
          name: "Test task",
          description: "A description",
          children: ["child-1"],
        }),
      ]);

      const details = await mock.show("task-1");

      expect(details.id).toBe("task-1");
      expect(details.name).toBe("Test task");
      expect(details.description).toBe("A description");
      expect(details.ancestors).toEqual([]);
      expect(details.depth).toBe(0);
      expect(details.subtasks.children).toEqual(["child-1"]);
    });

    test("throws for non-existent task", async () => {
      await expect(mock.show("non-existent")).rejects.toThrow("Task not found: non-existent");
    });

    test("computes isBlocked from blocking tasks", async () => {
      mock.setTasks([
        createTask({ id: "blocker" }),
        createTask({ id: "blocked", blockedBy: ["blocker"] }),
      ]);

      const blockedDetails = await mock.show("blocked");
      expect(blockedDetails.isBlocked).toBe(true);

      // Complete the blocker
      mock.start("blocker");
      mock.complete("blocker", "Done");

      const unblockedDetails = await mock.show("blocked");
      expect(unblockedDetails.isBlocked).toBe(false);
    });
  });

  describe("start", () => {
    test("marks task as in-progress", async () => {
      mock.setTasks([createTask({ id: "task-1" })]);

      mock.start("task-1");

      const ready = await mock.listReady();
      expect(ready).toHaveLength(0);

      const status = await mock.status();
      expect(status.stats.inProgress).toBe(1);
    });

    test("sets started_at timestamp", async () => {
      mock.setTasks([createTask({ id: "task-1" })]);

      const before = new Date().toISOString();
      mock.start("task-1");
      const after = new Date().toISOString();

      const details = await mock.show("task-1");
      expect(details.started_at).toBeDefined();
      expect(details.started_at! >= before).toBe(true);
      expect(details.started_at! <= after).toBe(true);
    });

    test("throws for non-existent task", () => {
      expect(() => mock.start("non-existent")).toThrow("Task not found: non-existent");
    });

    test("throws for already completed task", () => {
      mock.setTasks([createTask({ id: "task-1", completed: true })]);

      expect(() => mock.start("task-1")).toThrow("Task already completed: task-1");
    });

    test("throws for already started task", () => {
      mock.setTasks([createTask({ id: "task-1" })]);
      mock.start("task-1");

      expect(() => mock.start("task-1")).toThrow("Task already started: task-1");
    });
  });

  describe("complete", () => {
    test("marks task as completed with result", async () => {
      mock.setTasks([createTask({ id: "task-1" })]);
      mock.start("task-1");

      mock.complete("task-1", "Task finished successfully");

      const details = await mock.show("task-1");
      expect(details.completed).toBe(true);
      expect(details.result).toBe("Task finished successfully");
    });

    test("sets completed_at timestamp", async () => {
      mock.setTasks([createTask({ id: "task-1" })]);
      mock.start("task-1");

      const before = new Date().toISOString();
      mock.complete("task-1", "Done");
      const after = new Date().toISOString();

      const details = await mock.show("task-1");
      expect(details.completed_at).toBeDefined();
      expect(details.completed_at! >= before).toBe(true);
      expect(details.completed_at! <= after).toBe(true);
    });

    test("removes task from in-progress", async () => {
      mock.setTasks([createTask({ id: "task-1" })]);
      mock.start("task-1");

      let status = await mock.status();
      expect(status.stats.inProgress).toBe(1);

      mock.complete("task-1", "Done");

      status = await mock.status();
      expect(status.stats.inProgress).toBe(0);
      expect(status.stats.completed).toBe(1);
    });

    test("throws for non-existent task", () => {
      expect(() => mock.complete("non-existent", "Done")).toThrow(
        "Task not found: non-existent"
      );
    });

    test("throws for already completed task", () => {
      mock.setTasks([createTask({ id: "task-1", completed: true })]);

      expect(() => mock.complete("task-1", "Done")).toThrow(
        "Task already completed: task-1"
      );
    });

    test("can complete task without starting first", async () => {
      mock.setTasks([createTask({ id: "task-1" })]);

      mock.complete("task-1", "Skipped start");

      const details = await mock.show("task-1");
      expect(details.completed).toBe(true);
    });
  });

  describe("integration", () => {
    test("typical workflow: list ready, start, show, complete", async () => {
      mock.setTasks([
        createTask({ id: "task-1", name: "First task" }),
        createTask({ id: "task-2", name: "Second task", blockedBy: ["task-1"] }),
      ]);

      // List ready tasks
      let ready = await mock.listReady();
      expect(ready).toHaveLength(1);
      expect(ready[0]?.id).toBe("task-1");

      // Start the task
      mock.start("task-1");

      // Check status
      let status = await mock.status();
      expect(status.stats.inProgress).toBe(1);

      // Show task details
      const details = await mock.show("task-1");
      expect(details.name).toBe("First task");

      // Complete the task
      mock.complete("task-1", "Implemented feature X");

      // Task-2 should now be ready (no longer blocked)
      ready = await mock.listReady();
      expect(ready).toHaveLength(1);
      expect(ready[0]?.id).toBe("task-2");

      // Verify call history
      const calls = mock.getCalls();
      expect(calls.map((c) => c.method)).toEqual([
        "listReady",
        "start",
        "status",
        "show",
        "complete",
        "listReady",
      ]);
    });
  });
});
