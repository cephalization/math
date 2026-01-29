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

## add-dex-module

- Dex CLI provides `--json` flag for structured output on `status`, `list`, and `show` commands
- Dex `status --json` returns a `DexStatus` object with `stats` (counts) and arrays of tasks grouped by state
- Dex `list --json` returns an array of `DexTask` objects, `show --json` returns a `DexTaskDetails` object with extra fields like `ancestors`, `isBlocked`, `subtasks`
- Dex tasks have `blockedBy` and `blocks` arrays for dependencies (not just a flat list)
- Used Bun's `$` shell template tag with `.quiet()` to suppress output and check `exitCode` for error handling
- The module doesn't need tests in this task - there's a separate `add-dex-tests` task for that
- Dex stores tasks in `.dex/tasks.jsonl` at git root or pwd, found via `dex dir`

## update-loop-for-dex

- Replaced `readTasks`, `countTasks`, `updateTaskStatus`, `writeTasks` imports with dex functions: `isDexAvailable`, `dexStatus`, `dexListReady`, `dexShow`
- DexStatus.stats uses different field names than TaskCounts: `completed` vs `complete`, `inProgress` vs `in_progress`
- Added `isDexAvailable()` check early in loop to fail fast with helpful install instructions
- The agent prompt now includes next task context from `dexShow()` when available (id, name, description, blockedBy)
- Removed TASKS.md file existence check since dex manages tasks, kept PROMPT.md check
- Existing loop.test.ts tests will fail because they rely on TASKS.md file format - these tests will be updated in `update-loop-tests` task
- Non-loop tests (84 tests) continue to pass, loop tests (11 tests) are expected to fail until mocked
- The loop still references TASKS.md in the prompt and files array - this will be updated when PROMPT.md template is updated

## update-status-command

- Replaced imports from `src/tasks.ts` with imports from `src/dex.ts`: `dexStatus()` for counts, `dexListReady()` for next task
- `DexStatus.stats` uses `completed` (not `complete`), `inProgress` (not `in_progress`), and includes `pending`, `blocked`, `ready` counts
- Added guard for division by zero when `stats.total === 0` in progress bar width calculation
- `dexStatus()` includes `inProgressTasks` array directly, no need to filter separately
- `dexListReady()` returns tasks sorted by priority, so first element is the next task to work on
- The status command uses `task.name` (from DexTask) instead of `task.content` (from old Task interface)

## add-tasks-to-dex-migration

- Reused `parseTasks` from `src/tasks.ts` directly in `parseTasksForMigration` - no need to duplicate parsing logic
- `importTaskToDex` runs dex commands sequentially: add task, set dependencies, update status
- Dex block command uses `--by` flag: `dex block <task-id> --by <dependency-id>`
- For completed tasks, used `--result "Migrated from TASKS.md"` to provide context
- Added `importAllTasksToDex` helper function that returns a `MigrationReport` with success/failure counts
- Type imports require `type` keyword due to `verbatimModuleSyntax` in tsconfig

## add-dex-migration-prompt

- Used `node:readline/promises` `createInterface` for interactive prompts - cleaner async/await pattern than callback-based readline
- `checkNeedsDexMigration()` checks both TASKS.md existence AND `.dex/tasks.jsonl` emptiness/absence to determine if migration needed
- Used `getDexDir()` from dex module which returns null when dex directory doesn't exist (dex dir command fails)
- Exported `MigrationChoice` as enum with values `Port`, `Archive`, `Exit` for type-safe choice handling
- Keep colors object local to module for console output styling - pattern used across other commands
- The 11 loop.test.ts failures are expected and documented in learnings - they depend on TASKS.md workflow and will be fixed in update-loop-tests task

## add-dex-migration-execution

- `executeDexMigration()` dispatches to three helper functions based on MigrationChoice: `executePortMigration`, `executeArchiveMigration`, `executeExitWithDowngrade`
- Port migration: init dex → parse TASKS.md → import each task via `importTaskToDex()` → remove TASKS.md on success
- Archive migration: create timestamped backup with `-pre-dex` suffix → move entire `.math/todo/` → init dex → recreate `.math/todo/` with fresh PROMPT.md and LEARNINGS.md from templates
- Archive has rollback: if `dex init -y` fails after moving todo dir, it restores the backup directory
- Used `rmSync` for deleting TASKS.md and `renameSync` for moving directories (synchronous is fine for single operations)
- `migrateTasksToDexIfNeeded()` is the main orchestration function - returns `MigrationChoice | undefined` to indicate what action was taken
- Exit handler uses `process.exit(0)` after printing downgrade instructions - clean exit, not an error
- Timestamp format uses ISO format with colons/periods replaced by dashes for filesystem compatibility (e.g., `2026-01-29T14-14-58-pre-dex`)

