# Project Tasks

Task tracker for multi-agent development.
Each agent picks the next pending task, implements it, and marks it complete.

## How to Use

1. Find the first task with `status: pending` where ALL dependencies have `status: complete`
2. Change that task's status to `in_progress`
3. Implement the task
4. Write and run tests
5. Change the task's status to `complete`
6. Append learnings to LEARNINGS.md
7. Commit with message: `feat: <task-id> - <description>`
8. EXIT

## Task Statuses

- `pending` - Not started
- `in_progress` - Currently being worked on
- `complete` - Done and committed

---

## Phase 1: Core Infrastructure

### mock-loop-interface

- content: For idempotent tests, that don't depend on LLM usage, create an "agent" interface that can be satisfied by opencode commands or a testing mock for the loop interface. It should emit log messages and agent output events like the real loop, without calling an underlying LLM.
- status: complete
- dependencies: none

### loop-dry-run

- content: Create a dry-run mode for the loop that doesn't actually call an LLM. It should emit log messages and agent output events like the real loop, but without actually calling the LLM.
- status: complete
- dependencies: mock-loop-interface

### output-buffer

- content: Create a shared output buffer module (`src/ui/buffer.ts`) that stores loop logs and agent output separately. Should export functions to append to each buffer, get full history, and subscribe to new entries. Use simple arrays and callback-based subscriptions. Include types for log entries with timestamps and categories (info, success, warning, error for loop; raw text for agent).
- status: complete
- dependencies: mock-loop-interface

### stream-capture

- content: Modify `src/loop.ts` to capture stdout/stderr from the opencode subprocess and pipe it to the output buffer instead of letting it flow to the parent terminal. Use Bun's subprocess API to capture output streams. Continue to also call the existing log functions but have them write to the buffer. The console.log calls should still work for non-UI mode.
- status: complete
- dependencies: output-buffer

---

## Phase 2: Web Server

### bun-server

- content: Create `src/ui/server.ts` that exports a function to start a Bun.serve() web server on port 8314. It should serve a single HTML page at "/" and provide a WebSocket endpoint at "/ws" for streaming updates. The server should accept the output buffer as a dependency. For now, just get the server structure in place with placeholder responses.
- status: complete
- dependencies: output-buffer

### websocket-streaming

- content: Implement WebSocket logic in `src/ui/server.ts`. When a client connects, immediately send the full history from the output buffer (both loop logs and agent output). Subscribe to buffer updates and broadcast new entries to all connected clients. Handle client disconnection gracefully by unsubscribing from buffer updates.
- status: complete
- dependencies: bun-server, stream-capture

---

## Phase 3: React Frontend

### html-shell

- content: Create `src/ui/index.html` with a basic HTML shell that loads a React app from `./app.tsx`. Include minimal inline styles for dark theme (dark background, light text). The HTML should have a div with id "root" for React to mount into.
- status: complete
- dependencies: none

### react-app-scaffold

- content: Create `src/ui/app.tsx` with a basic React app structure. Set up the WebSocket connection to "/ws", store received messages in state, and render two sections: "Loop Status" and "Agent Output". Use React 18's createRoot. Install react and react-dom as dependencies.
- status: complete
- dependencies: html-shell

### stream-display

- content: Implement the streaming text display in `src/ui/app.tsx`. Render loop logs with colored timestamps matching the terminal colors (blue for info, green for success, yellow for warning, red for error). Render agent output as preformatted monospace text. Auto-scroll to bottom when new content arrives. Show a visual indicator for connection status.
- status: complete
- dependencies: react-app-scaffold, websocket-streaming

---

## Phase 4: Integration

### serve-html

- content: Update `src/ui/server.ts` to serve the `index.html` file at the "/" route using Bun's HTML imports feature. This allows Bun to automatically bundle the React app and handle hot module replacement in development.
- status: pending
- dependencies: html-shell, bun-server

### loop-integration

- content: Update `src/loop.ts` to optionally start the web UI server before entering the main loop. Add a `ui` option to LoopOptions (default: true). When enabled, start the server and log the URL. The server should remain running after the loop completes (don't shut it down).
- status: pending
- dependencies: serve-html, websocket-streaming, stream-capture

### cli-option

- content: Update `src/commands/run.ts` and `index.ts` to support a `--no-ui` flag that disables the web UI. Update the help text to document this option. Pass the flag through to runLoop.
- status: pending
- dependencies: loop-integration

---

## Phase 5: Polish

### connection-handling

- content: Add robust connection handling to the frontend. When WebSocket disconnects, show a "Disconnected" banner and attempt to reconnect every 3 seconds. When reconnected, fetch full history again. Show "Connecting..." state on initial load.
- status: pending
- dependencies: stream-display

### final-testing

- content: Manually test the full flow: run `math run` with UI enabled, verify the web UI shows at localhost:8314, verify loop logs and agent output stream correctly in separate sections, verify multiple browser tabs show the same content, verify `--no-ui` disables the server. Fix any issues found.
- status: pending
- dependencies: cli-option, connection-handling
