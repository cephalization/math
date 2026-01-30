import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { join } from "node:path";
import { $ } from "bun";
import { getTodoDir, getBackupsDir } from "./paths";
import { getDexDir } from "./dex";
import { parseTasks, importAllTasksToDex, type MigrationReport } from "./migrate-tasks";
import { PROMPT_TEMPLATE, LEARNINGS_TEMPLATE } from "./templates";

/**
 * Migration choice enum
 */
export enum MigrationChoice {
  Port = "port",
  Archive = "archive",
  Exit = "exit",
}

/**
 * Check if migration from TASKS.md to dex is needed.
 * Returns true if:
 * - .math/todo/TASKS.md exists AND
 * - .dex/ does not exist OR is empty
 */
export async function checkNeedsDexMigration(): Promise<boolean> {
  const todoDir = getTodoDir();
  const tasksPath = join(todoDir, "TASKS.md");

  // Check if TASKS.md exists
  if (!existsSync(tasksPath)) {
    return false;
  }

  // Check if .dex exists
  const dexDir = await getDexDir();
  if (dexDir === null) {
    // dex dir command failed - likely no .dex directory
    return true;
  }

  // Check if .dex directory is empty (no tasks.jsonl or it's empty)
  const tasksFile = join(dexDir, "tasks.jsonl");
  if (!existsSync(tasksFile)) {
    return true;
  }

  // Check if tasks.jsonl has content
  const file = Bun.file(tasksFile);
  const content = await file.text();
  if (content.trim() === "") {
    return true;
  }

  // Dex has tasks, no migration needed
  return false;
}

/**
 * Display interactive menu for migration options.
 * Returns the user's choice.
 */
export async function promptDexMigration(): Promise<MigrationChoice> {
  const colors = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    cyan: "\x1b[36m",
    yellow: "\x1b[33m",
    green: "\x1b[32m",
    dim: "\x1b[2m",
  };

  console.log();
  console.log(
    `${colors.bold}${colors.yellow}TASKS.md detected - migration required${colors.reset}`
  );
  console.log();
  console.log(
    `${colors.dim}Math now uses dex for task management. Your existing TASKS.md needs to be migrated.${colors.reset}`
  );
  console.log();
  console.log(`${colors.bold}Choose an option:${colors.reset}`);
  console.log();
  console.log(
    `  ${colors.green}1${colors.reset}) ${colors.cyan}Port existing tasks to dex${colors.reset}`
  );
  console.log(
    `     ${colors.dim}Imports all TASKS.md tasks preserving status and dependencies${colors.reset}`
  );
  console.log();
  console.log(
    `  ${colors.green}2${colors.reset}) ${colors.cyan}Archive and start fresh${colors.reset}`
  );
  console.log(
    `     ${colors.dim}Moves .math/todo/ to .math/backups/ and initializes clean dex${colors.reset}`
  );
  console.log();
  console.log(`  ${colors.green}3${colors.reset}) ${colors.cyan}Exit${colors.reset}`);
  console.log(
    `     ${colors.dim}If you need the old TASKS.md workflow, downgrade to v0.4.0${colors.reset}`
  );
  console.log();

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question(
      `${colors.bold}Enter choice (1-3):${colors.reset} `
    );

    switch (answer.trim()) {
      case "1":
        return MigrationChoice.Port;
      case "2":
        return MigrationChoice.Archive;
      case "3":
        return MigrationChoice.Exit;
      default:
        // Invalid input, default to exit for safety
        console.log(
          `${colors.yellow}Invalid choice. Exiting for safety.${colors.reset}`
        );
        return MigrationChoice.Exit;
    }
  } finally {
    rl.close();
  }
}

/**
 * Execute the chosen migration action.
 */
export async function executeDexMigration(
  choice: MigrationChoice
): Promise<void> {
  const colors = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    cyan: "\x1b[36m",
    yellow: "\x1b[33m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    dim: "\x1b[2m",
  };

  switch (choice) {
    case MigrationChoice.Port:
      await executePortMigration(colors);
      break;
    case MigrationChoice.Archive:
      await executeArchiveMigration(colors);
      break;
    case MigrationChoice.Exit:
      executeExitWithDowngrade(colors);
      break;
  }
}

/**
 * Port existing TASKS.md tasks to dex
 */
