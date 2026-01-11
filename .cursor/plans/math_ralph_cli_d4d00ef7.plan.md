---
name: math - Multi-Agent Todo Harness
overview: A light meta agent orchestration harness that coordinates multiple AI agents working together to accomplish tasks from a TODO list, reducing context bloat by digesting project plans into TASKS.md, LEARNINGS.md, and PROMPT.md.
todos:
  - id: cli-setup
    content: "Set up CLI with Bun.argv: init, run, status, iterate commands"
    status: completed
  - id: task-parser
    content: Implement TASKS.md parser and status updater
    status: completed
    dependencies:
      - cli-setup
  - id: templates
    content: Create template files for math init command
    status: completed
    dependencies:
      - cli-setup
  - id: loop
    content: Implement Ralph loop using Bun.$ and OpenCode CLI
    status: completed
    dependencies:
      - task-parser
  - id: iterate-cmd
    content: Implement iterate command to backup todo/ and reset for new sprint
    status: completed
    dependencies:
      - cli-setup
  - id: package-config
    content: Configure package.json bin entry for global install
    status: completed
    dependencies:
      - loop
      - iterate-cmd
---

# math - Multi-Agent Todo Harness

A light meta agent orchestration harness designed to coordinate multiple AI agents working together to accomplish tasks from a TODO list.

## Core Concept

The primary responsibility of this harness is to **reduce context bloat** by digesting a project plan into three documents:

| Document | Purpose |

|----------|---------|

| `TASKS.md` | Task list with status tracking and dependencies |

| `LEARNINGS.md` | Accumulated insights from completed tasks |

| `PROMPT.md` | System prompt with guardrails ("signs") |

The harness consists of a simple for-loop, executing a new coding agent with a mandate from `PROMPT.md` to complete a *single* task from `TASKS.md`, while reading and recording any insight gained during the work into `LEARNINGS.md`.

## Architecture

```mermaid
flowchart TD
    subgraph CLI [math CLI]
        Init[math init]
        Run[math run]
        Status[math status]
        Iterate[math iterate]
    end
    
    subgraph TodoDir [todo/ directory]
        Tasks[TASKS.md]
        Prompt[PROMPT.md]
        Learnings[LEARNINGS.md]
    end
    
    subgraph Loop [Run Loop]
        Parse[Parse tasks]
        Check{All complete?}
        Invoke[Invoke OpenCode]
        Wait[Wait + check progress]
    end
    
    Init --> TodoDir
    Run --> Parse
    Parse --> Check
    Check -->|Yes| Exit[Exit success]
    Check -->|No| Invoke
    Invoke --> Wait
    Wait --> Parse
    Status --> Tasks
    Iterate -->|Backup| Archive["todo-{M}-{D}-{Y}/"]
    Iterate -->|Reset| TodoDir
```

## Key Files

| File | Purpose |

|------|---------|

| [`index.ts`](index.ts) | CLI entry point using Bun.argv |

| `src/loop.ts` | Main Ralph loop logic |

| `src/tasks.ts` | Parse/update TASKS.md |

| `src/templates.ts` | Template files for `math init` |

## Bun Primitives (Zero Dependencies)

| Need | Bun Primitive |

|------|---------------|

| CLI args | `Bun.argv` / `process.argv` |

| File read | `Bun.file(path).text()` |

| File write | `Bun.write(path, content)` |

| Shell commands | `Bun.$\`command\`` |

| Directory ops | `Bun.$\`cp -r\``, `Bun.$\`mkdir\`` |

| Colors | ANSI escape codes (no chalk) |

## Implementation

### 1. CLI Commands (using Bun.argv)

```typescript
const [command, ...args] = Bun.argv.slice(2);

switch (command) {
  case "init":     // Create todo/ with template files
  case "run":      // Start the loop (--model, --max-iterations)
  case "status":   // Show current task counts  
  case "iterate":  // Backup todo/ and reset for new sprint
  default:         // Show help
}
```

### 2. Task Parser

Parse TASKS.md format:

```markdown
### task-id
- content: Description
- status: pending | in_progress | complete
- dependencies: task-1, task-2
```

### 3. Loop Logic

Port `ralph.sh` to TypeScript using `Bun.$` for shell commands:

- Count task statuses
- Exit when all complete
- Invoke OpenCode with attached files
- Check for progress after each iteration

### 4. Package Configuration

Set up as global CLI:

```json
{
  "bin": { "math": "./index.ts" }
}
```

## Templates

The `math init` command creates:

- `todo/PROMPT.md` - Generic system prompt with signs
- `todo/TASKS.md` - Empty task tracker template
- `todo/LEARNINGS.md` - Empty learnings log

## Iterate Command

The `math iterate` command enables starting a new sprint while preserving history:

1. **Backup**: Copy `todo/` to `todo-{M}-{D}-{Y}/` (e.g., `todo-1-11-2026/`)
2. **Reset**: Clear TASKS.md and LEARNINGS.md to templates, keep PROMPT.md signs

This preserves completed work as a historical record while preparing for new goals.