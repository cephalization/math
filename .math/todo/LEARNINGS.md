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
