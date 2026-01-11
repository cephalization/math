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
