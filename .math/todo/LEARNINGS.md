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

## im8092sn

- Flakiness patterns identified in 6 of 13 test files:
  - **server.test.ts**: Hardcoded ports, timing dependencies (setTimeout), WebSocket race conditions
  - **loop.test.ts**: Global mock functions, process.cwd() changes, dynamic imports
  - **init.test.ts**: Hardcoded test directory, Bun.$ mocking, process.cwd() changes
  - **prune.test.ts**: Hardcoded test directory, process.cwd() changes
  - **migration.test.ts**: Hardcoded test directory, process.cwd() changes
  - **migrate-to-dex.test.ts**: process.cwd() changes (but uses mkdtemp - good isolation)
- Fixed a real flakiness issue: port 9999 was conflicting with external services. Changed to 18999.
- Pattern that worked: Tests using `mkdtemp()` (unique temp dirs) are more reliable than hardcoded test directories
- Gotcha: Port 9999 is commonly used by dev tools (found Shelley Agent using it). Use high ports (18000+) for test servers.
- All test files properly clean up in afterEach, but hardcoded test directories risk collisions if cleanup fails

## 6vdwgptz

- Created `src/testing/dex-mock.ts` with DexMock class for testing dex-dependent code
- Key design decision: Use `isTaskBlocked()` helper to check if blocking tasks are completed, not just if blockedBy array is non-empty
- Gotcha: Initial implementation checked `blockedBy.length === 0` which doesn't account for blocking tasks being completed - the mock needs to track actual completion state
- Pattern: Using an internal `InternalTask` interface that extends DexTask with an `inProgress` boolean keeps the state management clean
- The mock computes `isBlocked` dynamically by checking if any task in `blockedBy` is incomplete - this matches real dex behavior
- Call tracking with `getCalls()` enables assertions on method invocation order and arguments in tests

## 8tzr13a5

- Fixed port conflicts in server.test.ts by using `port: 0` which lets the OS assign available ports
- Key pattern: When testing network servers, use `port: 0` and read the actual port from `server.port` to avoid hardcoded port conflicts
- The fix replaces hardcoded ports (8314-8322) with dynamic port assignment via the OS
- One test kept `startServer({ buffer })` without port to verify DEFAULT_PORT behavior; all other tests use `port: 0`
- Gotcha: The "custom port" test now validates that OS assigns a port > 0, rather than checking a specific hardcoded port
- Verified fix by running tests 5 times in a row - all passed consistently

## yvtc19jp

- Enhanced MockAgent with optional DexMock integration for simulating task completion in tests
- Key pattern: Use `type` imports for classes only used as types to avoid circular dependency issues (`import type { DexMock }`)
- Smart default pattern: `completeTask` defaults to `true` when `dexMock` is provided, avoiding boilerplate in most test cases
- The `configure()` method also updates `completeTask` default when `dexMock` is set after construction
- When creating test task fixtures, ensure all required DexTask fields are included (parent_id, priority, metadata, blocks) to avoid TypeScript errors

## hplcftmx

- Added `failAfterStart` option to MockAgent for simulating mid-execution failures
- Key design: `failAfterStart` takes priority over other paths - if true with dexMock, it immediately starts the task, emits logs, and returns with exitCode: 1
- The option is deliberately separate from `exitCode` because it simulates a specific failure mode: task starts but agent crashes before completing
- Pattern: Early return from run() when simulating failure keeps the code path simple and explicit
- This enables testing loop recovery scenarios where a task gets stuck in in_progress state

## 4q8h8wsv

- Refactored loop.test.ts to use DexMock instead of `mock.module('./dex', ...)`
- Key change: Added `DexClient` interface to `dex.ts` enabling dependency injection via `LoopOptions.dexClient`
- Design decision: Made DexMock methods async (returning Promises) to match the DexClient interface which wraps CLI calls
- Gotcha: This required updating all code that uses DexMock (agent.ts, agent.test.ts, dex-mock.test.ts) to await the methods
- Temp directories still needed for PROMPT.md and .dex directory checks - filesystem injection would be over-engineering
- Pattern: `const dex = options.dexClient ?? defaultDexClient` provides clean default behavior while enabling testing
- The `defaultDexClient` object wraps the existing standalone functions for backward compatibility
- Tests now pass consistently (verified 5 runs) without relying on global mock state

