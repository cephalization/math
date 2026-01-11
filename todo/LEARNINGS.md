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
