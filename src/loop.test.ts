import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMockAgent } from "./agent";
import { createOutputBuffer } from "./ui/buffer";
import { DEFAULT_PORT } from "./ui/server";
import type { DexStatus, DexTask, DexTaskDetails } from "./dex";

/**
 * Helper to create a mock DexStatus object
 */
function createMockDexStatus(overrides: Partial<DexStatus["stats"]> = {}): DexStatus {
  return {
    stats: {
      total: 1,
      pending: 0,
      completed: 1,
      blocked: 0,
      ready: 0,
      inProgress: 0,
      ...overrides,
    },
    inProgressTasks: [],
    readyTasks: [],
    blockedTasks: [],
    recentlyCompleted: [],
  };
}

/**
 * Helper to create a mock DexTask object
 */
function createMockDexTask(overrides: Partial<DexTask> = {}): DexTask {
  return {
    id: "test-task",
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

/**
 * Helper to create a mock DexTaskDetails object
 */
function createMockDexTaskDetails(overrides: Partial<DexTaskDetails> = {}): DexTaskDetails {
  return {
    ...createMockDexTask(),
    ancestors: [],
    depth: 0,
    subtasks: {
      pending: 0,
      completed: 0,
      children: [],
    },
    grandchildren: null,
    isBlocked: false,
    ...overrides,
  };
}

// Mock functions - declared at module level
let mockIsDexAvailable = mock(() => Promise.resolve(true));
let mockDexStatus = mock(() => Promise.resolve(createMockDexStatus()));
let mockDexListReady = mock(() => Promise.resolve([] as DexTask[]));
let mockDexShow = mock((_id: string) => Promise.resolve(createMockDexTaskDetails()));

// Mock the dex module before tests run
mock.module("./dex", () => ({
  isDexAvailable: () => mockIsDexAvailable(),
  dexStatus: () => mockDexStatus(),
  dexListReady: () => mockDexListReady(),
  dexShow: (id: string) => mockDexShow(id),
  defaultDexClient: {
    isAvailable: () => mockIsDexAvailable(),
    status: () => mockDexStatus(),
    listReady: () => mockDexListReady(),
    show: (id: string) => mockDexShow(id),
    start: () => {},
    complete: () => {},
  },
}));

describe("runLoop dry-run mode", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    // Reset mocks to default behavior
    mockIsDexAvailable = mock(() => Promise.resolve(true));
    mockDexStatus = mock(() => Promise.resolve(createMockDexStatus()));
    mockDexListReady = mock(() => Promise.resolve([] as DexTask[]));
    mockDexShow = mock((_id: string) => Promise.resolve(createMockDexTaskDetails()));

    // Create a temp directory for each test
    testDir = await mkdtemp(join(tmpdir(), "math-loop-test-"));
    originalCwd = process.cwd();
    process.chdir(testDir);

    // Create the .math/todo directory with required files
    const todoDir = join(testDir, ".math", "todo");
    await mkdir(todoDir, { recursive: true });

    // Create PROMPT.md
    await writeFile(
      join(todoDir, "PROMPT.md"),
      "# Test Prompt\n\nTest instructions."
    );

    // Create .dex directory (required by loop)
    await mkdir(join(testDir, ".dex"), { recursive: true });
  });

  afterEach(async () => {
    // Restore original working directory
    process.chdir(originalCwd);

    // Clean up temp directory
    await rm(testDir, { recursive: true, force: true });
  });

  test("dry-run mode uses custom mock agent", async () => {
    // Import runLoop after mocks are set up
    const { runLoop } = await import("./loop");

    // Configure dex mocks for pending task
    mockDexStatus = mock(() =>
      Promise.resolve(createMockDexStatus({ pending: 1, completed: 0, ready: 1 }))
    );
    mockDexListReady = mock(() =>
      Promise.resolve([createMockDexTask({ id: "test-task", name: "Test task" })])
    );
    mockDexShow = mock(() =>
      Promise.resolve(createMockDexTaskDetails({ id: "test-task", name: "Test task" }))
    );

    const mockAgent = createMockAgent({
      logs: [
        { category: "info", message: "Custom mock log" },
        { category: "success", message: "Custom mock success" },
      ],
      output: ["Custom mock output\n"],
      exitCode: 0,
    });

    const logs: string[] = [];
    const outputs: string[] = [];
    const originalLog = console.log;
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);

    console.log = (...args: unknown[]) => {
      logs.push(args.join(" "));
    };
    process.stdout.write = (chunk: string | Uint8Array) => {
      if (typeof chunk === "string") {
        outputs.push(chunk);
      }
      return true;
    };

    try {
      await runLoop({
        dryRun: true,
        agent: mockAgent,
        maxIterations: 1,
        pauseSeconds: 0,
        ui: false,
      });
    } catch {
      // Expected: max iterations exceeded since mock doesn't complete tasks
    }

    // Verify custom mock agent logs were emitted
    const logText = logs.join("\n");
    expect(logText).toContain("Custom mock log");
    expect(logText).toContain("Custom mock success");

    // Verify custom mock output was emitted
    const outputText = outputs.join("");
    expect(outputText).toContain("Custom mock output");

    console.log = originalLog;
    process.stdout.write = originalStdoutWrite;
  });

  test("dry-run mode with pending tasks runs iteration", async () => {
    const { runLoop } = await import("./loop");

    // Configure dex mocks for pending task
    mockDexStatus = mock(() =>
      Promise.resolve(createMockDexStatus({ pending: 1, completed: 0, ready: 1 }))
    );
    mockDexListReady = mock(() =>
      Promise.resolve([createMockDexTask()])
    );

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.join(" "));
    };

    try {
      await runLoop({
        dryRun: true,
        maxIterations: 1,
        pauseSeconds: 0,
        ui: false,
      });
    } catch (e) {
      // Expected: will exceed max iterations since mock doesn't complete tasks
    } finally {
      console.log = originalLog;
    }

    // Verify iteration ran
    const logText = logs.join("\n");
    expect(logText).toContain("=== Iteration 1 ===");
    expect(logText).toContain("Invoking agent");
  });

  test("agent option allows injecting custom agent", async () => {
    const { runLoop } = await import("./loop");

    // Configure dex mocks for all tasks complete
    mockDexStatus = mock(() =>
      Promise.resolve(createMockDexStatus({ total: 1, completed: 1, pending: 0 }))
    );

    const callCount = { value: 0 };
    const mockAgent = createMockAgent({
      logs: [{ category: "info", message: "Injected agent running" }],
      exitCode: 0,
    });

    // Wrap the run method to count calls
    const originalRun = mockAgent.run.bind(mockAgent);
    mockAgent.run = async (options) => {
      callCount.value++;
      return originalRun(options);
    };

    await runLoop({
      dryRun: true,
      agent: mockAgent,
      maxIterations: 1,
      pauseSeconds: 0,
      ui: false,
    });

    // Agent should not be called since all tasks are complete
    expect(callCount.value).toBe(0);
  });

  test("agent option with pending task invokes agent", async () => {
    const { runLoop } = await import("./loop");

    // Configure dex mocks for pending task
    mockDexStatus = mock(() =>
      Promise.resolve(createMockDexStatus({ pending: 1, completed: 0, ready: 1 }))
    );
    mockDexListReady = mock(() =>
      Promise.resolve([createMockDexTask()])
    );

    const callCount = { value: 0 };
    const mockAgent = createMockAgent({
      logs: [{ category: "success", message: "Agent ran" }],
      exitCode: 0,
    });

    const originalRun = mockAgent.run.bind(mockAgent);
    mockAgent.run = async (options) => {
      callCount.value++;
      return originalRun(options);
    };

    try {
      await runLoop({
        dryRun: true,
        agent: mockAgent,
        maxIterations: 1,
        pauseSeconds: 0,
        ui: false,
      });
    } catch {
      // Expected: max iterations exceeded
    }

    // Agent should be called at least once
    expect(callCount.value).toBeGreaterThanOrEqual(1);
  });
});

