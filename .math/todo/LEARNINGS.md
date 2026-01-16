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

## add-directory-structure-table

- Placed the directory structure table under Core Concept section as a "### Directory Structure" subsection since that's where document organization is already discussed
- Kept to exactly 2 rows as specified: `.math/todo/` and `.math/backups/<summary>/`
- Mentioned AI-generated descriptions in the backups row to connect with the earlier `math iterate` explanation
- No tests needed for documentation-only changes, but ran `bun test` anyway to ensure nothing was accidentally broken

## update-loop-diagram

- The ASCII loop diagram (lines 166-178 in README.md) does NOT reference any file paths, only file names like `TASKS.md` and `PROMPT.md`
- The diagram accurately reflects the current flow: check tasks → exit if complete → invoke agent → agent works → loop back
- No changes were needed - the diagram was already correct
- Verification-only tasks are valid - not all tasks require code changes

## verify-cli-help

- All help text in index.ts already uses the correct `.math/todo/` and `.math/backups/` paths
- Found 3 `todo/` references at lines 34, 38, and 58 - all correctly prefixed with `.math/`
- No standalone `todo/` references exist that need updating
- The help output correctly describes: `init` creates `.math/todo/`, `iterate` backs up to `.math/backups/`, and `prune` deletes from `.math/backups/`
- Verification-only tasks with no required changes are valid - document findings even when everything is already correct