async function executePortMigration(colors: Record<string, string>): Promise<void> {
  const todoDir = getTodoDir();
  const tasksPath = join(todoDir, "TASKS.md");

  console.log();
  console.log(`${colors.cyan}Porting tasks to dex...${colors.reset}`);

  // Step 1: Initialize dex
  console.log(`${colors.dim}  Initializing dex...${colors.reset}`);
  const initResult = await $`dex init -y`.quiet();
  if (initResult.exitCode !== 0) {
    console.log(
      `${colors.red}Failed to initialize dex: ${initResult.stderr.toString()}${colors.reset}`
    );
    process.exit(1);
  }

  // Step 2: Read and parse TASKS.md
  console.log(`${colors.dim}  Reading TASKS.md...${colors.reset}`);
  const content = await Bun.file(tasksPath).text();
  const tasks = parseTasks(content);

  if (tasks.length === 0) {
    console.log(`${colors.yellow}  No tasks found in TASKS.md${colors.reset}`);
  } else {
    // Step 3: Import all tasks (sorted by dependencies)
    console.log(`${colors.dim}  Importing ${tasks.length} tasks...${colors.reset}`);
    const report = await importAllTasksToDex(content);

    // Show results
    for (const result of report.results) {
      if (result.success) {
        console.log(`${colors.green}    ✓ ${result.id}${colors.reset}`);
      } else {
        console.log(
          `${colors.red}    ✗ ${result.id}: ${result.error}${colors.reset}`
        );
      }
    }

    // Report summary
    console.log();
    console.log(
      `${colors.bold}Migration complete:${colors.reset} ${report.successful}/${report.total} tasks imported`
    );

    if (report.failed > 0) {
      console.log(
        `${colors.yellow}Warning: ${report.failed} tasks failed to import${colors.reset}`
      );
    }
  }

  // Step 4: Delete TASKS.md on success
  console.log(`${colors.dim}  Removing TASKS.md...${colors.reset}`);
  rmSync(tasksPath);

  console.log();
  console.log(
    `${colors.green}${colors.bold}Migration successful!${colors.reset}`
  );
  console.log(
    `${colors.dim}Use 'dex list --ready' to see available tasks.${colors.reset}`
  );
  console.log();
}

/**
 * Archive .math/todo/ and start fresh with dex
 */
async function executeArchiveMigration(colors: Record<string, string>): Promise<void> {
  const todoDir = getTodoDir();
  const backupsDir = getBackupsDir();

  console.log();
  console.log(`${colors.cyan}Archiving and starting fresh...${colors.reset}`);

  // Step 1: Create timestamped backup directory
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupName = `${timestamp}-pre-dex`;
  const backupPath = join(backupsDir, backupName);

  console.log(`${colors.dim}  Creating backup at ${backupName}...${colors.reset}`);

  // Ensure backups directory exists
  if (!existsSync(backupsDir)) {
    mkdirSync(backupsDir, { recursive: true });
  }

  // Step 2: Move entire .math/todo/ to backup
  renameSync(todoDir, backupPath);

  // Step 3: Initialize dex
  console.log(`${colors.dim}  Initializing dex...${colors.reset}`);
  const initResult = await $`dex init -y`.quiet();
  if (initResult.exitCode !== 0) {
    console.log(
      `${colors.red}Failed to initialize dex: ${initResult.stderr.toString()}${colors.reset}`
    );
    // Try to restore backup
    renameSync(backupPath, todoDir);
    process.exit(1);
  }

  // Step 4: Create fresh .math/todo/ with PROMPT.md and LEARNINGS.md
  console.log(`${colors.dim}  Creating fresh .math/todo/...${colors.reset}`);
  mkdirSync(todoDir, { recursive: true });

  await Bun.write(join(todoDir, "PROMPT.md"), PROMPT_TEMPLATE);
  await Bun.write(join(todoDir, "LEARNINGS.md"), LEARNINGS_TEMPLATE);

  console.log();
  console.log(
    `${colors.green}${colors.bold}Archive complete!${colors.reset}`
  );
  console.log(
    `${colors.dim}Previous tasks backed up to: .math/backups/${backupName}${colors.reset}`
  );
  console.log(
    `${colors.dim}Use 'dex create "task description"' to add new tasks.${colors.reset}`
  );
  console.log();
}

/**
 * Print downgrade instructions and exit
 */
function executeExitWithDowngrade(colors: Record<string, string>): void {
  console.log();
  console.log(
    `${colors.yellow}${colors.bold}Dex is required for this version of math.${colors.reset}`
  );
  console.log();
  console.log(
    `${colors.dim}If you prefer the old TASKS.md workflow, downgrade to version 0.4.0:${colors.reset}`
  );
  console.log();
  console.log(
    `  ${colors.cyan}bun remove @cephalization/math && bun add @cephalization/math@0.4.0${colors.reset}`
  );
  console.log();
  process.exit(0);
}

/**
 * Main orchestration function: check if migration is needed, prompt user, and execute.
 * Returns the migration choice (or undefined if no migration was needed).
 */
export async function migrateTasksToDexIfNeeded(): Promise<MigrationChoice | undefined> {
  const needsMigration = await checkNeedsDexMigration();

  if (!needsMigration) {
    return undefined;
  }

  const choice = await promptDexMigration();
  await executeDexMigration(choice);

  return choice;
}
