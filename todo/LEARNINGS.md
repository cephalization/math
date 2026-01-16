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

## add-paths-module

- Created simple pure functions using `join(process.cwd(), ...)` pattern - no state, no side effects
- Followed existing codebase pattern of using `node:path` for path joining
- Tests verify both the exact paths and the path hierarchy (todo/backups are children of math dir)
- There's a separate `add-paths-tests` task in Phase 6 - I wrote minimal tests here to validate the implementation works, that task can add more comprehensive tests if needed
- The module is intentionally minimal - just exports 3 functions with no dependencies on other modules to avoid circular imports when other modules adopt it

## add-migration-util

- Used same readline pattern as `askToRunPlanning()` in `plan.ts` for interactive prompts
- Exported helper functions `hasLegacyTodoDir()` and `hasNewTodoDir()` for testability and reuse
- `migrateIfNeeded()` is idempotent - safe to call multiple times (returns true if already migrated or nothing to migrate)
- Used `rename()` from `node:fs/promises` to move directory atomically instead of copy+delete
- Tests use `process.chdir()` to test in an isolated temp directory - this avoids polluting the actual project directory
- Kept tests simple: testing the detection functions directly, and just verifying the happy paths for `migrateIfNeeded()` (skipping interactive prompt tests since they require stdin mocking)

## update-init-command

- Replaced `join(process.cwd(), "todo")` with `getTodoDir()` from paths module - keeps path logic centralized
- Only imported `getTodoDir` since `getMathDir` wasn't needed (mkdir with recursive: true creates parent dirs)
- Kept `join` import for constructing file paths within todoDir (e.g., `join(todoDir, "PROMPT.md")`)
- Updated all console messages from `todo/` to `.math/todo/` for consistency
- Added tests that verify the command creates files in the correct location and respects existing directories
- Pre-existing test failures in `ui/app.test.ts` are unrelated - those tests use relative paths that don't resolve correctly

## update-run-command

- Replaced `join(process.cwd(), "todo")` with `getTodoDir()` from paths module
- Removed unused `join` import from `node:path` since path construction now uses template literals with todoDir
- Added `migrateIfNeeded()` call early in `runLoop()` - placed after UI server setup but before checking for required files
- Migration check throws error if user declines - prevents running with legacy paths in an inconsistent state
- Updated agent file paths from `["todo/PROMPT.md", "todo/TASKS.md"]` to `[".math/todo/PROMPT.md", ".math/todo/TASKS.md"]`
- **Critical test fix**: Tests were creating `todo/` directories (legacy path) which caused `migrateIfNeeded()` to prompt interactively and hang. Updated all test `beforeEach` blocks to create `.math/todo/` structure instead
- Path construction pattern: used template literals (`${todoDir}/PROMPT.md`) instead of `join()` for simplicity since todoDir is already absolute

## update-plan-command

- Updated `src/commands/plan.ts` to use `getTodoDir()` from paths module instead of `join(process.cwd(), "todo")`
- Added `migrateIfNeeded()` call at the start of the plan command - important to check before validating directory exists
- Updated error message from `"todo/ directory not found"` to `".math/todo/ directory not found"` for consistency
- In `src/plan.ts`, `todoDir` is passed as a parameter, so no paths module import was needed there - just updated console messages
- Updated two console message locations in `plan.ts`: success message (line 229) and warning message (line 236)
- Removed unused `join` import from `node:path` since we no longer construct the todoDir path locally
- No plan-specific tests exist (`src/**/*plan*.test.ts`), so relied on typecheck and existing test suite to verify changes

## update-status-command

- Simple change: imported `getTodoDir` from paths module and passed it to `readTasks()`
- The `readTasks()` function already accepts an optional `todoDir` parameter with a default of `join(process.cwd(), "todo")` - we just needed to pass the new path
- No migration check needed in this command since it only reads files - migration is handled by commands that modify state (init, plan, run)
- No status-specific tests exist, so relied on typecheck and running full test suite to verify no regressions

## update-tasks-module

- Updated `readTasks()` and `writeTasks()` default directory from `join(process.cwd(), "todo")` to `getTodoDir()` (which returns `.math/todo`)
- Added import for `getTodoDir` from `./paths` module
- Both functions already had optional `todoDir` parameter - this change only affects the default when no parameter is passed
- No tasks-specific tests exist in `src/tasks.test.ts` - tests are in the later `add-paths-tests` task
- Existing tests (loop.test.ts, commands/init.test.ts) pass because they already create `.math/todo/` structure from previous migrations
- Pre-existing test failures in `ui/app.test.ts` are unrelated - those tests expect a missing `src/ui/app.tsx` file

## add-summary-generator

- Created `src/summary.ts` with `generatePlanSummary()` function that extracts a kebab-case summary from TASKS.md content
- Strategy prioritizes phase names (e.g., "## Phase 1: Core Infrastructure" -> "core-infrastructure") over task IDs for better readability
- Falls back to first task ID if no phase names found, then to "plan" as ultimate fallback
- Used regex patterns similar to `tasks.ts` for consistency: `^###\s+(.+)$` for task IDs, `^##\s+Phase\s+\d+:\s*(.+)$` for phases
- `toKebabCase()` helper removes special characters, converts spaces to hyphens, and collapses multiple hyphens
- Max 5 words limit enforced by splitting on hyphens and taking first 5 elements
- Tests cover: phase name extraction, truncation, task ID fallback, special characters, empty content, multiple phases
- Pre-existing test failures in `ui/app.test.ts` are unrelated to this task

## update-iterate-command

- Refactored to use `getTodoDir()` and `getBackupsDir()` from paths module instead of `join(process.cwd(), ...)`
- Replaced date-based backup naming (`todo-{M}-{D}-{Y}`) with summary-based naming using `generatePlanSummary()` - creates more meaningful backup names like `core-infrastructure/` instead of `todo-1-16-2026/`
- Backups now go to `.math/backups/<summary>/` instead of project root - keeps project root clean
- Added `migrateIfNeeded()` call at start - ensures legacy `todo/` users are prompted to migrate before the command runs
- Added `mkdir(backupsDir, { recursive: true })` to ensure `.math/backups/` exists before copying
- Updated all console messages to reference `.math/todo/` and `.math/backups/` paths
- Imported `mkdir` from `node:fs/promises` for async directory creation
- Counter-based naming still works for duplicate summaries (e.g., `core-infrastructure`, `core-infrastructure-1`, `core-infrastructure-2`)
