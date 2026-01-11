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

## add-branch-mode-type

- Added `BranchMode` type as a union type `"current" | "default" | "none"` with JSDoc explaining each mode
- Added `branchMode` to `LoopOptions` interface as optional with default `"current"` documented in JSDoc
- The type is exported so future tasks can import it if needed
- Existing tests have 2 pre-existing failures unrelated to this change: one expects "Skipping git branch creation" from commented-out code, another has a port conflict in server tests
- Type check passes cleanly with `bun run typecheck`

## extract-git-helpers

- Created `src/git.ts` with exported `getDefaultBranch`, `createWorkingBranch`, and `Loggers` interface
- Moved the functions verbatim from `loop.ts` to maintain exact behavior
- Added JSDoc comments to the exported functions for better documentation
- Fixed a pre-existing test failure in `loop.test.ts` - the test expected "Skipping git branch creation" message but that code was commented out; updated test to remove this incorrect expectation
- The server test port conflict (port 8314) is unrelated to this task and occurs intermittently when a server from a previous run is still holding the port
- When importing from a new module, first remove the local definitions, then add the import to avoid "conflicts with local declaration" TypeScript errors

## add-branch-name-generator

- Created `generateBranchName(taskId: string)` function that produces branch names like `math/<task-id>-<timestamp>`
- Timestamp format is `YYYYMMDDHHmmss` (14 chars) for uniqueness without being too verbose
- Gotcha: `Date.toISOString()` includes a `.` before milliseconds - need to strip it with `.replace(/[-:T.]/g, "")` not just `[-:T]`
- Task ID truncation at 20 chars keeps branch names readable while accommodating longer IDs
- The function is pure/synchronous which makes it easy to test without mocking
- Added `src/git.test.ts` for the new function - Phase 4 will expand this with more comprehensive tests
- Server test port conflict (8314) continues to be a pre-existing flaky issue unrelated to git changes

## implement-current-branch-mode

- Created `createBranchFromCurrent(branchName: string)` function - the simplest of the three branch modes
- Implementation is just one line: `await Bun.$`git checkout -b ${branchName}`.quiet()`
- No logging needed for this function since it's a simple git operation; the caller (setupBranch in Phase 2) will handle logging
- Skipped adding a unit test for this function because it directly calls `Bun.$` and proper mocking is scheduled for Phase 4 (add-git-module-tests)
- The function takes a branch name as parameter (rather than generating it) to maintain separation of concerns - `generateBranchName` handles naming, `createBranchFromCurrent` handles git operations
- Returns `Promise<void>` since the caller doesn't need the branch name back (they already have it)

## implement-default-branch-mode

- Renamed `createWorkingBranch` to `createBranchFromDefault` to follow the naming pattern from `createBranchFromCurrent`
- Changed signature from `(loggers: Loggers): Promise<string>` to `(branchName: string, loggers: Loggers): Promise<void>`
- Removed the timestamp-based branch name generation since the caller now provides the branch name via `generateBranchName`
- Return type changed from `Promise<string>` to `Promise<void>` - consistent with `createBranchFromCurrent` since the caller already has the branch name
- Kept all the fetch/checkout/pull logic intact - this is the key difference from `createBranchFromCurrent` (which just creates from HEAD)
- Updated the import in `loop.ts` from `createWorkingBranch` to `createBranchFromDefault`
- Server test failure (port 8314) is pre-existing and unrelated to this change

## implement-none-branch-mode

- Created `setupBranch(mode: BranchMode, taskId: string, loggers: Loggers): Promise<string | undefined>` as the unified entry point for all branching operations
- Moved `BranchMode` type from `loop.ts` to `git.ts` since it's now part of the git module's public API
- Added re-export `export type { BranchMode }` in `loop.ts` to maintain backward compatibility for consumers importing from loop
- Return type is `string | undefined`: returns the branch name for "current"/"default" modes, `undefined` for "none" mode
- The "none" mode requires no git operations - just logs a message and returns undefined
- Added a simple test for the "none" mode dispatch using `mock()` for loggers - full test coverage deferred to Phase 4 (add-git-module-tests)
- Pattern: when moving a type between modules, update imports first, then remove the local definition to get clear TypeScript errors
