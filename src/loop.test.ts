import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runLoop } from "./loop";
import { createMockAgent } from "./agent";

describe("runLoop dry-run mode", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    // Create a temp directory for each test
    testDir = await mkdtemp(join(tmpdir(), "math-loop-test-"));
    originalCwd = process.cwd();
    process.chdir(testDir);

    // Create the todo directory with required files
    const todoDir = join(testDir, "todo");
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

  test("dry-run mode skips git operations and uses mock agent", async () => {
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
      });

      // Verify dry-run mode logs
      const logText = logs.join("\n");
      expect(logText).toContain("[DRY RUN]");
      expect(logText).toContain("Skipping git branch creation");
    } finally {
      console.log = originalLog;
    }
  });

  test("dry-run mode uses custom mock agent", async () => {
    // Use a pending task so the agent gets invoked
    await writeFile(
      join(testDir, "todo", "TASKS.md"),
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
      join(testDir, "todo", "TASKS.md"),
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
    });

    // Agent should not be called since all tasks are complete
    // (the task file has a complete task)
    expect(callCount.value).toBe(0);
  });

  test("agent option with pending task invokes agent", async () => {
    // Update TASKS.md to have a pending task
    await writeFile(
      join(testDir, "todo", "TASKS.md"),
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
      });
    } catch {
      // Expected: max iterations exceeded
    }

    // Agent should be called at least once
    expect(callCount.value).toBeGreaterThanOrEqual(1);
  });
});
