# Project Learnings Log

This file is appended by each agent after completing a task.
Key insights, gotchas, and patterns discovered during implementation.

Use this knowledge to avoid repeating mistakes and build on what works.

---

<!-- Agents: Append your learnings below this line -->
<!-- Format:
## <task-id>

- Key insight or decision made
- Gotcha or pitfall discovered
- Pattern that worked well
- Anything the next agent should know
-->

## mock-loop-interface

- Created `src/agent.ts` with an `Agent` interface that defines `run()` and `isAvailable()` methods
- The interface uses typed events (`onLog`, `onOutput`) for streaming updates to consumers
- `LogEntry` has categories: info, success, warning, error - matches the existing loop.ts color scheme
- `AgentOutput` is raw text with timestamps for agent stdout/stderr
- `OpenCodeAgent` wraps the real CLI using `Bun.spawn()` to capture output streams
- `MockAgent` is fully configurable: logs, output, exitCode, delay, and availability
- For tests, use `!` non-null assertions when accessing array elements after verifying length with `toHaveLength()`
- The mock can be reconfigured mid-test using `configure()` method for testing different scenarios
- Keep test mocks simple - just arrays of strings and basic config objects, no complex simulation

## loop-dry-run

- Added `dryRun` and `agent` options to `LoopOptions` interface
- When `dryRun: true`, the loop skips git branch creation and uses MockAgent instead of OpenCodeAgent
- The `agent` option allows injecting any Agent implementation for testing or custom behavior
- Replaced `process.exit(1)` calls with `throw new Error()` for better testability
- Tests need `pauseSeconds: 0` to avoid the 3-second default pause between iterations
- TASKS.md format uses `###` (h3) for task IDs, not `##` (h2) - important for test fixtures
- When testing agent invocation, need pending tasks - if all tasks complete, loop exits before calling agent
- Event callbacks (onLog, onOutput) forward agent events to the loop's console.log and stdout

## output-buffer

- Created `src/ui/buffer.ts` as a shared module for storing loop logs and agent output separately
- Reused the `LogCategory` type from `src/agent.ts` to keep categories consistent (info, success, warning, error)
- Used callback-based subscriptions with `Set<Subscriber>` for efficient add/remove operations
- Subscription functions return an unsubscribe function (closure pattern) for clean cleanup
- `getLogs()` and `getOutput()` return copies of arrays (`[...array]`) to prevent external mutation
- The `clear()` method was added for buffer reset while keeping subscriptions intact
- Tests verify that subscriptions continue working after clear() - important for reconnection scenarios
- Kept the module simple with no dependencies beyond the LogCategory type - YAGNI principle

## stream-capture

- Added `buffer?: OutputBuffer` to `LoopOptions` - optional so non-UI mode continues to work unchanged
- Used a factory function pattern `createLoggers(buffer?)` to create log functions that write to both console and buffer
- The loggers are created at the start of `runLoop` and passed to `createWorkingBranch` via a `Loggers` interface
- Agent output is captured in the `onOutput` event handler: writes to both `process.stdout` and `buffer?.appendOutput()`
- The optional chaining (`buffer?.appendLog`) ensures graceful fallback when no buffer is provided
- Console.log calls continue working for non-UI mode - the buffer is purely additive
- Tests mock both `console.log` and `process.stdout.write` to verify output goes to both destinations
- Buffer subscriptions work in real-time - subscribers receive entries as they are appended during loop execution

## bun-server

- Bun.serve() returns a server object with inferred type - no need to import `Server` type explicitly (it requires a generic argument anyway)
- For WebSocket upgrade, use `server.upgrade(req, { data })` inside fetch handler - if successful returns truthy and you return `undefined`
- `routes` object handles static routes, `fetch` function handles dynamic routes and WebSocket upgrades
- WebSocket handlers receive `ServerWebSocket<T>` where T is the data type attached during upgrade
- For tests, use different ports per test to avoid conflicts (8315, 8316, etc.) since tests may run in parallel
- `afterEach` with `server.stop()` ensures clean teardown between tests
- WebSocket tests need proper timeout handling with Promise wrappers around event callbacks
- Placeholder responses are simple - just return `new Response()` with appropriate headers/status

## websocket-streaming