describe("runLoop stream-capture with buffer", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    // Reset mocks to default behavior - all tasks complete
    mockIsDexAvailable = mock(() => Promise.resolve(true));
    mockDexStatus = mock(() =>
      Promise.resolve(createMockDexStatus({ total: 1, completed: 1, pending: 0 }))
    );
    mockDexListReady = mock(() => Promise.resolve([] as DexTask[]));
    mockDexShow = mock((_id: string) => Promise.resolve(createMockDexTaskDetails()));

    // Create a temp directory for each test
    testDir = await mkdtemp(join(tmpdir(), "math-loop-test-"));
    originalCwd = process.cwd();
    process.chdir(testDir);

    // Create the .math/todo directory with required files
    const todoDir = join(testDir, ".math", "todo");
    await mkdir(todoDir, { recursive: true });

    // Create PROMPT.md
    await writeFile(
      join(todoDir, "PROMPT.md"),
      "# Test Prompt\n\nTest instructions."
    );

    // Create .dex directory
    await mkdir(join(testDir, ".dex"), { recursive: true });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(testDir, { recursive: true, force: true });
  });

  test("loop logs are captured to buffer", async () => {
    const { runLoop } = await import("./loop");
    const buffer = createOutputBuffer();

    // Suppress console output during test
    const originalLog = console.log;
    console.log = () => {};

    try {
      await runLoop({
        dryRun: true,
        maxIterations: 1,
        pauseSeconds: 0,
        buffer,
        ui: false,
      });

      // Verify logs were captured
      const logs = buffer.getLogs();
      expect(logs.length).toBeGreaterThan(0);

      // Should have info logs
      const infoLogs = logs.filter((l) => l.category === "info");
      expect(infoLogs.length).toBeGreaterThan(0);

      // Check for expected log messages
      const messages = logs.map((l) => l.message);
      expect(messages.some((m) => m.includes("Starting math loop"))).toBe(true);
    } finally {
      console.log = originalLog;
    }
  });

  test("loop success logs are captured with correct category", async () => {
    const { runLoop } = await import("./loop");
    const buffer = createOutputBuffer();

    const originalLog = console.log;
    console.log = () => {};

    try {
      await runLoop({
        dryRun: true,
        maxIterations: 1,
        pauseSeconds: 0,
        buffer,
        ui: false,
      });

      const logs = buffer.getLogs();
      const successLogs = logs.filter((l) => l.category === "success");

      // Should have success logs (tasks complete)
      expect(successLogs.length).toBeGreaterThan(0);
      expect(
        successLogs.some((l) => l.message.includes("tasks complete"))
      ).toBe(true);
    } finally {
      console.log = originalLog;
    }
  });

  test("agent output is captured to buffer", async () => {
    const { runLoop } = await import("./loop");

    // Configure dex mocks for pending task so agent runs
    mockDexStatus = mock(() =>
      Promise.resolve(createMockDexStatus({ pending: 1, completed: 0, ready: 1 }))
    );
    mockDexListReady = mock(() =>
      Promise.resolve([createMockDexTask()])
    );

    const buffer = createOutputBuffer();
    const mockAgent = createMockAgent({
      logs: [{ category: "info", message: "Agent working" }],
      output: ["Agent output text\n", "More output\n"],
      exitCode: 0,
    });

    const originalLog = console.log;
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    console.log = () => {};
    process.stdout.write = () => true;

    try {
      await runLoop({
        dryRun: true,
        agent: mockAgent,
        maxIterations: 1,
        pauseSeconds: 0,
        buffer,
        ui: false,
      });
    } catch {
      // Expected: max iterations exceeded
    } finally {
      console.log = originalLog;
      process.stdout.write = originalStdoutWrite;
    }

    // Verify agent output was captured
    const output = buffer.getOutput();
    expect(output.length).toBe(2);
    expect(output[0]!.text).toBe("Agent output text\n");
    expect(output[1]!.text).toBe("More output\n");
  });

  test("buffer subscribers receive logs in real-time", async () => {
    const { runLoop } = await import("./loop");
    const buffer = createOutputBuffer();
    const receivedLogs: string[] = [];

    // Subscribe before running loop
    buffer.subscribeLogs((entry) => {
      receivedLogs.push(entry.message);
    });

    const originalLog = console.log;
    console.log = () => {};

    try {
      await runLoop({
        dryRun: true,
        maxIterations: 1,
        pauseSeconds: 0,
        buffer,
        ui: false,
      });

      // Verify subscriber received logs
      expect(receivedLogs.length).toBeGreaterThan(0);
      expect(receivedLogs.some((m) => m.includes("Starting math loop"))).toBe(
        true
      );
    } finally {
      console.log = originalLog;
    }
  });

  test("buffer subscribers receive agent output in real-time", async () => {
    const { runLoop } = await import("./loop");

    // Configure dex mocks for pending task so agent runs
    mockDexStatus = mock(() =>
      Promise.resolve(createMockDexStatus({ pending: 1, completed: 0, ready: 1 }))
    );
    mockDexListReady = mock(() =>
      Promise.resolve([createMockDexTask()])
    );

    const buffer = createOutputBuffer();
    const receivedOutput: string[] = [];

    // Subscribe before running loop
    buffer.subscribeOutput((output) => {
      receivedOutput.push(output.text);
    });

    const mockAgent = createMockAgent({
      output: ["Streamed output\n"],
      exitCode: 0,
    });

    const originalLog = console.log;
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    console.log = () => {};
    process.stdout.write = () => true;

    try {
      await runLoop({
        dryRun: true,
        agent: mockAgent,
        maxIterations: 1,
        pauseSeconds: 0,
        buffer,
        ui: false,
      });
    } catch {
      // Expected: max iterations exceeded
    } finally {
      console.log = originalLog;
      process.stdout.write = originalStdoutWrite;
    }

    // Verify subscriber received output
    expect(receivedOutput).toContain("Streamed output\n");
  });

  test("console.log still works without buffer", async () => {
    const { runLoop } = await import("./loop");

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.join(" "));
    };

    try {
      // Run without buffer - console.log should still work
      await runLoop({
        dryRun: true,
        maxIterations: 1,
        pauseSeconds: 0,
        ui: false,
      });

      // Verify console.log was called
      const logText = logs.join("\n");
      expect(logText).toContain("Starting math loop");
    } finally {
      console.log = originalLog;
    }
  });
});

