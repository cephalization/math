import { join } from "node:path";
import { existsSync } from "node:fs";
import { readTasks, countTasks, updateTaskStatus, writeTasks } from "./tasks";
import { DEFAULT_MODEL } from "./constants";
import { OpenCodeAgent, MockAgent, createLogEntry } from "./agent";
import type { Agent, LogCategory } from "./agent";
import { createOutputBuffer, type OutputBuffer } from "./ui/buffer";
import { startServer, DEFAULT_PORT } from "./ui/server";

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
  dryRun?: boolean;
  agent?: Agent;
  buffer?: OutputBuffer;
  /** Enable web UI server (default: true) */
  ui?: boolean;
}

/**
 * Create log functions that write to both console and an optional buffer.
 */
function createLoggers(buffer?: OutputBuffer) {
  const log = (message: string) => {
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    console.log(`${colors.blue}[${timestamp}]${colors.reset} ${message}`);
    buffer?.appendLog("info", message);
  };

  const logSuccess = (message: string) => {
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    console.log(`${colors.green}[${timestamp}] ✓${colors.reset} ${message}`);
    buffer?.appendLog("success", message);
  };

  const logWarning = (message: string) => {
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    console.log(`${colors.yellow}[${timestamp}] ⚠${colors.reset} ${message}`);
    buffer?.appendLog("warning", message);
  };

  const logError = (message: string) => {
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    console.log(`${colors.red}[${timestamp}] ✗${colors.reset} ${message}`);
    buffer?.appendLog("error", message);
  };

  return { log, logSuccess, logWarning, logError };
}

