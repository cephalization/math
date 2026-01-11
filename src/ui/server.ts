/**
 * Web server for the UI that streams loop logs and agent output.
 * Uses Bun.serve() with HTTP routes and WebSocket support.
 */

import type { ServerWebSocket } from "bun";
import type { OutputBuffer, BufferLogEntry, BufferAgentOutput } from "./buffer";

// Import HTML file using Bun's HTML imports feature
// This allows Bun to automatically bundle the React app and handle HMR
import indexHtml from "./index.html";

/**
 * Options for starting the UI server.
 */
export interface ServerOptions {
  port?: number;
  buffer: OutputBuffer;
}

/**
 * Default port for the UI server.
 */
export const DEFAULT_PORT = 8314;

/**
 * Data attached to each WebSocket connection.
 */
interface WebSocketData {
  id: string;
  unsubscribeLogs: (() => void) | null;
  unsubscribeOutput: (() => void) | null;
}

/**
 * WebSocket message types for client communication.
 */
export type WebSocketMessage =
  | { type: "connected"; id: string }
  | { type: "history"; logs: BufferLogEntry[]; output: BufferAgentOutput[] }
  | { type: "log"; entry: BufferLogEntry }
  | { type: "output"; entry: BufferAgentOutput };

/**
 * Start the UI web server.
 * Returns the server instance for later shutdown if needed.
 */
export function startServer(options: ServerOptions) {
  const { port = DEFAULT_PORT, buffer } = options;

  const server = Bun.serve<WebSocketData>({
    port,

    routes: {
      // Serve the React app using Bun's HTML imports
      // Bun automatically handles bundling and HMR in development
      "/": indexHtml,
    },

    fetch(req, server) {
      const url = new URL(req.url);

      // Handle WebSocket upgrade at /ws
      if (url.pathname === "/ws") {
        const id = crypto.randomUUID();
        const success = server.upgrade(req, {
          data: { id, unsubscribeLogs: null, unsubscribeOutput: null },
        });
        if (success) {
          return undefined;
        }
        return new Response("WebSocket upgrade failed", { status: 400 });
      }

      // 404 for unmatched routes
      return new Response("Not Found", { status: 404 });
    },

    websocket: {
      open(ws: ServerWebSocket<WebSocketData>) {
        // Send connected message
        ws.send(JSON.stringify({ type: "connected", id: ws.data.id }));

        // Send full history
        const historyMessage: WebSocketMessage = {
          type: "history",
          logs: buffer.getLogs(),
          output: buffer.getOutput(),
        };
        ws.send(JSON.stringify(historyMessage));

        // Subscribe to new log entries and broadcast to this client
        ws.data.unsubscribeLogs = buffer.subscribeLogs((entry) => {
          const message: WebSocketMessage = { type: "log", entry };
          ws.send(JSON.stringify(message));
        });

        // Subscribe to new agent output and broadcast to this client
        ws.data.unsubscribeOutput = buffer.subscribeOutput((entry) => {
          const message: WebSocketMessage = { type: "output", entry };
          ws.send(JSON.stringify(message));
        });
      },

      message(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
        // No client-to-server messages needed yet
      },

      close(ws: ServerWebSocket<WebSocketData>) {
        // Unsubscribe from buffer updates
        if (ws.data.unsubscribeLogs) {
          ws.data.unsubscribeLogs();
          ws.data.unsubscribeLogs = null;
        }
        if (ws.data.unsubscribeOutput) {
          ws.data.unsubscribeOutput();
          ws.data.unsubscribeOutput = null;
        }
      },
    },
  });

  return server;
}
