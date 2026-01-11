/**
 * React app for the Math Agent UI.
 * Connects to WebSocket server and displays loop logs and agent output.
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import type { BufferLogEntry, BufferAgentOutput } from "./buffer";
import type { WebSocketMessage } from "./server";
import type { LogCategory } from "../agent";

/**
 * Connection state for the WebSocket.
 */
type ConnectionState = "connecting" | "connected" | "disconnected";

/**
 * Reconnection interval in milliseconds.
 */
const RECONNECT_INTERVAL = 3000;

/**
 * Color mapping for log categories matching terminal colors.
 */
const categoryColors: Record<LogCategory, string> = {
  info: "#60a5fa",    // blue
  success: "#4ade80", // green
  warning: "#facc15", // yellow
  error: "#f87171",   // red
};

/**
 * Main App component that displays loop status and agent output.
 */
function App() {
  const [logs, setLogs] = useState<BufferLogEntry[]>([]);
  const [output, setOutput] = useState<BufferAgentOutput[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const outputContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when logs change
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Auto-scroll to bottom when output changes
  useEffect(() => {
    if (outputContainerRef.current) {
      outputContainerRef.current.scrollTop = outputContainerRef.current.scrollHeight;
    }
  }, [output]);

  /**
   * Create a WebSocket connection and set up event handlers.
   */
  const connect = useCallback(() => {
    // Clear any existing reconnect timer
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
    }

    setConnectionState("connecting");

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionState("connected");
    };

    ws.onclose = () => {
      setConnectionState("disconnected");
      // Schedule reconnection attempt
      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, RECONNECT_INTERVAL);
    };

    ws.onerror = () => {
      // onclose will be called after onerror, so we don't need to handle reconnection here
    };

    ws.onmessage = (event) => {
      const message: WebSocketMessage = JSON.parse(event.data);

      switch (message.type) {
        case "connected":
          // Connection confirmed
          break;
        case "history":
          // Full history received - replace existing state
          setLogs(message.logs);
          setOutput(message.output);
          break;
        case "log":
          // New log entry
          setLogs((prev) => [...prev, message.entry]);
          break;
        case "output":
          // New agent output
          setOutput((prev) => [...prev, message.entry]);
          break;
      }
    };
  }, []);

  useEffect(() => {
    connect();

    return () => {
      // Clean up on unmount
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  /**
   * Get the color for a log category.
   */
  const getCategoryColor = (category: LogCategory): string => {
    return categoryColors[category] || "#e0e0e0";
  };

  /**
   * Get the status display properties based on connection state.
   */
  const getStatusDisplay = () => {
    switch (connectionState) {
      case "connecting":
        return { color: "#facc15", text: "Connecting..." }; // yellow
      case "connected":
        return { color: "#4ade80", text: "Connected" }; // green
      case "disconnected":
        return { color: "#f87171", text: "Disconnected" }; // red
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div style={styles.container}>
      {/* Disconnected banner */}
      {connectionState === "disconnected" && (
        <div style={styles.disconnectedBanner}>
          Connection lost. Reconnecting...
        </div>
      )}

      <header style={styles.header}>
        <h1 style={styles.title}>Math Agent UI</h1>
        <div style={styles.statusContainer}>
          <span
            style={{
              ...styles.statusDot,
              backgroundColor: statusDisplay.color,
            }}
          />
          <span style={{ ...styles.statusText, color: statusDisplay.color }}>
            {statusDisplay.text}
          </span>
        </div>
      </header>

      <div style={styles.content}>
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Loop Status</h2>
          <div ref={logContainerRef} style={styles.logContainer}>
            {logs.length === 0 ? (
              <p style={styles.empty}>No logs yet</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} style={styles.logEntry}>
                  <span style={{ ...styles.timestamp, color: getCategoryColor(log.category) }}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span style={{ ...styles.category, color: getCategoryColor(log.category) }}>
                    [{log.category}]
                  </span>
                  <span style={styles.message}>{log.message}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Agent Output</h2>
          <div ref={outputContainerRef} style={styles.outputContainer}>
            {output.length === 0 ? (
              <p style={styles.empty}>No output yet</p>
            ) : (
              output.map((out, index) => (
                <pre key={index} style={styles.outputEntry}>
                  {out.text}
                </pre>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * Inline styles for the app components.
 */
const styles: Record<string, React.CSSProperties> = {
  container: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    padding: "16px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
    paddingBottom: "16px",
    borderBottom: "1px solid #333",
  },
  title: {
    fontSize: "24px",
    fontWeight: "bold",
    margin: 0,
  },
  statusContainer: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  statusDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
  },
  statusText: {
    fontSize: "14px",
  },
  disconnectedBanner: {
    backgroundColor: "#7f1d1d",
    color: "#fecaca",
    padding: "12px 16px",
    marginBottom: "16px",
    borderRadius: "8px",
    textAlign: "center",
    fontWeight: "500",
  },
  content: {
    display: "flex",
    flex: 1,
    gap: "16px",
    overflow: "hidden",
  },
  section: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#252525",
    borderRadius: "8px",
    padding: "16px",
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: "600",
    marginBottom: "12px",
    color: "#a0a0a0",
  },
  logContainer: {
    flex: 1,
    overflow: "auto",
    fontFamily: "monospace",
    fontSize: "13px",
  },
  outputContainer: {
    flex: 1,
    overflow: "auto",
    fontFamily: "monospace",
    fontSize: "13px",
  },
  logEntry: {
    marginBottom: "4px",
    lineHeight: "1.4",
  },
  timestamp: {
    marginRight: "8px",
  },
  category: {
    marginRight: "8px",
    fontWeight: "bold",
  },
  message: {
    color: "#e0e0e0",
  },
  outputEntry: {
    margin: 0,
    padding: "4px 0",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: "#e0e0e0",
  },
  empty: {
    color: "#666",
    fontStyle: "italic",
  },
};

// Mount the React app
const root = createRoot(document.getElementById("root")!);
root.render(<App />);