async function checkOpenCode(): Promise<boolean> {
  try {
    const result = await Bun.$`which opencode`.quiet();
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

async function getDefaultBranch(): Promise<string> {
  // Try to detect default branch (main or master)
  try {
    // Check if 'main' exists
    const mainResult = await Bun.$`git rev-parse --verify main`.quiet();
    if (mainResult.exitCode === 0) {
      return "main";
    }
  } catch {}

  try {
    // Check if 'master' exists
    const masterResult = await Bun.$`git rev-parse --verify master`.quiet();
    if (masterResult.exitCode === 0) {
      return "master";
    }
  } catch {}

  throw new Error("Could not find main or master branch");
}

interface Loggers {
  log: (message: string) => void;
  logSuccess: (message: string) => void;
  logWarning: (message: string) => void;
  logError: (message: string) => void;
}

async function createWorkingBranch(loggers: Loggers): Promise<string> {
  const { log, logWarning } = loggers;
  const defaultBranch = await getDefaultBranch();

  // Generate branch name with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const branchName = `math-loop-${timestamp}`;

  // Fetch latest and checkout default branch
  log(`Fetching latest from origin...`);
  try {
    await Bun.$`git fetch origin ${defaultBranch}`.quiet();
  } catch {
    logWarning("Could not fetch from origin, using local branch");
  }

  // Checkout default branch and pull
  log(`Checking out ${defaultBranch}...`);
  await Bun.$`git checkout ${defaultBranch}`.quiet();

  try {
    await Bun.$`git pull origin ${defaultBranch}`.quiet();
  } catch {
    logWarning("Could not pull from origin, using local state");
  }

  // Create and checkout new branch
  log(`Creating branch: ${branchName}`);
  await Bun.$`git checkout -b ${branchName}`.quiet();

  return branchName;
}

export async function runLoop(options: LoopOptions = {}): Promise<void> {
  const model = options.model || DEFAULT_MODEL;
  const maxIterations = options.maxIterations || 100;
  const pauseSeconds = options.pauseSeconds || 3;
  const dryRun = options.dryRun || false;
  const uiEnabled = options.ui !== false; // default: true

  // Create or use provided buffer - needed for UI server
  const buffer = options.buffer ?? (uiEnabled ? createOutputBuffer() : undefined);

  // Create loggers that write to both console and buffer
  const { log, logSuccess, logWarning, logError } = createLoggers(buffer);

  // Start web UI server if enabled
  if (uiEnabled) {
    const server = startServer({ buffer: buffer!, port: DEFAULT_PORT });
    log(`Web UI available at http://localhost:${DEFAULT_PORT}`);
  }

  const todoDir = join(process.cwd(), "todo");
  const promptPath = join(todoDir, "PROMPT.md");
  const tasksPath = join(todoDir, "TASKS.md");

  // Check required files exist
  if (!existsSync(promptPath)) {
    throw new Error(
      `PROMPT.md not found at ${promptPath}. Run 'math init' first.`
    );
  }
  if (!existsSync(tasksPath)) {
    throw new Error(
      `TASKS.md not found at ${tasksPath}. Run 'math init' first.`
    );
  }

  // Select agent: use provided agent, or mock for dry-run, or real agent
  let agent: Agent;
  if (options.agent) {
    agent = options.agent;
  } else if (dryRun) {
    agent = new MockAgent({
      logs: [
        { category: "info", message: "[DRY RUN] Agent would process tasks" },
        { category: "success", message: "[DRY RUN] Agent completed (simulated)" },
      ],
      output: ["[DRY RUN] No actual LLM call made\n"],
      exitCode: 0,
    });
    log("[DRY RUN] Using mock agent - no LLM calls will be made");
  } else {
    agent = new OpenCodeAgent();
    // Verify opencode is available (only for real agent)
    if (!(await agent.isAvailable())) {
      throw new Error(
        "opencode not found in PATH.\n" +
          "Install: curl -fsSL https://opencode.ai/install | bash\n" +
          "See: https://opencode.ai/docs/cli/"
      );
    }
  }

  // Create a new branch for this loop run (skip in dry-run mode)
  let branchName: string | undefined;
  if (!dryRun) {
    log("Setting up git branch...");
    branchName = await createWorkingBranch({ log, logSuccess, logWarning, logError });
    logSuccess(`Working on branch: ${branchName}`);
    console.log();
  } else {
    log("[DRY RUN] Skipping git branch creation");
    console.log();
  }

  log("Starting math loop");
  log(`Model: ${model}`);
  log(`Max iterations: ${maxIterations}`);
  if (dryRun) {
    log("[DRY RUN] Mode enabled - no actual changes will be made");
  }
  console.log();

  let iteration = 0;

  while (true) {
    iteration++;

    // Safety check
    if (iteration > maxIterations) {
      logError(`Exceeded max iterations (${maxIterations}). Stopping.`);
      throw new Error(`Exceeded max iterations (${maxIterations})`);
    }

    log(`=== Iteration ${iteration} ===`);

    // Read and count tasks
    const { tasks, content } = await readTasks(todoDir);
    const counts = countTasks(tasks);

    log(
      `Tasks: ${counts.complete}/${counts.total} complete, ${counts.in_progress} in progress, ${counts.pending} pending`
    );

    // Check if all tasks are complete
    if (counts.total > 0 && counts.pending === 0 && counts.in_progress === 0) {
      logSuccess(`All ${counts.complete} tasks complete!`);
      logSuccess(`Total iterations: ${iteration}`);
      return;
    }

    // Sanity check
    if (counts.total === 0) {
      logError("No tasks found in TASKS.md - check file format");
      throw new Error("No tasks found in TASKS.md - check file format");
    }

    // Check for stuck in_progress tasks
    if (counts.in_progress > 0) {
      logWarning(
        `Found ${counts.in_progress} task(s) marked in_progress from previous run`
      );
      logWarning("Agent will handle or reset these");
    }

    // Invoke agent
    log("Invoking agent...");

    try {
      const prompt =
        "Read the attached PROMPT.md and TASKS.md files. Follow the instructions in PROMPT.md to complete the next pending task.";
      const files = ["todo/PROMPT.md", "todo/TASKS.md"];

      const result = await agent.run({
        model,
        prompt,
        files,
        events: {
          onLog: (entry) => {
            // Log agent events to console
            switch (entry.category) {
              case "info":
                log(entry.message);
                break;
              case "success":
                logSuccess(entry.message);
                break;
              case "warning":
                logWarning(entry.message);
                break;
              case "error":
                logError(entry.message);
                break;
            }
          },
          onOutput: (output) => {
            // Print agent output to stdout and buffer
            process.stdout.write(output.text);
            buffer?.appendOutput(output.text);
          },
        },
      });

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
      logError(
        `Error running agent: ${error instanceof Error ? error.message : error}`
      );
      // Continue anyway
    }

    // Pause between iterations
    log(`Pausing ${pauseSeconds}s before next iteration...`);
    await Bun.sleep(pauseSeconds * 1000);
    console.log();
  }
}