describe("runLoop UI server integration", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    // Reset mocks - all tasks complete
    mockIsDexAvailable = mock(() => Promise.resolve(true));
    mockDexStatus = mock(() =>
      Promise.resolve(createMockDexStatus({ total: 1, completed: 1, pending: 0 }))
    );
    mockDexListReady = mock(() => Promise.resolve([] as DexTask[]));
    mockDexShow = mock((_id: string) => Promise.resolve(createMockDexTaskDetails()));

    // Create a temp directory for each test
    testDir = await mkdtemp(join(tmpdir(), "math-loop-ui-test-"));
    originalCwd = process.cwd();
    process.chdir(testDir);

    // Create the .math/todo directory with required files
    const todoDir = join(testDir, ".math", "todo");
    await mkdir(todoDir, { recursive: true });

    // Create PROMPT.md
    await writeFile(
      join(todoDir, "PROMPT.md"),
      "# Test Prompt\n\nTest instructions."
    );

    // Create .dex directory
    await mkdir(join(testDir, ".dex"), { recursive: true });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(testDir, { recursive: true, force: true });
  });

  // NOTE: UI server tests are skipped in automated testing because:
  // 1. They require exclusive port access (can't run in parallel)
  // 2. The server stays running after tests complete (as designed)
  // Manual testing should verify UI server integration works correctly.

  test("ui: false disables the server", async () => {
    const { runLoop } = await import("./loop");

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.join(" "));
    };

    try {
      await runLoop({
        dryRun: true,
        maxIterations: 1,
        pauseSeconds: 0,
        ui: false,
      });

      // Verify UI server URL is NOT logged
      const logText = logs.join("\n");
      expect(logText).not.toContain("Web UI available");
    } finally {
      console.log = originalLog;
    }
  });
});