## integrate-dex-migration-check

- Migration check is placed in `main()` after parsing args but before the switch statement, ensuring it runs early
- Help commands (`help`, `--help`, `-h`, `undefined`) are excluded from migration check to allow users to see help even before migration
- `migrateTasksToDexIfNeeded()` handles all the orchestration internally - just need to call it and let it run
- If user selects "Exit", the function calls `process.exit(0)` internally, so no return value handling needed for that case
- For "port" or "archive" choices, the function returns and execution continues to the requested command
- 11 loop.test.ts failures are pre-existing (documented in previous learnings) and will be fixed in `update-loop-tests` task

## add-dex-migration-tests

- Replaced integration tests for `importTaskToDex` with mocked unit tests to avoid dependency on dex CLI availability
- Used in-test mock modules that track executed commands rather than actually running dex commands
- Mock approach: create a mock function that records what dex commands would be called (dex add, dex block, dex complete, dex start)
- Tests verify correct command sequence: add task first, then set dependencies via block, then update status
- Added tests for error cases: failure on add, failure on block (dependency not found)
- Existing tests for `checkNeedsDexMigration()`, `parseTasksForMigration()`, and archive backup structure already had good coverage
- Pre-existing 11 loop.test.ts failures are unrelated - they're from dex integration in loop.ts and will be fixed in `update-loop-tests` task

## update-init-for-dex

- Removed `TASKS_TEMPLATE` import since dex manages tasks, only create PROMPT.md and LEARNINGS.md
- Used `isDexAvailable()` to check if dex CLI is installed before attempting initialization
- Used `getDexDir()` to check if `.dex/` already exists and reuse it (returns path or null)
- Run `dex init -y` only when dex is available AND no existing .dex directory found
- Added helpful warning message when dex CLI is not found, with install instructions
- Updated "Next steps" to show `dex add "Your first task"` instead of editing TASKS.md
- 2 init.test.ts failures are expected - they check for TASKS.md which we no longer create
- Init test updates are deferred to separate `update-init-tests` task per task dependency graph

## update-iterate-for-dex

- Added `dexArchiveCompleted()` function to `src/dex.ts` that wraps `dex archive --completed` and returns archive count
- Iterate command now archives completed dex tasks instead of backing up TASKS.md to `.math/backups/`
- LEARNINGS.md is still backed up to `.math/backups/` with a timestamped filename (e.g., `LEARNINGS-2026-01-29T14-49-27-000Z.md`)
- Removed dependency on `generatePlanSummary` and `TASKS_TEMPLATE` since we no longer use TASKS.md
- Changed backup flow: instead of copying entire `.math/todo/` to a summary-named backup dir, we archive dex tasks and backup only LEARNINGS.md
- Updated "Next steps" message to show `dex add` instead of editing TASKS.md
- Added `isDexAvailable()` check at start of iterate to fail fast with helpful error message
- The archive output parsing uses regex to extract count from "Archived N task(s)" format - returns 0 if no match
- No iterate.test.ts exists, so no test updates needed for this task

## update-prompt-template

- Rewrote `PROMPT_TEMPLATE` in `src/templates.ts` to replace TASKS.md-based workflow with dex commands
- Key changes to "The Loop" section: replaced steps about reading/updating TASKS.md with dex equivalents:
  - `dex list --ready` to find eligible tasks
  - `dex start <id>` to mark in-progress
  - `dex show <id>` for full task context
  - `dex complete <id> --result "..."` to mark complete
- Added new "Dex Commands" reference table with all key dex commands and their purposes
- Updated "Dependencies Matter" sign to reference `dex list --ready` instead of manual status checking
- Kept all four existing signs intact: One Task Only, Learnings Required, Commit Format, Don't Over-Engineer
- Updated Directory Structure to remove TASKS.md reference (now just PROMPT.md, LEARNINGS.md)
- No tests for template content itself - changes are documentation-only
- Pre-existing test failures (13 in loop.test.ts and init.test.ts) are unrelated - they're from dex integration and will be fixed in `update-loop-tests` and `update-init-tests` tasks

## update-existing-prompt-md

