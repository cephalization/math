/**
 * Agent interface for the loop.
 * This module provides an abstraction over the opencode CLI that can be
 * satisfied by either the real CLI or a mock for testing.
 */

import type { DexMock } from "./testing/dex-mock";

/**
 * Log entry categories for loop status messages.
 */
export type LogCategory = "info" | "success" | "warning" | "error";

/**
 * A log entry emitted by the agent or loop.
 */
export interface LogEntry {
  timestamp: Date;
  category: LogCategory;
  message: string;
}

/**
 * Agent output event - raw text from the agent.
 */
export interface AgentOutput {
  timestamp: Date;
  text: string;
}

/**
 * Events emitted by an agent during execution.
 */
export interface AgentEvents {
  onLog?: (entry: LogEntry) => void;
  onOutput?: (output: AgentOutput) => void;
}

/**
 * Options for running the agent.
 */
export interface AgentRunOptions {
  model: string;
  prompt: string;
  files: string[];
  events?: AgentEvents;
}

/**
 * Result of an agent run.
 */
export interface AgentRunResult {
  exitCode: number;
  logs: LogEntry[];
  output: AgentOutput[];
}

/**
 * Agent interface that can be satisfied by opencode or a mock.
 */
export interface Agent {
  /**
   * Run the agent with the given options.
   */
  run(options: AgentRunOptions): Promise<AgentRunResult>;

  /**
   * Check if the agent is available.
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Create a log entry helper.
 */
export function createLogEntry(
  category: LogCategory,
  message: string
): LogEntry {
  return {
    timestamp: new Date(),
    category,
    message,
  };
}

/**
 * Create an agent output helper.
 */
export function createAgentOutput(text: string): AgentOutput {
  return {
    timestamp: new Date(),
    text,
  };
}

/**
 * OpenCode agent implementation that wraps the CLI.
 */
export class OpenCodeAgent implements Agent {
  async isAvailable(): Promise<boolean> {
    try {
      const result = await Bun.$`which opencode`.quiet();
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  async run(options: AgentRunOptions): Promise<AgentRunResult> {
    const logs: LogEntry[] = [];
    const output: AgentOutput[] = [];

    const emitLog = (category: LogCategory, message: string) => {
      const entry = createLogEntry(category, message);
      logs.push(entry);
      options.events?.onLog?.(entry);
    };

    const emitOutput = (text: string) => {
      const out = createAgentOutput(text);
      output.push(out);
      options.events?.onOutput?.(out);
    };

    emitLog("info", "Invoking opencode agent...");

    try {
      // Build the command arguments
      const fileArgs = options.files.flatMap((f) => ["-f", f]);

      // Run opencode and capture output
      const proc = Bun.spawn(
        ["opencode", "run", "-m", options.model, options.prompt, ...fileArgs],
        {
          stdout: "pipe",
          stderr: "pipe",
        }
      );

      // Stream stdout and stderr, emitting output as it arrives
      const decoder = new TextDecoder();

      const streamOutput = async (
        stream: ReadableStream<Uint8Array> | null
      ) => {
        if (!stream) return;
        const reader = stream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            if (text) emitOutput(text);
          }
        } finally {
          reader.releaseLock();
        }
      };

      // Read both streams concurrently while waiting for process to exit
      await Promise.all([streamOutput(proc.stdout), streamOutput(proc.stderr)]);

      const exitCode = await proc.exited;

      if (exitCode === 0) {
        emitLog("success", "Agent completed successfully");
      } else {
        emitLog("error", `Agent exited with code ${exitCode}`);
      }

      return { exitCode, logs, output };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emitLog("error", `Error running agent: ${message}`);
      return { exitCode: 1, logs, output };
    }
  }
}

/**
 * Configuration options for MockAgent.
 */
export interface MockAgentConfig {
  available?: boolean;
  logs?: Array<{ category: LogCategory; message: string }>;
  output?: string[];
  exitCode?: number;
  delay?: number;
  dexMock?: DexMock;
  completeTask?: boolean;
  /**
   * When true AND dexMock is provided:
   * - Calls dexMock.start() to mark task in_progress
   * - Emits error log
   * - Returns with exitCode: 1
   * - Does NOT call dexMock.complete()
   * 
   * This simulates agent failure mid-execution, leaving task stuck in_progress.
   */
  failAfterStart?: boolean;
}

/**
 * Mock agent for testing that doesn't call an LLM.
 * Emits configurable log messages and output events.
 *
 * When a DexMock is provided, the agent will simulate task completion:
 * - Calls dexMock.start() for the first ready task
 * - Calls dexMock.complete() if exitCode is 0
 */
export class MockAgent implements Agent {
  private available: boolean;
  private mockLogs: Array<{ category: LogCategory; message: string }>;
  private mockOutput: string[];
  private mockExitCode: number;
  private mockDelay: number;
  private dexMock: DexMock | undefined;
  private completeTask: boolean;
  private failAfterStart: boolean;

