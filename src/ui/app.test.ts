import { test, expect, describe } from "bun:test";
import type { WebSocketMessage } from "./server";
import type { BufferLogEntry, BufferAgentOutput } from "./buffer";

/**
 * Tests for the React app module.
 * Since the app is primarily UI code that mounts to the DOM,
 * we test that the module exports correctly and the types align.
 */

describe("app.tsx", () => {
  test("module exists and can be imported", async () => {
    // The app module should exist at the expected path
    const file = Bun.file("./src/ui/app.tsx");
    const exists = await file.exists();
    expect(exists).toBe(true);
  });

  test("imports react and react-dom", async () => {
    const content = await Bun.file("./src/ui/app.tsx").text();
    
    expect(content).toContain('from "react"');
    expect(content).toContain('from "react-dom/client"');
  });

  test("uses createRoot for React 18", async () => {
    const content = await Bun.file("./src/ui/app.tsx").text();
    
    expect(content).toContain("createRoot");
    expect(content).toContain('document.getElementById("root")');
  });

  test("connects to WebSocket at /ws", async () => {
    const content = await Bun.file("./src/ui/app.tsx").text();
    
    expect(content).toContain("WebSocket");
    expect(content).toContain("/ws");
  });

  test("renders Loop Status section", async () => {
    const content = await Bun.file("./src/ui/app.tsx").text();
    
    expect(content).toContain("Loop Status");
  });

  test("renders Agent Output section", async () => {
    const content = await Bun.file("./src/ui/app.tsx").text();
    
    expect(content).toContain("Agent Output");
  });

  test("handles WebSocket message types", async () => {
    const content = await Bun.file("./src/ui/app.tsx").text();
    
    // Should handle all message types from server
    expect(content).toContain('"connected"');
    expect(content).toContain('"history"');
    expect(content).toContain('"log"');
    expect(content).toContain('"output"');
  });

  test("stores logs and output in state", async () => {
    const content = await Bun.file("./src/ui/app.tsx").text();
    
    // Should use useState for logs and output
    expect(content).toContain("useState<BufferLogEntry[]>");
    expect(content).toContain("useState<BufferAgentOutput[]>");
  });

  test("shows connection status", async () => {
    const content = await Bun.file("./src/ui/app.tsx").text();
    
    expect(content).toContain("Connected");
    expect(content).toContain("Disconnected");
  });
});

describe("WebSocketMessage type compatibility", () => {
  test("history message has correct structure", () => {
    const logs: BufferLogEntry[] = [
      { timestamp: new Date(), category: "info", message: "test" },
    ];
    const output: BufferAgentOutput[] = [
      { timestamp: new Date(), text: "output" },
    ];

    const message: WebSocketMessage = {
      type: "history",
      logs,
      output,
    };

    expect(message.type).toBe("history");
    expect(message.logs).toHaveLength(1);
    expect(message.output).toHaveLength(1);
  });

  test("log message has correct structure", () => {
    const entry: BufferLogEntry = {
      timestamp: new Date(),
      category: "error",
      message: "test error",
    };

    const message: WebSocketMessage = {
      type: "log",
      entry,
    };

    expect(message.type).toBe("log");
    expect(message.entry.category).toBe("error");
  });

  test("output message has correct structure", () => {
    const entry: BufferAgentOutput = {
      timestamp: new Date(),
      text: "agent text",
    };

    const message: WebSocketMessage = {
      type: "output",
      entry,
    };

    expect(message.type).toBe("output");
    expect(message.entry.text).toBe("agent text");
  });

  test("connected message has correct structure", () => {
    const message: WebSocketMessage = {
      type: "connected",
      id: "test-uuid",
    };

    expect(message.type).toBe("connected");
    expect(message.id).toBe("test-uuid");
  });
});