describe("runLoop dex integration", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    // Reset mocks
    mockIsDexAvailable = mock(() => Promise.resolve(true));
    mockDexStatus = mock(() => Promise.resolve(createMockDexStatus()));
    mockDexListReady = mock(() => Promise.resolve([] as DexTask[]));
    mockDexShow = mock((_id: string) => Promise.resolve(createMockDexTaskDetails()));

    testDir = await mkdtemp(join(tmpdir(), "math-loop-dex-test-"));
    originalCwd = process.cwd();
    process.chdir(testDir);

    const todoDir = join(testDir, ".math", "todo");
    await mkdir(todoDir, { recursive: true });
    await writeFile(
      join(todoDir, "PROMPT.md"),
      "# Test Prompt\n\nTest instructions."
    );
    await mkdir(join(testDir, ".dex"), { recursive: true });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(testDir, { recursive: true, force: true });
  });

  test("throws error when dex is not available", async () => {
    const { runLoop } = await import("./loop");
    mockIsDexAvailable = mock(() => Promise.resolve(false));

    const originalLog = console.log;
    console.log = () => {};

    try {
      await expect(
        runLoop({
          dryRun: true,
          maxIterations: 1,
          pauseSeconds: 0,
          ui: false,
        })
      ).rejects.toThrow("dex not found in PATH");
    } finally {
      console.log = originalLog;
    }
  });

  test("throws error when dexStatus fails", async () => {
    const { runLoop } = await import("./loop");
    mockDexStatus = mock(() =>
      Promise.reject(new Error("dex not initialized"))
    );

    const originalLog = console.log;
    console.log = () => {};

    try {
      await expect(
        runLoop({
          dryRun: true,
          maxIterations: 1,
          pauseSeconds: 0,
          ui: false,
        })
      ).rejects.toThrow("Failed to get dex status");
    } finally {
      console.log = originalLog;
    }
  });

  test("throws error when no tasks exist in dex", async () => {
    const { runLoop } = await import("./loop");
    mockDexStatus = mock(() =>
      Promise.resolve(createMockDexStatus({ total: 0, completed: 0, pending: 0 }))
    );

    const originalLog = console.log;
    console.log = () => {};

    try {
      await expect(
        runLoop({
          dryRun: true,
          maxIterations: 1,
          pauseSeconds: 0,
          ui: false,
        })
      ).rejects.toThrow("No tasks found in dex");
    } finally {
      console.log = originalLog;
    }
  });

  test("logs warning when in_progress tasks exist", async () => {
    const { runLoop } = await import("./loop");
    mockDexStatus = mock(() =>
      Promise.resolve(
        createMockDexStatus({ total: 2, pending: 1, completed: 0, inProgress: 1, ready: 1 })
      )
    );
    mockDexListReady = mock(() =>
      Promise.resolve([createMockDexTask()])
    );

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.join(" "));
    };

    try {
      await runLoop({
        dryRun: true,
        maxIterations: 1,
        pauseSeconds: 0,
        ui: false,
      });
    } catch {
      // Expected: max iterations exceeded
    } finally {
      console.log = originalLog;
    }

    const logText = logs.join("\n");
    expect(logText).toContain("in_progress");
  });

  test("completes successfully when all tasks are done", async () => {
    const { runLoop } = await import("./loop");
    mockDexStatus = mock(() =>
      Promise.resolve(createMockDexStatus({ total: 3, completed: 3, pending: 0, inProgress: 0 }))
    );

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.join(" "));
    };

    try {
      await runLoop({
        dryRun: true,
        maxIterations: 10,
        pauseSeconds: 0,
        ui: false,
      });

      const logText = logs.join("\n");
      expect(logText).toContain("All 3 tasks complete");
    } finally {
      console.log = originalLog;
    }
  });

  test("includes task details in agent prompt when ready tasks exist", async () => {
    const { runLoop } = await import("./loop");
    const taskDetails = createMockDexTaskDetails({
      id: "ready-task-123",
      name: "Ready task name",
      description: "Task description here",
      blockedBy: ["dep-1", "dep-2"],
    });

    mockDexStatus = mock(() =>
      Promise.resolve(createMockDexStatus({ pending: 1, ready: 1 }))
    );
    mockDexListReady = mock(() =>
      Promise.resolve([createMockDexTask({ id: "ready-task-123" })])
    );
    mockDexShow = mock(() => Promise.resolve(taskDetails));

    let capturedPrompt = "";
    const mockAgent = createMockAgent({
      exitCode: 0,
    });
    const originalRun = mockAgent.run.bind(mockAgent);
    mockAgent.run = async (options) => {
      capturedPrompt = options.prompt;
      return originalRun(options);
    };

    const originalLog = console.log;
    console.log = () => {};

    try {
      await runLoop({
        dryRun: true,
        agent: mockAgent,
        maxIterations: 1,
        pauseSeconds: 0,
        ui: false,
      });
    } catch {
      // Expected
    } finally {
      console.log = originalLog;
    }

    expect(capturedPrompt).toContain("ready-task-123");
    expect(capturedPrompt).toContain("Ready task name");
    expect(capturedPrompt).toContain("Task description here");
    expect(capturedPrompt).toContain("dep-1");
    expect(capturedPrompt).toContain("dep-2");
  });
});
