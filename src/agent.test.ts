import { test, expect, describe } from "bun:test";
import {
  MockAgent,
  createMockAgent,
  createLogEntry,
  createAgentOutput,
  type LogCategory,
  type AgentRunOptions,
} from "./agent";
import { DexMock } from "./testing/dex-mock";
import type { DexTask } from "./dex";

describe("MockAgent", () => {
  test("isAvailable returns true by default", async () => {
    const agent = createMockAgent();
    expect(await agent.isAvailable()).toBe(true);
  });

  test("isAvailable returns false when configured", async () => {
    const agent = createMockAgent({ available: false });
    expect(await agent.isAvailable()).toBe(false);
  });

  test("run returns default logs and output", async () => {
    const agent = createMockAgent();
    const options: AgentRunOptions = {
      model: "test-model",
      prompt: "test prompt",
      files: ["file1.md", "file2.md"],
    };

    const result = await agent.run(options);

    expect(result.exitCode).toBe(0);
    expect(result.logs).toHaveLength(2);
    expect(result.logs[0]!.category).toBe("info");
    expect(result.logs[0]!.message).toBe("Mock agent starting...");
    expect(result.logs[1]!.category).toBe("success");
    expect(result.logs[1]!.message).toBe("Mock agent completed");
    expect(result.output).toHaveLength(1);
    expect(result.output[0]!.text).toBe("Mock agent output\n");
  });

  test("run uses configured logs", async () => {
    const customLogs = [
      { category: "info" as LogCategory, message: "Custom log 1" },
      { category: "warning" as LogCategory, message: "Custom warning" },
      { category: "error" as LogCategory, message: "Custom error" },
    ];
    const agent = createMockAgent({ logs: customLogs });

    const result = await agent.run({
      model: "test",
      prompt: "test",
      files: [],
    });

    expect(result.logs).toHaveLength(3);
    expect(result.logs[0]!.message).toBe("Custom log 1");
    expect(result.logs[1]!.message).toBe("Custom warning");
    expect(result.logs[2]!.message).toBe("Custom error");
  });

  test("run uses configured output", async () => {
    const customOutput = ["Line 1\n", "Line 2\n", "Line 3\n"];
    const agent = createMockAgent({ output: customOutput });

    const result = await agent.run({
      model: "test",
      prompt: "test",
      files: [],
    });

    expect(result.output).toHaveLength(3);
    expect(result.output[0]!.text).toBe("Line 1\n");
    expect(result.output[1]!.text).toBe("Line 2\n");
    expect(result.output[2]!.text).toBe("Line 3\n");
  });

  test("run uses configured exit code", async () => {
    const agent = createMockAgent({ exitCode: 1 });

    const result = await agent.run({
      model: "test",
      prompt: "test",
      files: [],
    });

    expect(result.exitCode).toBe(1);
  });

  test("run calls event callbacks", async () => {
    const agent = createMockAgent({
      logs: [{ category: "info", message: "Test log" }],
      output: ["Test output"],
    });

    const receivedLogs: string[] = [];
    const receivedOutput: string[] = [];

    await agent.run({
      model: "test",
      prompt: "test",
      files: [],
      events: {
        onLog: (entry) => receivedLogs.push(entry.message),
        onOutput: (out) => receivedOutput.push(out.text),
      },
    });

    expect(receivedLogs).toEqual(["Test log"]);
    expect(receivedOutput).toEqual(["Test output"]);
  });

  test("configure updates agent behavior", async () => {
    const agent = createMockAgent();

    // Initial run
    let result = await agent.run({
      model: "test",
      prompt: "test",
      files: [],
    });
    expect(result.exitCode).toBe(0);

    // Reconfigure
    agent.configure({
      exitCode: 2,
      logs: [{ category: "error", message: "Reconfigured error" }],
      output: ["Reconfigured output"],
    });

    // Run again
    result = await agent.run({
      model: "test",
      prompt: "test",
      files: [],
    });

    expect(result.exitCode).toBe(2);
    expect(result.logs[0]!.message).toBe("Reconfigured error");
    expect(result.output[0]!.text).toBe("Reconfigured output");
  });

  test("run respects delay configuration", async () => {
    const agent = createMockAgent({ delay: 50 });

    const start = Date.now();
    await agent.run({
      model: "test",
      prompt: "test",
      files: [],
    });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(49); // 50ms delay, but allow for some jitter
  });
});

