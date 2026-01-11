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

## Phase 1: Core Branching Infrastructure

### add-branch-mode-type

- content: Create a TypeScript type `BranchMode` with values `"current" | "default" | "none"` in `src/loop.ts`. Add `branchMode` to `LoopOptions` interface with default `"current"`. This establishes the configuration shape without changing behavior.
- status: complete
- dependencies: none

### extract-git-helpers

- content: Extract git-related functions (`getDefaultBranch`, `createWorkingBranch`) into a new `src/git.ts` module. Export them for use by `loop.ts` and for testing. Keep the existing logic intact - just move it.
- status: complete
- dependencies: add-branch-mode-type

### add-branch-name-generator

- content: Create a `generateBranchName(taskId: string): string` function in `src/git.ts`. It should produce a branch name like `math/<truncated-task-id>` where task ID is truncated to ~20 chars max. Include timestamp suffix if needed for uniqueness.
- status: complete
- dependencies: extract-git-helpers

---

## Phase 2: Implement Branch Modes

### implement-current-branch-mode

- content: Implement the `"current"` branch mode in `src/git.ts`. Create a new function `createBranchFromCurrent(branchName: string)` that creates a branch off the current HEAD without switching branches first. This is the simplest mode - just `git checkout -b <name>`.
- status: complete
- dependencies: add-branch-name-generator

### implement-default-branch-mode

- content: Implement the `"default"` branch mode. Update `createWorkingBranch` to accept a `branchName` parameter and use it instead of generating timestamp-based names. Keep the fetch/checkout default branch logic. Rename to `createBranchFromDefault(branchName: string, loggers: Loggers)`.
- status: complete
- dependencies: implement-current-branch-mode

### implement-none-branch-mode

- content: The `"none"` mode requires no new git functions - it just skips branching. This task is to create a unified `setupBranch(mode: BranchMode, taskId: string, loggers: Loggers): Promise<string | undefined>` function in `src/git.ts` that dispatches to the correct implementation based on mode.
- status: pending
- dependencies: implement-default-branch-mode

---

## Phase 3: Integration

### integrate-branching-in-loop

- content: Wire up `setupBranch` in `runLoop`. Uncomment and replace the old branching code. Get the first task ID from `readTasks` to pass to the branch name generator. Handle errors gracefully (log warning but continue if branching fails).
- status: pending
- dependencies: implement-none-branch-mode

### add-cli-branch-flag

- content: Add `--branch <mode>` CLI flag to `index.ts` and pass it through `run.ts` to `runLoop`. Valid values: `current`, `default`, `none`. Default to `current` if not specified.
- status: pending
- dependencies: integrate-branching-in-loop

### update-help-text

- content: Update the help text in `index.ts` to document the new `--branch` flag with examples for each mode.
- status: pending
- dependencies: add-cli-branch-flag

---

## Phase 4: Testing

### add-git-module-tests

- content: Create `src/git.test.ts` with tests for the git helper functions. Use spies/mocks for `Bun.$` to verify correct git commands are called WITHOUT actually running git. Test `generateBranchName` truncation logic, `setupBranch` dispatch for each mode.
- status: pending
- dependencies: update-help-text

### update-loop-tests-for-branching

- content: Update `src/loop.test.ts` to verify branching integration. Tests should mock the git module to avoid real git operations. Verify that `branchMode` option is respected and that the loop continues even if branching fails.
- status: pending
- dependencies: add-git-module-tests

### verify-test-isolation

- content: Run `bun test` and verify no tests modify the actual repo's git state. Check that tests use temp directories or mocks. If any test touches real git, fix it. Add a CI-safety comment in test files explaining the isolation approach.
- status: pending
- dependencies: update-loop-tests-for-branching