- Updated `.math/todo/PROMPT.md` with dex instructions matching the new `PROMPT_TEMPLATE` from `src/templates.ts`
- Key customization: kept project-specific Quick Reference commands (`bun test`, `bun run typecheck`, `bun ./index.ts <command>`) rather than using placeholders
- The template in `src/templates.ts` has generic placeholders (`<your-test-command>`, etc.) for new projects, but the live PROMPT.md should have actual commands
- Documentation-only task - no code changes, no new tests needed
- Pre-existing 13 test failures (loop.test.ts, init.test.ts) are unrelated to this task and documented in previous learnings

## add-dex-tests

- Created `src/dex.test.ts` with 22 unit tests covering the dex module
- Tests focus on type interfaces, JSON parsing, and simulated function behavior since actual dex CLI calls are difficult to mock
- Used pattern of "simulate" functions that replicate the error handling logic without actual shell calls
- Tested `DexTask`, `DexTaskDetails`, and `DexStatus` interfaces with sample JSON responses
- Archive output parsing tests verify regex extraction of "Archived N task(s)" format
- Edge case tests cover: all optional fields populated, nested children in subtasks, malformed JSON handling
- All 22 tests pass independently; pre-existing 13 failures in loop.test.ts and init.test.ts are separate tasks (`update-loop-tests`, `update-init-tests`)
- Pattern: when mocking shell commands isn't practical, test the JSON parsing and error handling logic by simulating command outcomes

## update-init-tests

- Used `mock.module("../dex", ...)` to mock `isDexAvailable()` and `getDexDir()` functions from dex module
- Created `createMockShell()` helper function that returns a mock `Bun.$` to intercept `dex init` calls
- The mock shell returns a no-op result for all commands rather than calling the real shell - avoids actual shell execution during tests
- Key tests: (1) PROMPT.md/LEARNINGS.md created but not TASKS.md, (2) dex init called when no .dex exists, (3) dex init NOT called when .dex exists, (4) dex init NOT called when dex unavailable
- Module-level variables (`mockDexAvailable`, `mockDexDirPath`, `dexInitCalled`) track mock state and are reset in `beforeEach()`
- Cast the mock shell function using `as unknown as typeof Bun.$` to satisfy TypeScript since we're not fully implementing the shell interface

## remove-tasks-module

- Deleted `src/tasks.ts` since dex now handles all task management
- Moved `Task` interface and `parseTasks()` function to `src/migrate-tasks.ts` to preserve migration functionality
- Updated imports in `src/migrate-to-dex.ts` and `src/migrate-to-dex.test.ts` to use `src/migrate-tasks.ts` instead of `src/tasks.ts`
- Added `parseTasksForMigration()` as an alias for `parseTasks()` for backwards compatibility in test files
- The 13 pre-existing test failures in `loop.test.ts` and `init.test.ts` are NOT caused by this task - they were already failing due to dex integration changes
- Those test failures will be fixed by separate pending tasks: `update-loop-tests` and `update-init-tests`
- Migration tests (19 tests) all pass after the changes, confirming the parsing logic works correctly in its new location

## update-loop-tests

- Bun's `mock.module()` is the proper way to mock ES module imports - direct property assignment fails with "readonly property" error
- Mock functions must be declared at module level and then re-assigned in `beforeEach()` to reset state between tests
- When a mock function needs arguments, use `mock((_param: Type) => ...)` syntax to satisfy TypeScript
- Created helper functions `createMockDexStatus()`, `createMockDexTask()`, `createMockDexTaskDetails()` to easily construct mock data with overrides
- Tests no longer create TASKS.md files - they mock `dexStatus()`, `dexListReady()`, and `dexShow()` instead
- Added new "runLoop dex integration" test suite with 6 tests covering: dex availability check, dex status errors, no tasks error, in_progress warning, completion success, and task details in prompt
- The `mock.module()` call affects the module immediately for ESM imports, so re-importing with `await import("./loop")` in each test ensures the mocks are used
- Pre-existing init.test.ts failures (2 tests) remain - they're for `update-init-tests` task which is next in the queue

## update-help-text

- Updated help text in `index.ts` to reflect dex integration
- Changed tagline from "Multi-Agent Todo Harness" to "Multi-Agent Task Harness" (more generic, doesn't imply TODO list)
- Updated description from "tasks from a TODO list" to "tasks managed by dex"
- Updated command descriptions: `init` now "Initialize dex", `status` now "Show current task counts from dex", `iterate` now "Archive completed tasks"
- Added new "TASK MANAGEMENT" section with common dex commands users may need: `dex list --ready`, `dex status`, `dex show <id>`, `dex add`
- Updated examples comment for iterate: "Start a new sprint (archive completed, reset learnings, plan)" instead of "backup current, reset, plan"
- Documentation-only change - no new tests needed, existing 152 tests continue to pass
