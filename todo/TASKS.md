# Project Tasks

Task tracker for multi-agent development.
Each agent picks the next pending task, implements it, and marks it complete.

## How to Use

1. Find the first task with `status: pending` where ALL dependencies have `status: complete`
2. Change that task's status to `in_progress`
3. Implement the task
4. Write and run tests
5. Change the task's status to `complete`
6. Append learnings to LEARNINGS.md
7. Commit with message: `feat: <task-id> - <description>`
8. EXIT

## Task Statuses

- `pending` - Not started
- `in_progress` - Currently being worked on
- `complete` - Done and committed

---

## Phase 1: Core Infrastructure

### add-paths-module

- content: Create `src/paths.ts` module that exports functions for all math directory paths: `getMathDir()` returns `.math`, `getTodoDir()` returns `.math/todo`, `getBackupsDir()` returns `.math/backups`. Use `join(process.cwd(), ...)` pattern. This centralizes all path logic for the migration.
- status: complete
- dependencies: none

### add-migration-util

- content: Create `src/migration.ts` with a `migrateIfNeeded()` function that checks if legacy `todo/` directory exists (containing PROMPT.md, TASKS.md, LEARNINGS.md), prompts user to migrate to `.math/todo`, and moves files if confirmed. Use readline for interactive prompt. Export this utility for use in commands.
- status: complete
- dependencies: add-paths-module

---

## Phase 2: Update Commands

### update-init-command

- content: Update `src/commands/init.ts` to create `.math/todo/` directory structure instead of `todo/`. Update all path references to use the new paths module. Update console output messages to reference `.math/todo/` paths.
- status: pending
- dependencies: add-paths-module

### update-run-command

- content: Update `src/loop.ts` to use paths module for todoDir. Add call to `migrateIfNeeded()` at start of `runLoop()`. Update file paths passed to agent from `todo/PROMPT.md` to `.math/todo/PROMPT.md`.
- status: pending
- dependencies: add-paths-module, add-migration-util

### update-plan-command

- content: Update `src/commands/plan.ts` and `src/plan.ts` to use paths module. Add migration check to plan command. Update console messages to reference `.math/todo/` paths.
- status: pending
- dependencies: add-paths-module, add-migration-util

### update-status-command

- content: Update `src/commands/status.ts` to use paths module for reading tasks. No migration needed here as it just reads existing files.
- status: pending
- dependencies: add-paths-module

### update-tasks-module

- content: Update `src/tasks.ts` default directory from `todo` to `.math/todo` in `readTasks()` and `writeTasks()` functions.
- status: pending
- dependencies: add-paths-module

---

## Phase 3: Iterate Command & Backup System

### add-summary-generator

- content: Create `src/summary.ts` with a `generatePlanSummary(tasksContent: string): string` function that extracts task IDs from TASKS.md and generates a short kebab-case summary (max 5 words, e.g., `auth-flow-setup`). Use task IDs or phase names as basis for summary.
- status: pending
- dependencies: none

### update-iterate-command

- content: Refactor `src/commands/iterate.ts` to: 1) Use paths module for directories, 2) Create backups in `.math/backups/<summary>/` using generatePlanSummary(), 3) Add migration check at start, 4) Update console messages to reference new paths.
- status: pending
- dependencies: add-paths-module, add-migration-util, add-summary-generator

---

## Phase 4: Prune Command

### update-prune-module

- content: Update `src/prune.ts` to find artifacts only within `.math/backups/` directory instead of cwd. Update `BACKUP_DIR_PATTERN` or remove it since we now look in a specific directory. Update `findArtifacts()` to scan `.math/backups/` subdirectories.
- status: pending
- dependencies: add-paths-module

### update-prune-command

- content: Update `src/commands/prune.ts` to use the updated prune module. Verify it only targets `.math/backups/` contents.
- status: pending
- dependencies: update-prune-module

---

## Phase 5: Templates & Documentation

### update-templates

- content: Update `src/templates.ts` PROMPT_TEMPLATE to reference `.math/todo/TASKS.md` and `.math/todo/LEARNINGS.md` in instructions. Update the Quick Reference section paths. Update TASKS_TEMPLATE references similarly.
- status: pending
- dependencies: none

### update-cli-help

- content: Update `index.ts` help text and command descriptions to reference `.math/` directory structure instead of `todo/`.
- status: pending
- dependencies: none

---

## Phase 6: Testing & Validation

### add-paths-tests

- content: Add tests for `src/paths.ts` in `src/paths.test.ts` verifying correct path construction for getMathDir, getTodoDir, getBackupsDir.
- status: pending
- dependencies: add-paths-module

### add-migration-tests

- content: Add tests for `src/migration.ts` in `src/migration.test.ts` covering: legacy directory detection, migration prompt, file moving, no-op when already migrated.
- status: pending
- dependencies: add-migration-util

### add-summary-tests

- content: Add tests for `src/summary.ts` in `src/summary.test.ts` verifying summary generation from various TASKS.md contents.
- status: pending
- dependencies: add-summary-generator

### update-existing-tests

- content: Update existing tests in `src/loop.test.ts`, `src/prune.test.ts`, and other test files to use `.math/` paths. Fix any broken tests due to path changes.
- status: pending
- dependencies: update-run-command, update-prune-module

### validate-full-workflow

- content: Manual validation: Run `math init`, `math plan`, `math run`, `math iterate`, `math status`, `math prune` to verify full workflow with new `.math/` directory structure. Fix any issues discovered.
- status: pending
- dependencies: update-existing-tests
