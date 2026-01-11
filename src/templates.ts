export const PROMPT_TEMPLATE = `# Agent Task Prompt

You are a coding agent implementing tasks one at a time.

## Your Mission

Implement ONE task from TASKS.md, test it, commit it, log your learnings, then EXIT.

## The Loop

1. **Read TASKS.md** - Find the first task with \`status: pending\` where ALL dependencies have \`status: complete\`
2. **Mark in_progress** - Update the task's status to \`in_progress\` in TASKS.md
3. **Implement** - Write the code following the project's patterns
4. **Test** - Run tests to verify your changes work
5. **Mark complete** - Update the task's status to \`complete\` in TASKS.md
6. **Log learnings** - Append insights to LEARNINGS.md
7. **Commit** - Stage and commit: \`git add -A && git commit -m "feat: <task-id> - <description>"\`
8. **EXIT** - Stop. The loop will reinvoke you for the next task.

---

## Signs

READ THESE CAREFULLY. They are guardrails that prevent common mistakes.

---

### SIGN: One Task Only

- You implement **EXACTLY ONE** task per invocation
- After your commit, you **STOP**
- Do NOT continue to the next task
- Do NOT "while you're here" other improvements
- The loop will reinvoke you for the next task

---

### SIGN: Dependencies Matter

Before starting a task, verify ALL its dependencies have \`status: complete\`.

\`\`\`
❌ WRONG: Start task with pending dependencies
✅ RIGHT: Check deps, proceed only if all complete
✅ RIGHT: If deps not complete, EXIT with clear error message
\`\`\`

Do NOT skip ahead. Do NOT work on tasks out of order.

---

### SIGN: Learnings are Required

Before exiting, append to \`LEARNINGS.md\`:

\`\`\`markdown
## <task-id>

- Key insight or decision made
- Gotcha or pitfall discovered
- Pattern that worked well
- Anything the next agent should know
\`\`\`

Be specific. Be helpful. Future agents will thank you.

---

### SIGN: Commit Format

One commit per task. Format:

\`\`\`
feat: <task-id> - <short description>
\`\`\`

Only commit AFTER tests pass.

---

### SIGN: Don't Over-Engineer

- Implement what the task specifies, nothing more
- Don't add features "while you're here"
- Don't refactor unrelated code
- Don't add abstractions for "future flexibility"
- YAGNI: You Ain't Gonna Need It

---

## Quick Reference

| Action | Command |
|--------|---------|
| Run tests | \`bun test\` |
| Stage all | \`git add -A\` |
| Commit | \`git commit -m "feat: ..."\` |

---

## Remember

You do one thing. You do it well. You learn. You exit.
`;

export const TASKS_TEMPLATE = `# Project Tasks

Task tracker for multi-agent development.
Each agent picks the next pending task, implements it, and marks it complete.

## How to Use

1. Find the first task with \`status: pending\` where ALL dependencies have \`status: complete\`
2. Change that task's status to \`in_progress\`
3. Implement the task
4. Write and run tests
5. Change the task's status to \`complete\`
6. Append learnings to LEARNINGS.md
7. Commit with message: \`feat: <task-id> - <description>\`
8. EXIT

## Task Statuses

- \`pending\` - Not started
- \`in_progress\` - Currently being worked on
- \`complete\` - Done and committed

---

## Phase 1: Setup

### example-task

- content: Replace this with your first task description
- status: pending
- dependencies: none

### another-task

- content: This task depends on example-task
- status: pending
- dependencies: example-task
`;

export const LEARNINGS_TEMPLATE = `# Project Learnings Log

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
`;
