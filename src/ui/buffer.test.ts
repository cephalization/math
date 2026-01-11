import { test, expect, describe } from "bun:test";
import {
  OutputBuffer,
  createOutputBuffer,
  type BufferLogEntry,
  type BufferAgentOutput,
} from "./buffer";

describe("OutputBuffer", () => {
  describe("log entries", () => {
    test("appendLog adds entry with timestamp", () => {
      const buffer = createOutputBuffer();
      const before = new Date();
      
      const entry = buffer.appendLog("info", "Test message");
      
      const after = new Date();
      expect(entry.category).toBe("info");
      expect(entry.message).toBe("Test message");
      expect(entry.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(entry.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    test("getLogs returns all appended logs", () => {
      const buffer = createOutputBuffer();
      
      buffer.appendLog("info", "Message 1");
      buffer.appendLog("success", "Message 2");
      buffer.appendLog("warning", "Message 3");
      buffer.appendLog("error", "Message 4");
      
      const logs = buffer.getLogs();
      
      expect(logs).toHaveLength(4);
      expect(logs[0]!.category).toBe("info");
      expect(logs[0]!.message).toBe("Message 1");
      expect(logs[1]!.category).toBe("success");
      expect(logs[1]!.message).toBe("Message 2");
      expect(logs[2]!.category).toBe("warning");
      expect(logs[2]!.message).toBe("Message 3");
      expect(logs[3]!.category).toBe("error");
      expect(logs[3]!.message).toBe("Message 4");
    });

    test("getLogs returns a copy, not the internal array", () => {
      const buffer = createOutputBuffer();
      buffer.appendLog("info", "Test");
      
      const logs1 = buffer.getLogs();
      const logs2 = buffer.getLogs();
      
      expect(logs1).not.toBe(logs2);
      expect(logs1).toEqual(logs2);
    });
  });

  describe("agent output", () => {
    test("appendOutput adds entry with timestamp", () => {
      const buffer = createOutputBuffer();
      const before = new Date();
      
      const output = buffer.appendOutput("Test output");
      
      const after = new Date();
      expect(output.text).toBe("Test output");
      expect(output.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(output.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    test("getOutput returns all appended output", () => {
      const buffer = createOutputBuffer();
      
      buffer.appendOutput("Output 1\n");
      buffer.appendOutput("Output 2\n");
      buffer.appendOutput("Output 3\n");
      
      const output = buffer.getOutput();
      
      expect(output).toHaveLength(3);
      expect(output[0]!.text).toBe("Output 1\n");
      expect(output[1]!.text).toBe("Output 2\n");
      expect(output[2]!.text).toBe("Output 3\n");
    });

    test("getOutput returns a copy, not the internal array", () => {
      const buffer = createOutputBuffer();
      buffer.appendOutput("Test");
      
      const output1 = buffer.getOutput();
      const output2 = buffer.getOutput();
      
      expect(output1).not.toBe(output2);
      expect(output1).toEqual(output2);
    });
  });

  describe("subscriptions", () => {
    test("subscribeLogs notifies on new log entries", () => {
      const buffer = createOutputBuffer();
      const received: BufferLogEntry[] = [];
      
      buffer.subscribeLogs((entry) => received.push(entry));
      buffer.appendLog("info", "Test 1");
      buffer.appendLog("warning", "Test 2");
      
      expect(received).toHaveLength(2);
      expect(received[0]!.message).toBe("Test 1");
      expect(received[1]!.message).toBe("Test 2");
    });

    test("subscribeOutput notifies on new output", () => {
      const buffer = createOutputBuffer();
      const received: BufferAgentOutput[] = [];
      
      buffer.subscribeOutput((output) => received.push(output));
      buffer.appendOutput("Output 1");
      buffer.appendOutput("Output 2");
      
      expect(received).toHaveLength(2);
      expect(received[0]!.text).toBe("Output 1");
      expect(received[1]!.text).toBe("Output 2");
    });

    test("unsubscribe from logs stops notifications", () => {
      const buffer = createOutputBuffer();
      const received: BufferLogEntry[] = [];
      
      const unsubscribe = buffer.subscribeLogs((entry) => received.push(entry));
      buffer.appendLog("info", "Before");
      
      unsubscribe();
      buffer.appendLog("info", "After");
      
      expect(received).toHaveLength(1);
      expect(received[0]!.message).toBe("Before");
    });

    test("unsubscribe from output stops notifications", () => {
      const buffer = createOutputBuffer();
      const received: BufferAgentOutput[] = [];
      
      const unsubscribe = buffer.subscribeOutput((output) => received.push(output));
      buffer.appendOutput("Before");
      
      unsubscribe();
      buffer.appendOutput("After");
      
      expect(received).toHaveLength(1);
      expect(received[0]!.text).toBe("Before");
    });

    test("multiple log subscribers receive notifications", () => {
      const buffer = createOutputBuffer();
      const received1: string[] = [];
      const received2: string[] = [];
      
      buffer.subscribeLogs((entry) => received1.push(entry.message));
      buffer.subscribeLogs((entry) => received2.push(entry.message));
      buffer.appendLog("info", "Test");
      
      expect(received1).toEqual(["Test"]);
      expect(received2).toEqual(["Test"]);
    });

    test("multiple output subscribers receive notifications", () => {
      const buffer = createOutputBuffer();
      const received1: string[] = [];
      const received2: string[] = [];
      
      buffer.subscribeOutput((output) => received1.push(output.text));
      buffer.subscribeOutput((output) => received2.push(output.text));
      buffer.appendOutput("Test");
      
      expect(received1).toEqual(["Test"]);
      expect(received2).toEqual(["Test"]);
    });
  });

  describe("clear", () => {
    test("clear removes all logs and output", () => {
      const buffer = createOutputBuffer();
      
      buffer.appendLog("info", "Log 1");
      buffer.appendLog("success", "Log 2");
      buffer.appendOutput("Output 1");
      buffer.appendOutput("Output 2");
      
      expect(buffer.getLogs()).toHaveLength(2);
      expect(buffer.getOutput()).toHaveLength(2);
      
      buffer.clear();
      
      expect(buffer.getLogs()).toHaveLength(0);
      expect(buffer.getOutput()).toHaveLength(0);
    });

    test("subscriptions still work after clear", () => {
      const buffer = createOutputBuffer();
      const receivedLogs: string[] = [];
      const receivedOutput: string[] = [];
      
      buffer.subscribeLogs((entry) => receivedLogs.push(entry.message));
      buffer.subscribeOutput((output) => receivedOutput.push(output.text));
      
      buffer.appendLog("info", "Before");
      buffer.appendOutput("Before");
      buffer.clear();
      buffer.appendLog("info", "After");
      buffer.appendOutput("After");
      
      expect(receivedLogs).toEqual(["Before", "After"]);
      expect(receivedOutput).toEqual(["Before", "After"]);
    });
  });
});

describe("createOutputBuffer", () => {
  test("creates a new OutputBuffer instance", () => {
    const buffer = createOutputBuffer();
    expect(buffer).toBeInstanceOf(OutputBuffer);
  });
});
