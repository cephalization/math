import { existsSync, readdirSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { join } from "node:path";
import { getTodoDir } from "./paths";
import { getDexDir } from "./dex";

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
