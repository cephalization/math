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
