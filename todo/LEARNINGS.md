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
