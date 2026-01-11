/**
 * Web server for the UI that streams loop logs and agent output.
 * Uses Bun.serve() with HTTP routes and WebSocket support.
 */

import type { ServerWebSocket } from "bun";
import type { OutputBuffer } from "./buffer";

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
}

/**
 * Start the UI web server.
 * Returns the server instance for later shutdown if needed.
 */
export function startServer(options: ServerOptions) {
  const { port = DEFAULT_PORT, buffer } = options;

  const server = Bun.serve<WebSocketData>({
    port,

    routes: {
      "/": new Response(
        "<html><body><h1>Math Agent UI</h1><p>Placeholder - React app coming soon</p></body></html>",
        {
          headers: { "Content-Type": "text/html" },
        }
      ),
    },

    fetch(req, server) {
      const url = new URL(req.url);

      // Handle WebSocket upgrade at /ws
      if (url.pathname === "/ws") {
        const id = crypto.randomUUID();
        const success = server.upgrade(req, {
          data: { id },
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
        // Placeholder: will send history and subscribe to updates in websocket-streaming task
        ws.send(JSON.stringify({ type: "connected", id: ws.data.id }));
      },

      message(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
        // Placeholder: no client-to-server messages needed yet
      },

      close(ws: ServerWebSocket<WebSocketData>) {
        // Placeholder: will unsubscribe from buffer updates in websocket-streaming task
      },
    },
  });

  return server;
}
