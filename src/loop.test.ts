import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runLoop } from "./loop";
import { createMockAgent } from "./agent";
import { createOutputBuffer } from "./ui/buffer";
import { DEFAULT_PORT } from "./ui/server";

describe("runLoop dry-run mode", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    // Create a temp directory for each test
    testDir = await mkdtemp(join(tmpdir(), "math-loop-test-"));
    originalCwd = process.cwd();
    process.chdir(testDir);

    // Create the .math/todo directory with required files (new structure)
    const todoDir = join(testDir, ".math", "todo");
    await mkdir(todoDir, { recursive: true });

    // Create PROMPT.md
    await writeFile(
      join(todoDir, "PROMPT.md"),
      "# Test Prompt\n\nTest instructions."
    );

    // Create TASKS.md with all tasks complete (so the loop exits after one iteration)
    await writeFile(
      join(todoDir, "TASKS.md"),
      `# Tasks

### test-task
- content: Test task
- status: complete
- dependencies: none
`
    );
  });

  afterEach(async () => {
    // Restore original working directory
    process.chdir(originalCwd);

    // Clean up temp directory
    await rm(testDir, { recursive: true, force: true });
  });

  test("dry-run mode uses custom mock agent", async () => {
    // Use a pending task so the agent gets invoked
    await writeFile(
      join(testDir, ".math", "todo", "TASKS.md"),
      `# Tasks

### test-task
- content: Test task
- status: pending
- dependencies: none
`
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
    // Update TASKS.md to have a pending task
    await writeFile(
      join(testDir, ".math", "todo", "TASKS.md"),
      `# Tasks

### test-task
- content: Test task
- status: pending
- dependencies: none
`
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
    // (the task file has a complete task)
    expect(callCount.value).toBe(0);
  });

  test("agent option with pending task invokes agent", async () => {
    // Update TASKS.md to have a pending task
    await writeFile(
      join(testDir, ".math", "todo", "TASKS.md"),
      `# Tasks

### test-task
- content: Test task
- status: pending
- dependencies: none
`
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
    // Create a temp directory for each test
    testDir = await mkdtemp(join(tmpdir(), "math-loop-test-"));
    originalCwd = process.cwd();
    process.chdir(testDir);

    // Create the .math/todo directory with required files (new structure)
    const todoDir = join(testDir, ".math", "todo");
    await mkdir(todoDir, { recursive: true });

    // Create PROMPT.md
    await writeFile(
      join(todoDir, "PROMPT.md"),
      "# Test Prompt\n\nTest instructions."
    );

    // Create TASKS.md with all tasks complete
    await writeFile(
      join(todoDir, "TASKS.md"),
      `# Tasks

### test-task
- content: Test task
- status: complete
- dependencies: none
`
    );
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(testDir, { recursive: true, force: true });
  });

  test("loop logs are captured to buffer", async () => {
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
    // Use a pending task so the agent gets invoked
    await writeFile(
      join(testDir, ".math", "todo", "TASKS.md"),
      `# Tasks

### test-task
- content: Test task
- status: pending
- dependencies: none
`
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
    await writeFile(
      join(testDir, ".math", "todo", "TASKS.md"),
      `# Tasks

### test-task
- content: Test task
- status: pending
- dependencies: none
`
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
    // Create a temp directory for each test
    testDir = await mkdtemp(join(tmpdir(), "math-loop-ui-test-"));
    originalCwd = process.cwd();
    process.chdir(testDir);

    // Create the .math/todo directory with required files (new structure)
    const todoDir = join(testDir, ".math", "todo");
    await mkdir(todoDir, { recursive: true });

    // Create PROMPT.md
    await writeFile(
      join(todoDir, "PROMPT.md"),
      "# Test Prompt\n\nTest instructions."
    );

    // Create TASKS.md with all tasks complete
    await writeFile(
      join(todoDir, "TASKS.md"),
      `# Tasks

### test-task
- content: Test task
- status: complete
- dependencies: none
`
    );
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
