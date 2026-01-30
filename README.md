# math - Multi-Agent Task Harness

A light meta agent orchestration harness designed to coordinate multiple AI agents working together to accomplish tasks managed by [dex](https://dex.rip).

## Core Concept

The primary responsibility of this harness is to **reduce context bloat** by digesting a project plan into focused documents:

| Document | Purpose |
| ---------- | --------- |
| `dex` | Task tracking with status, dependencies, and context |
| `LEARNINGS.md` | Accumulated insights from completed tasks |
| `PROMPT.md` | System prompt with guardrails ("signs") |

The harness consists of a simple for-loop, executing a new coding agent with a mandate from `PROMPT.md` to complete a *single* task from dex, while reading and recording any insight gained during the work into `LEARNINGS.md`.

### Directory Structure

| Path | Description |
| ---- | ----------- |
| `.dex/` | Dex task storage (tasks.jsonl) |
| `.math/todo/` | Active sprint files (PROMPT.md, LEARNINGS.md) |
| `.math/backups/` | Archived learnings from `math iterate` |

## Requirements

**[Bun](https://bun.sh) is required** to run this tool. Node.js is not supported.

```bash
# Install Bun (macOS, Linux, WSL)
curl -fsSL https://bun.sh/install | bash
```

**[dex](https://dex.rip) is required** for task management.

```bash
# Install dex
bun add -g @zeeg/dex
```

**[OpenCode](https://opencode.ai) is required** to run the agent loop.

```bash
# Install OpenCode
curl -fsSL https://opencode.ai/install | bash
```

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

Initializes dex and creates a `.math/todo/` directory with template files. Offers to run **planning mode** to help you break down your goal into tasks.

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
2. **Planning phase**: Using your answers, it creates tasks in dex with proper dependencies

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

- Query dex to find the next ready task
- Invoke the agent with `PROMPT.md` and task context
- The agent will complete the task and mark it done in dex
- The agent will log learnings to `LEARNINGS.md`
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

Archives completed tasks and resets for a new goal:

- Completed dex tasks are archived
- LEARNINGS.md is backed up and reset
- PROMPT.md is preserved (keeping your accumulated "signs")
- Offers to run planning mode for your new goal

Options:

- `--no-plan` - Skip the planning prompt

## Task Management

Tasks are managed by [dex](https://dex.rip). Common commands:

```bash
# List ready tasks
dex list --ready

# Create a new task
dex create "Task description" --description "Detailed context"

# View task details
dex show <task-id>

# Mark task complete
dex complete <task-id> --result "What was done"

# View overall status
dex status
```

See the [dex documentation](https://dex.rip/cli) for full CLI reference.

## The Loop

```
┌─────────────────────────────────────────────────────────────┐
│                      math run (loop)                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  1. Query dex for ready tasks                         │  │
│  │  2. If all complete → EXIT SUCCESS                    │  │
│  │  3. Invoke agent with PROMPT.md + task context        │  │
│  │  4. Agent: start task → implement → test → commit     │  │
│  │  5. Agent: complete task in dex → log learnings       │  │
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
5. Tasks are created in dex with proper dependencies
6. You're ready to run `math run`

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
| `MODEL`  | `anthropic/claude-opus-4-5` | Model to use |

## Credits

- **Ralph Methodology**: [Geoffrey Huntley](https://ghuntley.com/ralph/)
- **Task Management**: [dex](https://dex.rip)
- **Agent Runtime**: [OpenCode](https://opencode.ai)

## License

MIT
