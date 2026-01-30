/**
 * FLAKINESS AUDIT (im8092sn):
 *
 * 1. HARDCODED PORTS (8314-8322): Each test uses a different hardcoded port.
 *    If tests run in parallel or ports are already in use, tests will fail.
 *    Risk: Port conflicts with other processes or parallel test runs.
 *
 * 2. TIMING DEPENDENCIES: Uses setTimeout for waiting (100ms, 50ms delays).
 *    - Line 214, 220: `await new Promise((resolve) => setTimeout(resolve, 100))`
 *    - Line 256: `await new Promise((resolve) => setTimeout(resolve, 50))`
 *    Risk: Flaky on slow CI or under load.
 *
 * 3. WEBSOCKET RACE CONDITIONS: Tests rely on WebSocket message ordering
 *    and timing (receiveMessage with 1000ms timeout).
 *    Risk: Messages may arrive out of order or timeout on slow systems.
 *
 * 4. CLEANUP: afterEach properly stops servers, but WebSocket connections
 *    may not be fully closed before next test starts.
 */
import { test, expect, describe, afterEach } from "bun:test";
import { startServer, DEFAULT_PORT, type WebSocketMessage } from "./server";
import { createOutputBuffer } from "./buffer";

/**
 * Helper to receive a WebSocket message with timeout.
 */
function receiveMessage(ws: WebSocket, timeoutMs = 1000): Promise<string> {
  return new Promise((resolve, reject) => {
    const handler = (event: MessageEvent) => {
      ws.removeEventListener("message", handler);
      resolve(event.data as string);
    };
    ws.addEventListener("message", handler);
    setTimeout(() => {
      ws.removeEventListener("message", handler);
      reject(new Error("timeout"));
    }, timeoutMs);
  });
}

/**
 * Helper to wait for WebSocket connection to open.
 */
function waitForOpen(ws: WebSocket, timeoutMs = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    ws.onopen = () => resolve(true);
    ws.onerror = () => resolve(false);
    setTimeout(() => resolve(false), timeoutMs);
  });
}

describe("startServer", () => {
  let server: ReturnType<typeof startServer> | null = null;

  afterEach(() => {
    if (server) {
      server.stop();
      server = null;
    }
  });

  test("starts server on default port 8314", () => {
    const buffer = createOutputBuffer();
    server = startServer({ buffer });

    expect(server.port).toBe(DEFAULT_PORT);
    expect(server.port).toBe(8314);
  });

  test("starts server on custom port", () => {
    const buffer = createOutputBuffer();
    // Use a less common port to avoid conflicts (9999 is often used by other services)
    server = startServer({ buffer, port: 18999 });

    expect(server.port).toBe(18999);
  });

  test("serves HTML at /", async () => {
    const buffer = createOutputBuffer();
    server = startServer({ buffer, port: 8315 });

    const response = await fetch("http://localhost:8315/");

    expect(response.status).toBe(200);
    // Bun's HTML imports add charset to content-type
    expect(response.headers.get("content-type")).toContain("text/html");

    const html = await response.text();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Math Agent UI");
  });

  test("returns 404 for unknown routes", async () => {
    const buffer = createOutputBuffer();
    server = startServer({ buffer, port: 8316 });

    const response = await fetch("http://localhost:8316/unknown");

    expect(response.status).toBe(404);
  });

  test("accepts WebSocket connection at /ws", async () => {
    const buffer = createOutputBuffer();
    server = startServer({ buffer, port: 8317 });

    const ws = new WebSocket("ws://localhost:8317/ws");

    const connected = await waitForOpen(ws);
    expect(connected).toBe(true);

    // Should receive a connected message
    const message = await receiveMessage(ws);
    const parsed = JSON.parse(message);
    expect(parsed.type).toBe("connected");
    expect(parsed.id).toBeDefined();

    ws.close();
  });
});

