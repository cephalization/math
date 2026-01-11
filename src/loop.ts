import { join } from "node:path";
import { existsSync } from "node:fs";
import { readTasks, countTasks, updateTaskStatus, writeTasks } from "./tasks";

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

export interface LoopOptions {
  model?: string;
  maxIterations?: number;
  pauseSeconds?: number;
}

function log(message: string) {
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`${colors.blue}[${timestamp}]${colors.reset} ${message}`);
}

function logSuccess(message: string) {
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`${colors.green}[${timestamp}] ✓${colors.reset} ${message}`);
}

function logWarning(message: string) {
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`${colors.yellow}[${timestamp}] ⚠${colors.reset} ${message}`);
}

function logError(message: string) {
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`${colors.red}[${timestamp}] ✗${colors.reset} ${message}`);
}

async function checkOpenCode(): Promise<boolean> {
  try {
    const result = await Bun.$`which opencode`.quiet();
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export async function runLoop(options: LoopOptions = {}): Promise<void> {
  const model = options.model || "anthropic/claude-opus-4-20250514";
  const maxIterations = options.maxIterations || 100;
  const pauseSeconds = options.pauseSeconds || 3;

  const todoDir = join(process.cwd(), "todo");
  const promptPath = join(todoDir, "PROMPT.md");
  const tasksPath = join(todoDir, "TASKS.md");

  // Check required files exist
  if (!existsSync(promptPath)) {
    throw new Error(`PROMPT.md not found at ${promptPath}. Run 'math init' first.`);
  }
  if (!existsSync(tasksPath)) {
    throw new Error(`TASKS.md not found at ${tasksPath}. Run 'math init' first.`);
  }

  // Verify opencode is available
  if (!(await checkOpenCode())) {
    throw new Error(
      "opencode not found in PATH.\n" +
      "Install: curl -fsSL https://opencode.ai/install | bash\n" +
      "See: https://opencode.ai/docs/cli/"
    );
  }

  log("Starting math loop");
  log(`Model: ${model}`);
  log(`Max iterations: ${maxIterations}`);
  console.log();

  let iteration = 0;

  while (true) {
    iteration++;

    // Safety check
    if (iteration > maxIterations) {
      logError(`Exceeded max iterations (${maxIterations}). Stopping.`);
      process.exit(1);
    }

    log(`=== Iteration ${iteration} ===`);

    // Read and count tasks
    const { tasks, content } = await readTasks(todoDir);
    const counts = countTasks(tasks);

    log(`Tasks: ${counts.complete}/${counts.total} complete, ${counts.in_progress} in progress, ${counts.pending} pending`);

    // Check if all tasks are complete
    if (counts.total > 0 && counts.pending === 0 && counts.in_progress === 0) {
      logSuccess(`All ${counts.complete} tasks complete!`);
      logSuccess(`Total iterations: ${iteration}`);
      return;
    }

    // Sanity check
    if (counts.total === 0) {
      logError("No tasks found in TASKS.md - check file format");
      process.exit(1);
    }

    // Check for stuck in_progress tasks
    if (counts.in_progress > 0) {
      logWarning(`Found ${counts.in_progress} task(s) marked in_progress from previous run`);
      logWarning("Agent will handle or reset these");
    }

    // Invoke agent
    log("Invoking agent...");

    try {
      // OpenCode run format: opencode run "message" -f file1 -f file2
      const result = await Bun.$`opencode run -m ${model} \
        "Read the attached PROMPT.md and TASKS.md files. Follow the instructions in PROMPT.md to complete the next pending task." \
        -f todo/PROMPT.md -f todo/TASKS.md`.quiet();

      if (result.exitCode === 0) {
        logSuccess(`Agent completed iteration ${iteration}`);
      } else {
        logError(`Agent exited with code ${result.exitCode}`);

        // Check if any progress was made
        const { tasks: newTasks } = await readTasks(todoDir);
        const newCounts = countTasks(newTasks);

        if (newCounts.complete > counts.complete) {
          logWarning("Progress was made despite error, continuing...");
        } else {
          logError("No progress made. Check logs and LEARNINGS.md");
          // Continue anyway - next iteration might succeed
        }
      }
    } catch (error) {
      logError(`Error running agent: ${error instanceof Error ? error.message : error}`);
      // Continue anyway
    }

    // Pause between iterations
    log(`Pausing ${pauseSeconds}s before next iteration...`);
    await Bun.sleep(pauseSeconds * 1000);
    console.log();
  }
}
