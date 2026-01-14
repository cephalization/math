import { test, expect, describe } from "bun:test";
import {
  MockAgent,
  createMockAgent,
  createLogEntry,
  createAgentOutput,
  type LogCategory,
  type AgentRunOptions,
} from "./agent";

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
