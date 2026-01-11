/**
 * Shared output buffer module for storing loop logs and agent output.
 * Provides append, get history, and subscribe functionality.
 */

import type { LogCategory } from "../agent";

/**
 * A log entry in the buffer with timestamp and category.
 */
export interface BufferLogEntry {
  timestamp: Date;
  category: LogCategory;
  message: string;
}

/**
 * An agent output entry in the buffer.
 */
export interface BufferAgentOutput {
  timestamp: Date;
  text: string;
}

/**
 * Callback for log entry subscriptions.
 */
export type LogSubscriber = (entry: BufferLogEntry) => void;

/**
 * Callback for agent output subscriptions.
 */
export type OutputSubscriber = (output: BufferAgentOutput) => void;

/**
 * Output buffer that stores loop logs and agent output separately.
 */
export class OutputBuffer {
  private logs: BufferLogEntry[] = [];
  private agentOutput: BufferAgentOutput[] = [];
  private logSubscribers: Set<LogSubscriber> = new Set();
  private outputSubscribers: Set<OutputSubscriber> = new Set();

  /**
   * Append a log entry to the buffer.
   */
  appendLog(category: LogCategory, message: string): BufferLogEntry {
    const entry: BufferLogEntry = {
      timestamp: new Date(),
      category,
      message,
    };
    this.logs.push(entry);
    
    // Notify subscribers
    for (const subscriber of this.logSubscribers) {
      subscriber(entry);
    }
    
    return entry;
  }

  /**
   * Append agent output to the buffer.
   */
  appendOutput(text: string): BufferAgentOutput {
    const output: BufferAgentOutput = {
      timestamp: new Date(),
      text,
    };
    this.agentOutput.push(output);
    
    // Notify subscribers
    for (const subscriber of this.outputSubscribers) {
      subscriber(output);
    }
    
    return output;
  }

  /**
   * Get all log entries.
   */
  getLogs(): BufferLogEntry[] {
    return [...this.logs];
  }

  /**
   * Get all agent output entries.
   */
  getOutput(): BufferAgentOutput[] {
    return [...this.agentOutput];
  }

  /**
   * Subscribe to new log entries.
   * Returns an unsubscribe function.
   */
  subscribeLogs(callback: LogSubscriber): () => void {
    this.logSubscribers.add(callback);
    return () => {
      this.logSubscribers.delete(callback);
    };
  }

  /**
   * Subscribe to new agent output.
   * Returns an unsubscribe function.
   */
  subscribeOutput(callback: OutputSubscriber): () => void {
    this.outputSubscribers.add(callback);
    return () => {
      this.outputSubscribers.delete(callback);
    };
  }

  /**
   * Clear all logs and output.
   */
  clear(): void {
    this.logs = [];
    this.agentOutput = [];
  }
}

/**
 * Create a new output buffer instance.
 */
export function createOutputBuffer(): OutputBuffer {
  return new OutputBuffer();
}
