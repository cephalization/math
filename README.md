# math - Multi-Agent Todo Harness

A light meta agent orchestration harness designed to coordinate multiple AI agents working together to accomplish tasks from a TODO list.

## Core Concept

The primary responsibility of this harness is to **reduce context bloat** by digesting a project plan into three documents:

| Document | Purpose |
| ---------- | --------- |
| `TASKS.md` | Task list with status tracking and dependencies |
| `LEARNINGS.md` | Accumulated insights from completed tasks |
| `PROMPT.md` | System prompt with guardrails ("signs") |

The harness consists of a simple for-loop, executing a new coding agent with a mandate from `PROMPT.md` to complete a *single* task from `TASKS.md`, while reading and recording any insight gained during the work into `LEARNINGS.md`.

### Directory Structure

| Path | Description |
| ---- | ----------- |
| `.math/todo/` | Active sprint files (PROMPT.md, TASKS.md, LEARNINGS.md) |
| `.math/backups/<summary>/` | Archived sprints from `math iterate`, named with AI-generated descriptions |

## Requirements

**[Bun](https://bun.sh) is required** to run this tool. Node.js is not supported.

```bash
# Install Bun (macOS, Linux, WSL)
curl -fsSL https://bun.sh/install | bash
```

Why Bun?

- This tool is written in TypeScript and uses Bun's native TypeScript execution (no compilation step)
- The CLI uses a `#!/usr/bin/env bun` shebang for direct execution


**[OpenCode](https://opencode.ai) is required** to run this tool.

```bash
# Install OpenCode
curl -fsSL https://opencode.ai/install | bash
```

Why OpenCode?

- OpenCode provides a consistent and reliable interface for running the agent loop
- It supports many models, is easy to use, and is free to use

## Installation

### From npm (recommended)

```bash
# Global install (recommended)
bun install -g @cephalization/math

# One-off usage 
bunx @cephalization/math <command>
```

### From source (for development)

```bash
git clone https://github.com/cephalization/math.git
cd math
bun install
bun link
```

## Usage

### Initialize a project

```bash
math init
```

Creates a `.math/todo/` directory with template files and offers to run **planning mode** to help you break down your goal into tasks.

Options:

- `--no-plan` - Skip the planning prompt
- `--model <model>` - Model to use (default: `anthropic/claude-opus-4-5`)

### Plan your tasks

```bash
math plan
```

Options:

- `--model <model>` - Model to use (default: `anthropic/claude-opus-4-5`)
- `--quick` - Skip clarifying questions and generate plan immediately

Interactively plan your tasks with AI assistance. The planner uses a two-phase approach:

1. **Clarification phase**: The AI analyzes your goal and asks 3-5 clarifying questions
2. **Planning phase**: Using your answers, it generates a well-structured task list

Use `--quick` to skip the clarification phase if you want a faster, assumption-based plan.

### Run the agent loop

```bash
math run
```

Options:

- `--model <model>` - Model to use (default: `anthropic/claude-opus-4-5`)
- `--max-iterations <n>` - Safety limit (default: 100)
- `--pause <seconds>` - Pause between iterations (default: 3)

Iteratively run the agent loop until all tasks are complete. Each iteration will:

- Read the `TASKS.md` file to find the next task to complete
- Invoke the agent with the `PROMPT.md` file and the `TASKS.md` file
- The agent will complete the task and update the `TASKS.md` file
- The agent will log its learnings to the `LEARNINGS.md` file
- The agent will commit the changes to the repository
- The agent will exit

### Check status

```bash
math status
```

Shows task progress with a visual progress bar and next task info.

### Start a new sprint

```bash
math iterate
```

Backs up `.math/todo/` to `.math/backups/<summary>/` and resets for a new goal:

- TASKS.md and LEARNINGS.md are reset to templates
- PROMPT.md is preserved (keeping your accumulated "signs")
- Offers to run planning mode for your new goal

The `<summary>` is a short description of the completed sprint (e.g., `add-user-auth`, `fix-api-bugs`).

Options:

- `--no-plan` - Skip the planning prompt

## Task Format

Tasks in `TASKS.md` follow this format:

```markdown
### task-id

- content: Description of what to implement
- status: pending | in_progress | complete
- dependencies: task-1, task-2
```

## The Loop

```
┌─────────────────────────────────────────────────────────────┐
│                      math run (loop)                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  1. Check TASKS.md for pending tasks                  │  │
│  │  2. If all complete → EXIT SUCCESS                    │  │
│  │  3. Invoke agent with PROMPT.md + TASKS.md            │  │
│  │  4. Agent: pick task → implement → test → commit      │  │
│  │  5. Agent: update TASKS.md → log learnings → EXIT     │  │
│  │  6. Loop back to step 1                               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Planning Mode

When you run `math init`, `math iterate`, or `math plan`, the harness can invoke [OpenCode](https://opencode.ai/docs/cli/) to help you plan:

1. You describe your high-level goal
2. OpenCode asks clarifying questions to understand your requirements
3. You answer the questions interactively
4. OpenCode breaks your goal into discrete, implementable tasks
5. Tasks are written to `TASKS.md` with proper dependencies
6. You're ready to run `math run`

This bridges the gap between "I want to build X" and a structured task list. The clarifying questions phase uses OpenCode's session continuation feature to maintain context across the conversation.

## Signs (Guardrails)

"Signs" are explicit guardrails in `PROMPT.md` that prevent common agent mistakes. Add new signs whenever you discover a failure mode:

```markdown
### SIGN: Descriptive Name

Clear explanation of what to do or avoid.

❌ WRONG: Example of the mistake
✅ RIGHT: Example of correct behavior
```

Signs accumulate over time, making the agent increasingly reliable.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MODEL`  | `anthropic/claude-opus-4-5` | Model to use |

## Credits

- **Ralph Methodology**: [Geoffrey Huntley](https://ghuntley.com/ralph/)
- **Agent Runtime**: [OpenCode](https://opencode.ai)

## License

MIT