describe("helper functions", () => {
  test("createLogEntry creates entry with timestamp", () => {
    const before = new Date();
    const entry = createLogEntry("success", "Test message");
    const after = new Date();

    expect(entry.category).toBe("success");
    expect(entry.message).toBe("Test message");
    expect(entry.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(entry.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  test("createAgentOutput creates output with timestamp", () => {
    const before = new Date();
    const output = createAgentOutput("Test output");
    const after = new Date();

    expect(output.text).toBe("Test output");
    expect(output.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(output.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

describe("MockAgent with DexMock integration", () => {
  function createTestTask(overrides: Partial<DexTask> = {}): DexTask {
    return {
      id: "task-1",
      parent_id: null,
      name: "Test Task",
      description: "A test task",
      priority: 0,
      completed: false,
      result: null,
      metadata: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      started_at: null,
      completed_at: null,
      blockedBy: [],
      blocks: [],
      children: [],
      ...overrides,
    };
  }

  test("completes first ready task when dexMock provided and exitCode is 0", async () => {
    const dexMock = new DexMock();
    dexMock.setTasks([createTestTask({ id: "task-1" })]);

    const agent = createMockAgent({ dexMock, exitCode: 0 });
    await agent.run({
      model: "test",
      prompt: "test",
      files: [],
    });

    // Verify task was started and completed
    const calls = dexMock.getCalls();
    expect(calls.find((c) => c.method === "listReady")).toBeDefined();
    expect(calls.find((c) => c.method === "start" && c.args[0] === "task-1")).toBeDefined();
    expect(calls.find((c) => c.method === "complete" && c.args[0] === "task-1")).toBeDefined();

    // Task should be completed in dexMock
    const taskDetails = dexMock.show("task-1");
    expect(taskDetails.completed).toBe(true);
  });

  test("starts but does not complete task when exitCode is non-zero", async () => {
    const dexMock = new DexMock();
    dexMock.setTasks([createTestTask({ id: "task-1" })]);

    const agent = createMockAgent({ dexMock, exitCode: 1 });
    await agent.run({
      model: "test",
      prompt: "test",
      files: [],
    });

    // Verify task was started but not completed
    const calls = dexMock.getCalls();
    expect(calls.find((c) => c.method === "start" && c.args[0] === "task-1")).toBeDefined();
    expect(calls.find((c) => c.method === "complete")).toBeUndefined();

    // Task should be started but not completed
    const taskDetails = dexMock.show("task-1");
    expect(taskDetails.completed).toBe(false);
  });

  test("does not interact with dexMock when completeTask is false", async () => {
    const dexMock = new DexMock();
    dexMock.setTasks([createTestTask({ id: "task-1" })]);

    const agent = createMockAgent({ dexMock, exitCode: 0, completeTask: false });
    await agent.run({
      model: "test",
      prompt: "test",
      files: [],
    });

    // No start or complete calls should be made
    const calls = dexMock.getCalls();
    expect(calls.find((c) => c.method === "start")).toBeUndefined();
    expect(calls.find((c) => c.method === "complete")).toBeUndefined();
  });

  test("completeTask defaults to true when dexMock is provided", async () => {
    const dexMock = new DexMock();
    dexMock.setTasks([createTestTask({ id: "task-1" })]);

    // Just pass dexMock, completeTask should default to true
    const agent = createMockAgent({ dexMock });
    await agent.run({
      model: "test",
      prompt: "test",
      files: [],
    });

    // Task should be completed
    const taskDetails = dexMock.show("task-1");
    expect(taskDetails.completed).toBe(true);
  });

  test("handles no ready tasks gracefully", async () => {
    const dexMock = new DexMock();
    // Task is already completed, so not ready
    dexMock.setTasks([createTestTask({ id: "task-1", completed: true })]);

    const agent = createMockAgent({ dexMock, exitCode: 0 });
    const result = await agent.run({
      model: "test",
      prompt: "test",
      files: [],
    });

    // Should not throw, should still return success
    expect(result.exitCode).toBe(0);

    // No start call since no ready tasks
    const calls = dexMock.getCalls();
    expect(calls.find((c) => c.method === "start")).toBeUndefined();
  });

  test("only completes first ready task when multiple tasks are ready", async () => {
    const dexMock = new DexMock();
    dexMock.setTasks([
      createTestTask({ id: "task-1" }),
      createTestTask({ id: "task-2" }),
      createTestTask({ id: "task-3" }),
    ]);

    const agent = createMockAgent({ dexMock, exitCode: 0 });
    await agent.run({
      model: "test",
      prompt: "test",
      files: [],
    });

    // Only first task should be completed
    expect(dexMock.show("task-1").completed).toBe(true);
    expect(dexMock.show("task-2").completed).toBe(false);
    expect(dexMock.show("task-3").completed).toBe(false);
  });

  test("can configure dexMock via configure method", async () => {
    const agent = createMockAgent({ exitCode: 0 });
    const dexMock = new DexMock();
    dexMock.setTasks([createTestTask({ id: "task-1" })]);

    // Configure dexMock after construction
    agent.configure({ dexMock });

    await agent.run({
      model: "test",
      prompt: "test",
      files: [],
    });

    // Task should be completed
    expect(dexMock.show("task-1").completed).toBe(true);
  });

  test("failAfterStart: starts task but does not complete it, leaves task in_progress", async () => {
    const dexMock = new DexMock();
    dexMock.setTasks([createTestTask({ id: "task-1" })]);

    const agent = createMockAgent({
      dexMock,
      failAfterStart: true,
      logs: [{ category: "error", message: "Simulated failure" }],
    });

    const result = await agent.run({
      model: "test",
      prompt: "test",
      files: [],
    });

    // Should return exitCode 1
    expect(result.exitCode).toBe(1);

    // Should emit error log
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]!.category).toBe("error");
    expect(result.logs[0]!.message).toBe("Simulated failure");

    // Verify task was started
    const calls = dexMock.getCalls();
    expect(calls.find((c) => c.method === "start" && c.args[0] === "task-1")).toBeDefined();

    // Verify task was NOT completed
    expect(calls.find((c) => c.method === "complete")).toBeUndefined();

    // Task should still be in_progress (started but not completed)
    const taskDetails = dexMock.show("task-1");
    expect(taskDetails.completed).toBe(false);
    expect(taskDetails.started_at).not.toBeNull();
  });
});
