import { test, expect, describe, afterEach } from "bun:test";
import { startServer, DEFAULT_PORT } from "./server";
import { createOutputBuffer } from "./buffer";

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
    server = startServer({ buffer, port: 9999 });

    expect(server.port).toBe(9999);
  });

  test("serves HTML placeholder at /", async () => {
    const buffer = createOutputBuffer();
    server = startServer({ buffer, port: 8315 });

    const response = await fetch("http://localhost:8315/");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html");

    const html = await response.text();
    expect(html).toContain("<html>");
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

    const connected = await new Promise<boolean>((resolve) => {
      ws.onopen = () => resolve(true);
      ws.onerror = () => resolve(false);
      setTimeout(() => resolve(false), 1000);
    });

    expect(connected).toBe(true);

    // Should receive a connected message
    const message = await new Promise<string>((resolve, reject) => {
      ws.onmessage = (event) => resolve(event.data as string);
      ws.onerror = reject;
      setTimeout(() => reject(new Error("timeout")), 1000);
    });

    const parsed = JSON.parse(message);
    expect(parsed.type).toBe("connected");
    expect(parsed.id).toBeDefined();

    ws.close();
  });
});

describe("DEFAULT_PORT", () => {
  test("is 8314", () => {
    expect(DEFAULT_PORT).toBe(8314);
  });
});