## 3d588ps4

- Created integration test validating end-to-end flow: DexMock with 3 dependent tasks -> MockAgent completes them -> loop exits successfully
- Critical gotcha: `pauseSeconds: 0` doesn't work because of falsy check in loop.ts (`options.pauseSeconds || 3`). Use `pauseSeconds: 0.001` instead.
- This is an existing bug in loop.ts but fixing it was out of scope for this task (YAGNI principle)
- Pattern: Use `dexMock.getCalls()` to verify the exact sequence of start/complete calls and their order
- The test verifies: 3 tasks completed in dependency order (task-1 -> task-2 -> task-3), correct call sequence, no max iterations exceeded
- Test runs in ~56ms (well under the 1 second requirement)

## 9p2tu55l

- Added short flag `-m` as alias for `--model` in the parseArgs function
- Design pattern: Created `SHORT_FLAGS` mapping object to make adding new short flags trivial (just add to the map)
- Key change: Modified the "next value" check from `!next.startsWith("--")` to `!next.startsWith("-")` so that short flags are also recognized as flags, not values
- The parser handles short flags that are exactly 2 characters (dash + single letter) - this is intentional to avoid ambiguity
- Unknown short flags pass through using their short key (e.g., `-x value` becomes `{ x: "value" }`)
- Added dedicated unit tests for parseArgs in `src/parse-args.test.ts` since index.ts had no tests
- Pre-existing test failures in prune.test.ts are unrelated (macOS path canonicalization: `/var` vs `/private/var`)

## dvfozgy9

- Created src/model.ts with model validation utilities for the provider/model-name format
- Key design: Return type union `{ valid: true, model } | { valid: false, error }` provides TypeScript-friendly narrowing with `if (!result.valid)` checks
- Used `as const` for SUPPORTED_PROVIDERS array to enable type-safe provider checking: `(typeof SUPPORTED_PROVIDERS)[number]` derives the union type
- parseModelProvider returns null for invalid input (simple to check), validateModel returns structured error with helpful message
- Edge cases to handle: empty string, missing slash, provider-only with trailing slash, unsupported providers
- Pattern: Use indexOf + slice instead of split for parsing - handles multiple slashes correctly (e.g., "openai/gpt-4/turbo" keeps "gpt-4/turbo" as modelName)

## 9686t3iv

- Integrated model validation into CLI commands by adding a `validateModelOrExit()` helper function
- Key pattern: Centralized validation function handles type narrowing and exit logic - returns `string | undefined` for clean integration with command options
- Applied validation to all 4 commands that accept --model: run, plan, init, iterate
- For `run` command which passes raw options, validation is called separately before `run(options)` since the options object is passed through directly
- Updated help text to show model format requirement, supported providers, and default value - all pulled from existing constants/types
- Gotcha: TypeScript type narrowing requires checking `typeof model !== "string"` rather than `model === undefined || model === true` to handle all boolean cases
- Pre-existing test failures in prune.test.ts are unrelated to this task (macOS symlink path canonicalization issue)

## wjxkvy1t

- Created src/config.ts with Zod schema for iteration configuration
- Zod v4 imports use `import { z } from "zod/v4"` syntax (not just `"zod"`)
- Key pattern: Use `safeParse()` for load operations to handle invalid data gracefully (return null), use `parse()` for save operations to throw on invalid config
- Used synchronous `fs.readFileSync` instead of async Bun.file().text() for simpler return type (no Promise needed)
- `Bun.file(path).size` returns 0 for non-existent files - good way to check file existence before reading
- Tests use `mkdtemp()` for isolated temp directories per test - follows established pattern from LEARNINGS.md
- Pre-existing prune.test.ts failures remain (macOS `/var` vs `/private/var` path issue)
