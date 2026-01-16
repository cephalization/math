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

## update-prune-module

- Simplified `findArtifacts()` by removing the `directory` parameter - it now always scans `.math/backups/` using `getBackupsDir()` from paths module
- Removed `BACKUP_DIR_PATTERN` regex entirely since we no longer need to distinguish backup directories by name pattern - anything in `.math/backups/` is an artifact
- This is a breaking change for the test file which still passes directory parameter - `update-existing-tests` task will fix those tests
- The change makes the module simpler: no pattern matching needed, just list all subdirectories of `.math/backups/`
- Verified the implementation works manually by creating test directories in `.math/backups/` and running `findArtifacts()`
- The prune command (`src/commands/prune.ts`) already calls `findArtifacts()` without arguments, so no changes needed there

## update-prune-command

- Verified that `src/commands/prune.ts` already correctly uses the updated prune module - no code changes were needed
- The command imports `findArtifacts`, `confirmPrune`, `deleteArtifacts` from `../prune` and calls them correctly
- Since `findArtifacts()` now internally uses `getBackupsDir()`, the command automatically targets only `.math/backups/` contents
- The test file `src/prune.test.ts` has failing tests because it still passes a directory argument to `findArtifacts()` - this is expected and will be fixed in the `update-existing-tests` task
- Pattern: when a module's API changes (like removing a parameter), the consuming code may not need updates if it was already using the simpler form of the API

## update-templates

- Added "Directory Structure" section to PROMPT_TEMPLATE Quick Reference documenting `.math/todo/` and `.math/backups/<summary>/` paths
- Relative references to TASKS.md and LEARNINGS.md within the template don't need path prefixes - the template is placed in `.math/todo/` so relative references work correctly
- No template-specific tests exist in the codebase, and this is a documentation-only change, so no new tests were required
- Pre-existing test failures in `src/prune.test.ts` are from `update-prune-module` task changing the `findArtifacts()` function signature - will be fixed in `update-existing-tests` task

## update-cli-help

- Updated `index.ts` help text to reference `.math/` directory structure consistently across all commands
- Changed command descriptions: `init` creates `.math/todo/`, `iterate` backs up `.math/todo/`, `prune` deletes from `.math/backups/`
- Updated example comment from `todo/` to `.math/todo/`
- This is a documentation-only change with no behavioral impact - no new tests required
- Pre-existing test failures in `src/prune.test.ts` are unrelated and will be addressed by `update-existing-tests` task

## add-paths-tests

- Tests already existed in `src/paths.test.ts` - likely created during `add-paths-module` implementation
- The existing tests comprehensively cover: individual function outputs, absolute path verification, and path hierarchy (child relationships)
- All 5 tests pass with 8 expect() calls total - good coverage for a simple module
- Pattern: when verifying path modules, test both exact values AND structural properties (is absolute, has correct parent-child relationships)
- Task was effectively a verification task - confirmed existing tests are sufficient and passing

## add-migration-tests

- Expanded existing `src/migration.test.ts` from 7 to 14 tests covering the four areas specified in the task
- Testing interactive readline prompts is complex in bun:test - workaround was to test the file-moving behavior by directly calling fs operations (simulating what `performMigration` does internally)
- Added tests for: legacy directory with multiple files detection, non-matching files in legacy directory, file content preservation after migration, and new directory detection independence from file contents
- Pattern: when you can't mock internal functions easily, test the behavior at the integration boundary by replicating what the internal function does and verifying pre/post conditions
- Pre-existing test failures in `src/prune.test.ts` are unrelated - caused by `findArtifacts()` signature change in `update-prune-module` task, will be fixed in `update-existing-tests` task

## add-summary-tests

- Tests already existed in `src/summary.test.ts` with comprehensive coverage (8 tests, 8 expect() calls) - likely created during `add-summary-generator` implementation
- Existing tests cover all key scenarios: phase name extraction, max 5 words truncation, task ID fallback, special characters handling, ultimate "plan" fallback, empty content, multiple phases (first one used), and numbers in phase names
- All tests pass - no additional tests needed as the coverage is already comprehensive
- Pattern: when implementing a module (like `add-summary-generator`), it's valuable to write tests alongside the implementation rather than deferring to a separate test task - this leads to better coverage and faster feedback loops
- Pre-existing test failures in `src/prune.test.ts` are unrelated - will be fixed in `update-existing-tests` task
