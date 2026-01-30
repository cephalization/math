import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMockAgent } from "./agent";
import { DexMock } from "./testing/dex-mock";
import type { DexTask } from "./dex";

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

describe("Integration: Happy path with full mock stack", () => {
  let testDir: string;
  let originalCwd: string;
  let dexMock: DexMock;

  beforeEach(async () => {
    dexMock = new DexMock();

    // Create temp directory for filesystem requirements
    testDir = await mkdtemp(join(tmpdir(), "math-integration-test-"));
    originalCwd = process.cwd();
    process.chdir(testDir);

    // Create required .math/todo directory with PROMPT.md
    const todoDir = join(testDir, ".math", "todo");
    await mkdir(todoDir, { recursive: true });
    await writeFile(join(todoDir, "PROMPT.md"), "# Test Prompt\n\nTest instructions.");

    // Create .dex directory (required by loop)
    await mkdir(join(testDir, ".dex"), { recursive: true });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(testDir, { recursive: true, force: true });
  });

  test("completes 3 dependent tasks in order using MockAgent and DexMock", async () => {
    const { runLoop } = await import("./loop");

    // Set up DexMock with 3 tasks: task-1 -> task-2 -> task-3 (dependency chain)
    dexMock.setTasks([
      createTask({ id: "task-1", name: "First task" }),
      createTask({ id: "task-2", name: "Second task", blockedBy: ["task-1"] }),
      createTask({ id: "task-3", name: "Third task", blockedBy: ["task-2"] }),
    ]);

    // Create MockAgent that completes tasks via DexMock
    const mockAgent = createMockAgent({
      dexMock,
      completeTask: true,
      exitCode: 0,
      logs: [
        { category: "info", message: "Agent processing task" },
        { category: "success", message: "Task completed" },
      ],
      output: ["Task completed successfully\n"],
    });

    // Suppress console output during test
    const originalLog = console.log;
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    console.log = () => {};
    process.stdout.write = () => true;

    try {
      // Run the loop with maxIterations: 5 (we need 3 iterations for 3 tasks)
      // Note: pauseSeconds must be non-zero to avoid falsy default (0 || 3 = 3)
      await runLoop({
        dexClient: dexMock,
        agent: mockAgent,
        maxIterations: 5,
        pauseSeconds: 0.001,
        ui: false,
      });

      // Assert: All 3 tasks completed
      const finalStatus = await dexMock.status();
      expect(finalStatus.stats.completed).toBe(3);
      expect(finalStatus.stats.pending).toBe(0);
      expect(finalStatus.stats.inProgress).toBe(0);

      // Assert: DexMock.getCalls() shows correct sequence
      const calls = dexMock.getCalls();
      const methodSequence = calls.map((c) => c.method);

      // Verify we have start/complete pairs for each task
      const startCalls = calls.filter((c) => c.method === "start");
      const completeCalls = calls.filter((c) => c.method === "complete");

      expect(startCalls.length).toBe(3);
      expect(completeCalls.length).toBe(3);

      // Verify tasks were completed in order: task-1, task-2, task-3
      expect(startCalls[0]?.args[0]).toBe("task-1");
      expect(startCalls[1]?.args[0]).toBe("task-2");
      expect(startCalls[2]?.args[0]).toBe("task-3");

      expect(completeCalls[0]?.args[0]).toBe("task-1");
      expect(completeCalls[1]?.args[0]).toBe("task-2");
      expect(completeCalls[2]?.args[0]).toBe("task-3");

      // Verify each start is followed by its corresponding complete
      for (let i = 0; i < 3; i++) {
        const taskId = `task-${i + 1}`;
        const startIdx = methodSequence.indexOf("start", calls.findIndex((c) => c.method === "start" && c.args[0] === taskId));
        const completeIdx = calls.findIndex((c) => c.method === "complete" && c.args[0] === taskId);
        expect(startIdx).toBeLessThan(completeIdx);
      }
    } finally {
      console.log = originalLog;
      process.stdout.write = originalStdoutWrite;
    }

    // Loop exited successfully (no max iterations exceeded error thrown)
  });
});
