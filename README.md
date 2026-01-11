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

## Installation

```bash
# Clone and link globally
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

Creates a `todo/` directory with template files and offers to run **planning mode** to help you break down your goal into tasks.

Options:

- `--no-plan` - Skip the planning prompt
- `--model <model>` - Model to use (default: `anthropic/claude-opus-4-5`)

### Plan your tasks

```bash
math plan
```

Options:

- `--model <model>` - Model to use (default: `anthropic/claude-opus-4-5`)

Interactively plan your tasks with AI assistance. Describe your goal and let OpenCode help break it down into well-structured tasks in `TASKS.md`.

### Run the agent loop

```bash
math run
```

Options:

- `--model <model>` - Model to use (default: `anthropic/claude-opus-4-5`)
- `--max-iterations <n>` - Safety limit (default: 100)
- `--pause <seconds>` - Pause between iterations (default: 3)

### Check status

```bash
math status
```

Shows task progress with a visual progress bar and next task info.

### Start a new sprint

```bash
math iterate
```

Backs up `todo/` to `todo-{M}-{D}-{Y}/` and resets for a new goal:

- TASKS.md and LEARNINGS.md are reset to templates
- PROMPT.md is preserved (keeping your accumulated "signs")
- Offers to run planning mode for your new goal

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
2. OpenCode breaks it into discrete, implementable tasks
3. Tasks are written to `TASKS.md` with proper dependencies
4. You're ready to run `math run`

This bridges the gap between "I want to build X" and a structured task list.

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
| `MODEL`  | `anthropic/claude-opus-4-20250514` | Model to use |

## Credits

- **Ralph Methodology**: [Geoffrey Huntley](https://ghuntley.com/ralph/)
- **Agent Runtime**: [OpenCode](https://opencode.ai)

## License

MIT
