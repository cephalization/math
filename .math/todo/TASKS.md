# Project Tasks

Task tracker for dex integration into math.
Replace markdown-based task management with dex CLI.

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

## Phase 1: Core Dex Integration

### add-dex-module

- content: Create `src/dex.ts` module that wraps dex CLI commands. Implement functions: `isDexAvailable()` to check if dex is installed, `getDexDir()` to find .dex directory (git root or pwd), `dexStatus()` to get task counts via `dex status --json`, `dexListReady()` to get ready tasks via `dex list --ready --json`, `dexShow(id)` to get task details via `dex show <id> --json`, `dexStart(id)` to mark task in-progress, and `dexComplete(id, result)` to complete with result. All functions should parse JSON output and return typed interfaces.
- status: complete
- dependencies: none

### update-loop-for-dex

- content: Modify `src/loop.ts` to use dex instead of TASKS.md parsing. Replace `readTasks()` calls with `dexStatus()` and `dexListReady()`. Update the agent invocation to include task context from `dexShow()` instead of reading TASKS.md. Remove the `readTasks`, `countTasks`, `updateTaskStatus`, `writeTasks` imports since dex manages task state. Keep the web UI buffer and logging infrastructure intact.
- status: complete
- dependencies: add-dex-module

### update-status-command

- content: Rewrite `src/commands/status.ts` to use dex. Call `dexStatus()` for counts and display using existing progress bar format. Call `dexListReady()` to show next available task. Remove dependency on `src/tasks.ts` functions.
- status: complete
- dependencies: add-dex-module

## Phase 2: Migration Support

### add-tasks-to-dex-migration

- content: Create `src/migrate-tasks.ts` module with functions to convert TASKS.md tasks to dex format. Implement `parseTasksForMigration(content: string)` that reuses parsing logic from `src/tasks.ts` to extract tasks with full metadata (id, content, status, dependencies). Implement `importTaskToDex(task: Task)` that runs `dex add "<content>" --id <id>` for each task. For dependencies, use `dex block <id> --by <dep-id>` for each dependency. For status, map `complete` to `dex complete <id>`, `in_progress` to `dex start <id>`. Return a report of imported tasks with any errors.
- status: complete
- dependencies: add-dex-module

### add-dex-migration-prompt

- content: Create `src/migrate-to-dex.ts` module that handles the TASKS.md to dex migration flow. Implement `checkNeedsDexMigration()` that returns true if `.math/todo/TASKS.md` exists AND `.dex/` does not exist (or is empty). Implement `promptDexMigration()` that displays an interactive menu with three options: (1) "Port existing tasks to dex" - imports all TASKS.md tasks preserving metadata, (2) "Archive and start fresh" - moves `.math/todo/` to `.math/backups/<timestamp>-pre-dex/` and initializes clean dex, (3) "Exit" - prints message explaining dex is required and suggests downgrading to version 0.4.0 from package.json. Use `createInterface` from `node:readline/promises` for the prompt. Return an enum indicating the user's choice.
- status: complete
- dependencies: add-tasks-to-dex-migration

### add-dex-migration-execution

- content: In `src/migrate-to-dex.ts`, implement `executeDexMigration(choice)` that performs the chosen migration action. For "port": call `dex init -y`, read TASKS.md via `parseTasks()`, import each task via `importTaskToDex()`, delete TASKS.md on success. For "archive": create timestamped backup dir, move entire `.math/todo/` there, run `dex init -y`, create fresh PROMPT.md and LEARNINGS.md. For "exit": print clear message with downgrade instructions (`bun remove @cephalization/math && bun add @cephalization/math@0.4.0`) and call `process.exit(0)`. Export a single `migrateTasksToDexIfNeeded()` function that orchestrates check -> prompt -> execute.
- status: complete
- dependencies: add-dex-migration-prompt

### integrate-dex-migration-check

- content: Modify `index.ts` to call `migrateTasksToDexIfNeeded()` before executing any command except `help`. Import the function from `src/migrate-to-dex.ts`. Place the check in `main()` after parsing args but before the switch statement. If migration returns "exit" choice, the function already calls `process.exit(0)`. For "port" or "archive", continue to the requested command. This ensures any existing TASKS.md users are prompted on first run of any math command.
- status: complete
- dependencies: add-dex-migration-execution