- WebSocket data can hold unsubscribe functions directly - `{ id, unsubscribeLogs: (() => void) | null, unsubscribeOutput: (() => void) | null }`
- When a client connects: (1) send connected message, (2) send history, (3) subscribe to buffer updates
- History message includes both logs and output in a single `{ type: "history", logs: [], output: [] }` message
- New entries are sent as individual `{ type: "log", entry }` or `{ type: "output", entry }` messages
- On disconnect, must call the unsubscribe functions and set them to null to avoid memory leaks
- Tests for WebSocket message timing can be flaky - avoid sequential `await receiveMessage()` calls across multiple sockets
- Better pattern: collect all messages in arrays via `onmessage` handlers, then filter and assert after a small delay
- Exported `WebSocketMessage` type for type-safe parsing in tests and future frontend code
- The `BufferLogEntry` and `BufferAgentOutput` types needed to be imported from buffer.ts for the message types

## html-shell

- Bun's HTML imports allow `./app.tsx` to be referenced directly in script tags - Bun handles the transpilation automatically
- Used `<script type="module" src="./app.tsx">` to enable ESM imports in the React app
- Minimal inline styles in `<style>` block keep the HTML self-contained while avoiding external CSS dependencies
- Dark theme: `#1a1a1a` background with `#e0e0e0` text provides good contrast without being harsh
- Set `html, body, #root` to 100% height/width so React app can use full viewport
- `box-sizing: border-box` reset helps with predictable layout calculations in the React components
- This is a simple shell - the real styling will happen in the React components (stream-display task)

## react-app-scaffold

- Installed `react`, `react-dom`, `@types/react`, and `@types/react-dom` - all version 19.x for React 19 (latest)
- Used `createRoot` from `react-dom/client` per React 18+ pattern (not ReactDOM.render)
- WebSocket URL construction uses `window.location.protocol` and `window.location.host` for proper http/https handling
- State management: separate `useState` for logs, output, and connection status - simple and effective
- Message handling uses a switch statement on `message.type` - matches the `WebSocketMessage` discriminated union
- Types imported from `./buffer` and `./server` ensure frontend and backend stay in sync
- Inline styles object pattern (`const styles: Record<string, React.CSSProperties>`) provides type checking for CSS
- The `useRef` for WebSocket instance enables cleanup in the useEffect return function
- Tests for React UI code focus on file content assertions rather than DOM testing - keeps tests simple and fast
- The app renders two side-by-side sections ("Loop Status" and "Agent Output") per the task spec
- Connection status indicator is a simple text span that changes color based on `connected` state

## stream-display

- Color mapping for log categories uses a simple `Record<LogCategory, string>` object - keeps colors co-located and typed
- Terminal colors: blue (#60a5fa) for info, green (#4ade80) for success, yellow (#facc15) for warning, red (#f87171) for error
- Both timestamp and category label get the same color - helps visually group the status level
- Auto-scroll implemented with `useRef<HTMLDivElement>` for containers and `useEffect` hooks that trigger on `logs` and `output` state changes
- Pattern: `containerRef.current.scrollTop = containerRef.current.scrollHeight` after null check
- Visual connection indicator: added a status dot (10px circle) next to the text - uses green/red `backgroundColor` based on connection state
- Preformatted agent output uses `<pre>` tag with `whiteSpace: "pre-wrap"` to preserve formatting while allowing line wrapping
- Tests for UI code check file content for patterns rather than testing DOM rendering - simple and effective
- When writing regex tests for multiline code, use simpler `toContain()` assertions instead of complex regex patterns
- The `getCategoryColor` helper function provides a fallback color for unknown categories - defensive programming

## serve-html

- Bun's HTML imports allow importing HTML files directly: `import indexHtml from "./index.html"`
- The imported HTML file can be used directly in the `routes` object: `"/": indexHtml`
- Bun automatically handles bundling the React app and HMR in development mode
- When using Bun's HTML imports, the Content-Type header changes from `text/html` to `text/html;charset=utf-8`
- Tests should use `toContain("text/html")` instead of strict equality for content-type assertions
- The bundled page output message ("Bundled page in Xms: src/ui/index.html") appears in test output - this is normal
- Very minimal change required - just 2 lines: the import and the route assignment
