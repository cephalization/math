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
