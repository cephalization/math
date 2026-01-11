/**
 * React app for the Math Agent UI.
 * Connects to WebSocket server and displays loop logs and agent output.
 */

import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import type { BufferLogEntry, BufferAgentOutput } from "./buffer";
import type { WebSocketMessage } from "./server";
import type { LogCategory } from "../agent";

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
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
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

  useEffect(() => {
    // Create WebSocket connection
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = () => {
      setConnected(false);
    };

    ws.onmessage = (event) => {
      const message: WebSocketMessage = JSON.parse(event.data);

      switch (message.type) {
        case "connected":
          // Connection confirmed
          break;
        case "history":
          // Full history received
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

    return () => {
      ws.close();
    };
  }, []);

  /**
   * Get the color for a log category.
   */
  const getCategoryColor = (category: LogCategory): string => {
    return categoryColors[category] || "#e0e0e0";
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Math Agent UI</h1>
        <div style={styles.statusContainer}>
          <span
            style={{
              ...styles.statusDot,
              backgroundColor: connected ? "#4ade80" : "#f87171",
            }}
          />
          <span style={connected ? styles.statusConnected : styles.statusDisconnected}>
            {connected ? "Connected" : "Disconnected"}
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
  statusConnected: {
    color: "#4ade80",
    fontSize: "14px",
  },
  statusDisconnected: {
    color: "#f87171",
    fontSize: "14px",
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
