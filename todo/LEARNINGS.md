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

## update-package-name

- The `bin` field in package.json already had the correct structure: `{ "math": "./index.ts" }` - the key becomes the binary name, the value is the entry point
- The shebang `#!/usr/bin/env bun` was already present at line 1 of index.ts
- Changing package name to scoped `@cephalization/math` only requires updating the `name` field - the `bin` field key stays as `math` to keep the CLI command name
- Pre-existing test failure in `src/loop.test.ts` for "Skipping git branch creation" message - unrelated to package configuration changes