describe("WebSocket streaming", () => {
  let server: ReturnType<typeof startServer> | null = null;

  afterEach(() => {
    if (server) {
      server.stop();
      server = null;
    }
  });

  test("sends full history on connect", async () => {
    const buffer = createOutputBuffer();
    // Add some history before connecting
    buffer.appendLog("info", "test log 1");
    buffer.appendLog("error", "test log 2");
    buffer.appendOutput("agent output 1");

    server = startServer({ buffer, port: 8318 });
    const ws = new WebSocket("ws://localhost:8318/ws");
    await waitForOpen(ws);

    // First message is connected
    const connectedMsg = await receiveMessage(ws);
    expect(JSON.parse(connectedMsg).type).toBe("connected");

    // Second message is history
    const historyMsg = await receiveMessage(ws);
    const history = JSON.parse(historyMsg) as WebSocketMessage;

    expect(history.type).toBe("history");
    if (history.type === "history") {
      expect(history.logs).toHaveLength(2);
      expect(history.logs[0]!.message).toBe("test log 1");
      expect(history.logs[0]!.category).toBe("info");
      expect(history.logs[1]!.message).toBe("test log 2");
      expect(history.logs[1]!.category).toBe("error");
      expect(history.output).toHaveLength(1);
      expect(history.output[0]!.text).toBe("agent output 1");
    }

    ws.close();
  });

  test("broadcasts new log entries to connected clients", async () => {
    const buffer = createOutputBuffer();
    server = startServer({ buffer, port: 8319 });

    const ws = new WebSocket("ws://localhost:8319/ws");
    await waitForOpen(ws);

    // Drain connected and history messages
    await receiveMessage(ws); // connected
    await receiveMessage(ws); // history

    // Add a new log entry after connection
    buffer.appendLog("success", "new log entry");

    // Should receive the new log entry
    const logMsg = await receiveMessage(ws);
    const parsed = JSON.parse(logMsg) as WebSocketMessage;

    expect(parsed.type).toBe("log");
    if (parsed.type === "log") {
      expect(parsed.entry.message).toBe("new log entry");
      expect(parsed.entry.category).toBe("success");
    }

    ws.close();
  });

  test("broadcasts new agent output to connected clients", async () => {
    const buffer = createOutputBuffer();
    server = startServer({ buffer, port: 8320 });

    const ws = new WebSocket("ws://localhost:8320/ws");
    await waitForOpen(ws);

    // Drain connected and history messages
    await receiveMessage(ws); // connected
    await receiveMessage(ws); // history

    // Add new agent output after connection
    buffer.appendOutput("new agent output");

    // Should receive the new output entry
    const outputMsg = await receiveMessage(ws);
    const parsed = JSON.parse(outputMsg) as WebSocketMessage;

    expect(parsed.type).toBe("output");
    if (parsed.type === "output") {
      expect(parsed.entry.text).toBe("new agent output");
    }

    ws.close();
  });

  test("broadcasts to multiple connected clients", async () => {
    const buffer = createOutputBuffer();
    server = startServer({ buffer, port: 8321 });

    // Collect all messages received by each client
    const messages1: string[] = [];
    const messages2: string[] = [];

    const ws1 = new WebSocket("ws://localhost:8321/ws");
    const ws2 = new WebSocket("ws://localhost:8321/ws");

    ws1.onmessage = (event) => messages1.push(event.data as string);
    ws2.onmessage = (event) => messages2.push(event.data as string);

    await Promise.all([waitForOpen(ws1), waitForOpen(ws2)]);

    // Wait for initial messages (connected + history)
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Add new log
    buffer.appendLog("warning", "broadcast test");

    // Wait for broadcast to arrive
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Both clients should have received the log message
    const logMessages1 = messages1
      .map((m) => JSON.parse(m) as WebSocketMessage)
      .filter((m) => m.type === "log");
    const logMessages2 = messages2
      .map((m) => JSON.parse(m) as WebSocketMessage)
      .filter((m) => m.type === "log");

    expect(logMessages1).toHaveLength(1);
    expect(logMessages2).toHaveLength(1);
    if (logMessages1[0]?.type === "log" && logMessages2[0]?.type === "log") {
      expect(logMessages1[0].entry.message).toBe("broadcast test");
      expect(logMessages2[0].entry.message).toBe("broadcast test");
    }

    ws1.close();
    ws2.close();
  });

  test("unsubscribes from buffer on disconnect", async () => {
    const buffer = createOutputBuffer();
    server = startServer({ buffer, port: 8322 });

    const ws = new WebSocket("ws://localhost:8322/ws");
    await waitForOpen(ws);

    // Drain initial messages
    await receiveMessage(ws); // connected
    await receiveMessage(ws); // history

    // Close the connection
    ws.close();

    // Wait a bit for the close handler to run
    await new Promise((resolve) => setTimeout(resolve, 50));

    // This should not throw - the subscriber was cleaned up
    // If unsubscribe didn't work, the subscriber would try to send to a closed socket
    buffer.appendLog("info", "after disconnect");

    // Test passes if no error is thrown
    expect(true).toBe(true);
  });
});

describe("DEFAULT_PORT", () => {
  test("is 8314", () => {
    expect(DEFAULT_PORT).toBe(8314);
  });
});
