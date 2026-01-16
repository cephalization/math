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

## update-readme-paths

- README.md had exactly 2 locations with `todo/` references that needed updating: the `math init` section (line 73) and the `math iterate` section (line 133)
- The old date-based format `todo-{M}-{D}-{Y}/` has been replaced with AI-generated summary names in `.math/backups/<summary>/`
- Added a brief explanation of what `<summary>` means (AI-generated short description) with examples like `add-user-auth`, `fix-api-bugs`
- Use `grep` to verify all path references are updated after making changes
