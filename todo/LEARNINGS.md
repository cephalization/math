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

## add-branch-mode-type

- Added `BranchMode` type as a union type `"current" | "default" | "none"` with JSDoc explaining each mode
- Added `branchMode` to `LoopOptions` interface as optional with default `"current"` documented in JSDoc
- The type is exported so future tasks can import it if needed
- Existing tests have 2 pre-existing failures unrelated to this change: one expects "Skipping git branch creation" from commented-out code, another has a port conflict in server tests
- Type check passes cleanly with `bun run typecheck`
