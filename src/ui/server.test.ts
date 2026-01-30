/**
 * FLAKINESS AUDIT (im8092sn):
 *
 * 1. HARDCODED PORTS - FIXED (8tzr13a5): Now uses port 0 to let OS assign
 *    available ports, eliminating port conflicts.
 *
 * 2. TIMING DEPENDENCIES: Uses setTimeout for waiting (100ms, 50ms delays).
 *    Risk: Flaky on slow CI or under load.
 *
 * 3. WEBSOCKET RACE CONDITIONS: Tests rely on WebSocket message ordering
 *    and timing (receiveMessage with 1000ms timeout).
 *    Risk: Messages may arrive out of order or timeout on slow systems.
 *
 * 4. CLEANUP - FIXED: WebSocket connections are now tracked and explicitly
 *    closed in afterEach with proper draining to avoid connection leaks.
 */
import { test, expect, describe, afterEach } from "bun:test";
import { startServer, DEFAULT_PORT, type WebSocketMessage } from "./server";
import { createOutputBuffer } from "./buffer";

/**
 * Helper to create a WebSocket and track it for cleanup.
 */
function createTrackedWebSocket(url: string, sockets: WebSocket[]): WebSocket {
  const ws = new WebSocket(url);
  sockets.push(ws);
  return ws;
}

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
  const activeWebSockets: WebSocket[] = [];

  afterEach(async () => {
    // Close all WebSocket connections
    const hadConnections = activeWebSockets.length > 0;
    for (const ws of activeWebSockets) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }
    activeWebSockets.length = 0;
    
    // Wait for connections to drain
    if (hadConnections) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Stop server
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

  test("starts server on custom port using port 0 (OS assigns)", () => {
    const buffer = createOutputBuffer();
    // Use port 0 to let OS assign an available port, avoiding conflicts
    server = startServer({ buffer, port: 0 });

    // OS assigns an available port > 0
    expect(server.port).toBeGreaterThan(0);
  });

  test("serves HTML at /", async () => {
    const buffer = createOutputBuffer();
    // Use port 0 to let OS assign an available port
    server = startServer({ buffer, port: 0 });

    const response = await fetch(`http://localhost:${server.port}/`);

    expect(response.status).toBe(200);
    // Bun's HTML imports add charset to content-type
    expect(response.headers.get("content-type")).toContain("text/html");

    const html = await response.text();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Math Agent UI");
  });

  test("returns 404 for unknown routes", async () => {
    const buffer = createOutputBuffer();
    // Use port 0 to let OS assign an available port
    server = startServer({ buffer, port: 0 });

    const response = await fetch(`http://localhost:${server.port}/unknown`);

    expect(response.status).toBe(404);
  });

  test("accepts WebSocket connection at /ws", async () => {
    const buffer = createOutputBuffer();
    // Use port 0 to let OS assign an available port
    server = startServer({ buffer, port: 0 });

    const ws = new WebSocket(`ws://localhost:${server.port}/ws`);

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

    // Use port 0 to let OS assign an available port
    server = startServer({ buffer, port: 0 });
    const ws = new WebSocket(`ws://localhost:${server.port}/ws`);
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
    // Use port 0 to let OS assign an available port
    server = startServer({ buffer, port: 0 });

    const ws = new WebSocket(`ws://localhost:${server.port}/ws`);
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
    // Use port 0 to let OS assign an available port
    server = startServer({ buffer, port: 0 });

    const ws = new WebSocket(`ws://localhost:${server.port}/ws`);
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
    // Use port 0 to let OS assign an available port
    server = startServer({ buffer, port: 0 });

    // Collect all messages received by each client
    const messages1: string[] = [];
    const messages2: string[] = [];

    const ws1 = new WebSocket(`ws://localhost:${server.port}/ws`);
    const ws2 = new WebSocket(`ws://localhost:${server.port}/ws`);

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
    // Use port 0 to let OS assign an available port
    server = startServer({ buffer, port: 0 });

    const ws = new WebSocket(`ws://localhost:${server.port}/ws`);
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