  constructor(config: MockAgentConfig = {}) {
    this.available = config.available ?? true;
    this.mockLogs = config.logs ?? [
      { category: "info", message: "Mock agent starting..." },
      { category: "success", message: "Mock agent completed" },
    ];
    this.mockOutput = config.output ?? ["Mock agent output\n"];
    this.mockExitCode = config.exitCode ?? 0;
    this.mockDelay = config.delay ?? 0;
    this.dexMock = config.dexMock;
    // Default completeTask to true when dexMock is provided
    this.completeTask = config.completeTask ?? (config.dexMock !== undefined);
    this.failAfterStart = config.failAfterStart ?? false;
  }

  async isAvailable(): Promise<boolean> {
    return this.available;
  }

  async run(options: AgentRunOptions): Promise<AgentRunResult> {
    const logs: LogEntry[] = [];
    const output: AgentOutput[] = [];

    // Handle failAfterStart scenario - simulates agent failure mid-execution
    if (this.failAfterStart && this.dexMock) {
      const readyTasks = this.dexMock.listReady();
      if (readyTasks.length > 0) {
        const task = readyTasks[0]!;
        this.dexMock.start(task.id);
      }

      // Emit configured logs (which should include error logs)
      for (const { category, message } of this.mockLogs) {
        const entry = createLogEntry(category, message);
        logs.push(entry);
        options.events?.onLog?.(entry);
      }

      // Emit configured output
      for (const text of this.mockOutput) {
        const out = createAgentOutput(text);
        output.push(out);
        options.events?.onOutput?.(out);
      }

      // Return failure - do NOT call dexMock.complete()
      return {
        exitCode: 1,
        logs,
        output,
      };
    }

    // If dexMock is provided and completeTask is true, start the first ready task
    let taskToComplete: string | undefined;
    if (this.dexMock && this.completeTask) {
      const readyTasks = this.dexMock.listReady();
      if (readyTasks.length > 0) {
        const task = readyTasks[0]!;
        this.dexMock.start(task.id);
        taskToComplete = task.id;
      }
    }

    // Simulate delay if configured
    if (this.mockDelay > 0) {
      await Bun.sleep(this.mockDelay);
    }

    // Emit configured logs
    for (const { category, message } of this.mockLogs) {
      const entry = createLogEntry(category, message);
      logs.push(entry);
      options.events?.onLog?.(entry);
    }

    // Emit configured output
    for (const text of this.mockOutput) {
      const out = createAgentOutput(text);
      output.push(out);
      options.events?.onOutput?.(out);
    }

    // If exitCode is 0 and we started a task, complete it
    if (this.dexMock && this.completeTask && taskToComplete && this.mockExitCode === 0) {
      this.dexMock.complete(taskToComplete, "Task completed by MockAgent");
    }

    return {
      exitCode: this.mockExitCode,
      logs,
      output,
    };
  }

  /**
   * Configure the mock agent's behavior.
   */
  configure(config: MockAgentConfig): void {
    if (config.available !== undefined) this.available = config.available;
    if (config.logs !== undefined) this.mockLogs = config.logs;
    if (config.output !== undefined) this.mockOutput = config.output;
    if (config.exitCode !== undefined) this.mockExitCode = config.exitCode;
    if (config.delay !== undefined) this.mockDelay = config.delay;
    if (config.dexMock !== undefined) {
      this.dexMock = config.dexMock;
      // Update completeTask default when dexMock is set
      if (config.completeTask === undefined) {
        this.completeTask = true;
      }
    }
    if (config.completeTask !== undefined) this.completeTask = config.completeTask;
    if (config.failAfterStart !== undefined) this.failAfterStart = config.failAfterStart;
  }
}

/**
 * Create the default agent (OpenCodeAgent).
 */
export function createAgent(): Agent {
  return new OpenCodeAgent();
}

/**
 * Create a mock agent for testing.
 */
export function createMockAgent(config?: MockAgentConfig): MockAgent {
  return new MockAgent(config);
}
