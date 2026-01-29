# Project Tasks

Task tracker for fixing incorrect dex installation references.
Update all dex CLI install instructions to point to https://dex.rip/

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

## Phase 1: Fix Incorrect Dex References

### fix-loop-dex-reference

- content: Update `src/loop.ts` lines 173-175 to replace the incorrect dex installation instructions. Change `cargo install dex-cli` to point users to `https://dex.rip/` and remove the GitHub reference to `https://github.com/cortesi/dex` which is a different project.
- status: complete
- dependencies: none

### fix-init-dex-reference

- content: Update `src/commands/init.ts` line 33 to replace `cargo install dex-cli` with instructions pointing to `https://dex.rip/` for dex installation.
- status: complete
- dependencies: none

### fix-iterate-dex-reference

- content: Update `src/commands/iterate.ts` line 37 to replace `cargo install dex-cli` with instructions pointing to `https://dex.rip/` for dex installation.
- status: pending
- dependencies: none

## Phase 2: Verification

### verify-no-remaining-incorrect-refs

- content: Search the entire codebase for any remaining references to `cargo install dex-cli`, `cortesi/dex`, or other incorrect dex installation instructions. Ensure all dex references now point to `https://dex.rip/`. Run `bun test` to ensure no tests broke.
- status: pending
- dependencies: fix-loop-dex-reference, fix-init-dex-reference, fix-iterate-dex-reference
