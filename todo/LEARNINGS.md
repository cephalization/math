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
