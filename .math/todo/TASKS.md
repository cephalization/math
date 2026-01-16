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

## Phase 1: README Updates

### update-readme-paths

- content: Update all `todo/` path references in README.md to `.math/todo/`. Update `math init` description to say it creates `.math/todo/` directory. Update the `math iterate` section to mention `.math/backups/<summary>/` instead of `todo-{M}-{D}-{Y}/`. Add brief explanation that summaries are AI-generated short descriptions of the sprint.
- status: complete
- dependencies: none

### add-directory-structure-table

- content: Add a brief table to README.md documenting the `.math/` directory structure. Include `.math/todo/` (active sprint files) and `.math/backups/` (archived sprints). Keep it to 2-3 rows with one-sentence descriptions each.
- status: complete
- dependencies: update-readme-paths

### update-loop-diagram

- content: Update the ASCII loop diagram in README.md if it references any old paths. Verify the diagram accurately reflects the current flow.
- status: complete
- dependencies: update-readme-paths

## Phase 2: Help Output Verification

### verify-cli-help

- content: Run `bun ./index.ts --help` and verify all command descriptions reference `.math/` paths correctly. The help output should already be updated based on recent commits, but verify and fix any remaining `todo/` references in help strings in index.ts.
- status: complete
- dependencies: none

### verify-subcommand-help

- content: Check each subcommand for help text or descriptions that may reference old paths. Review index.ts for any command descriptions that need updating.
- status: pending
- dependencies: verify-cli-help

## Phase 3: Final Review

### final-documentation-review

- content: Do a final grep for any remaining `todo/` references in README.md and index.ts that should be `.math/todo/`. Ensure consistency across all documentation. Skip code files - only documentation and help text.
- status: pending
- dependencies: add-directory-structure-table, update-loop-diagram, verify-subcommand-help