### add-dex-migration-tests

- content: Create `src/migrate-to-dex.test.ts` with unit tests. Test `checkNeedsDexMigration()` returns true when TASKS.md exists and .dex/ doesn't. Test `parseTasksForMigration()` correctly parses tasks with all metadata (pending, in_progress, complete statuses and dependencies). Test `importTaskToDex()` generates correct dex commands for different task states. Mock `Bun.$` shell calls and file system operations. Test the archive flow creates proper backup directory structure.
- status: complete
- dependencies: add-dex-migration-execution

## Phase 3: Init and Setup

### update-init-for-dex

- content: Modify `src/commands/init.ts` to initialize dex instead of creating TASKS.md. Find git root (or use pwd if no .git). If `.dex/` already exists, reuse it and skip dex init. Otherwise run `dex init -y` to create dex config. Still create `.math/todo/` with PROMPT.md and LEARNINGS.md only (no TASKS.md). Update success messages to reference dex commands.
- status: complete
- dependencies: add-dex-module

### update-iterate-for-dex

- content: Modify `src/commands/iterate.ts` for dex workflow. Backup should archive completed dex tasks using `dex archive` for top-level completed tasks. Reset LEARNINGS.md as before. Since dex manages tasks persistently, "iterate" becomes about archiving completed work and resetting learnings rather than wiping TASKS.md.
- status: complete
- dependencies: update-init-for-dex

## Phase 4: Agent Prompt Updates

### update-prompt-template

- content: Rewrite `PROMPT_TEMPLATE` in `src/templates.ts` to instruct agents on dex usage. The new prompt should explain: run `dex list --ready` to find work, run `dex start <id>` before starting, run `dex show <id>` for full context, run `dex complete <id> --result "..."` when done. Keep the existing signs (One Task Only, Learnings Required, Commit Format, Don't Over-Engineer). Remove TASKS.md references. Keep LEARNINGS.md workflow.
- status: complete
- dependencies: none

### update-existing-prompt-md

- content: Update the current `.math/todo/PROMPT.md` file with dex instructions matching the new template. This is the live file agents will read during this integration work.
- status: pending
- dependencies: update-prompt-template

## Phase 5: Cleanup and Tests

### remove-tasks-module

- content: Delete `src/tasks.ts` since dex replaces all its functionality. Update any remaining imports that reference it. The Task interface and parsing logic are no longer needed. Note: Keep the parsing logic accessible in `src/migrate-tasks.ts` for migration purposes, or copy the necessary functions there before deletion.
- status: pending
- dependencies: update-loop-for-dex, update-status-command, add-dex-migration-tests

### add-dex-tests

- content: Create `src/dex.test.ts` with unit tests for the dex module. Mock the Bun.$ shell calls to test JSON parsing and error handling. Test `isDexAvailable()`, `dexStatus()`, `dexListReady()`, `dexShow()`, `dexStart()`, and `dexComplete()` with sample JSON responses.
- status: pending
- dependencies: add-dex-module

### update-loop-tests

- content: Update `src/loop.test.ts` to work with the new dex-based loop. Mock the dex module functions instead of TASKS.md file operations. Ensure existing test patterns for agent invocation and error handling still work.
- status: pending
- dependencies: update-loop-for-dex, add-dex-tests

### update-init-tests

- content: Update `src/commands/init.test.ts` for dex initialization. Test that `dex init -y` is called when no `.dex/` exists. Test that existing `.dex/` is reused. Test that PROMPT.md and LEARNINGS.md are still created but TASKS.md is not.
- status: pending
- dependencies: update-init-for-dex, add-dex-tests

## Phase 6: Documentation

### update-help-text

- content: Update `index.ts` help text to reflect dex integration. Mention that math uses dex for task management. Update example commands if needed. Ensure --help output is accurate for the new workflow.
- status: pending
- dependencies: update-init-for-dex, update-status-command
