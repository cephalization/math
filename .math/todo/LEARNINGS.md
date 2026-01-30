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

## im8092sn

- Flakiness patterns identified in 6 of 13 test files:
  - **server.test.ts**: Hardcoded ports, timing dependencies (setTimeout), WebSocket race conditions
  - **loop.test.ts**: Global mock functions, process.cwd() changes, dynamic imports
  - **init.test.ts**: Hardcoded test directory, Bun.$ mocking, process.cwd() changes
  - **prune.test.ts**: Hardcoded test directory, process.cwd() changes
  - **migration.test.ts**: Hardcoded test directory, process.cwd() changes
  - **migrate-to-dex.test.ts**: process.cwd() changes (but uses mkdtemp - good isolation)
- Fixed a real flakiness issue: port 9999 was conflicting with external services. Changed to 18999.
- Pattern that worked: Tests using `mkdtemp()` (unique temp dirs) are more reliable than hardcoded test directories
- Gotcha: Port 9999 is commonly used by dev tools (found Shelley Agent using it). Use high ports (18000+) for test servers.
- All test files properly clean up in afterEach, but hardcoded test directories risk collisions if cleanup fails
