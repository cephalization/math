import { createInterface } from "node:readline/promises";
import { existsSync } from "node:fs";
import { mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { getMathDir, getTodoDir } from "./paths";

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

/**
 * Check if the legacy todo/ directory exists and contains the expected files.
 */
export function hasLegacyTodoDir(): boolean {
  const legacyDir = join(process.cwd(), "todo");

  if (!existsSync(legacyDir)) {
    return false;
  }

  // Check for at least one of the expected files
  const expectedFiles = ["PROMPT.md", "TASKS.md", "LEARNINGS.md"];
  return expectedFiles.some((file) => existsSync(join(legacyDir, file)));
}

/**
 * Check if we've already migrated to the new .math/todo structure.
 */
export function hasNewTodoDir(): boolean {
  return existsSync(getTodoDir());
}

/**
 * Prompt the user to confirm migration.
 * Returns true if user confirms, false otherwise.
 */
async function promptForMigration(): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log();
    console.log(
      `${colors.yellow}${colors.bold}Migration Required${colors.reset}`
    );
    console.log(
      `Found legacy ${colors.cyan}todo/${colors.reset} directory structure.`
    );
    console.log(
      `This will be migrated to ${colors.cyan}.math/todo/${colors.reset}`
    );
    console.log();

    const answer = await rl.question(
      `${colors.cyan}Migrate now?${colors.reset} (Y/n) `
    );
    rl.close();
    return answer.toLowerCase() !== "n";
  } catch {
    rl.close();
    return false;
  }
}

/**
 * Perform the migration from todo/ to .math/todo/.
 */
async function performMigration(): Promise<void> {
  const legacyDir = join(process.cwd(), "todo");
  const mathDir = getMathDir();
  const newTodoDir = getTodoDir();

  // Create .math directory if it doesn't exist
  if (!existsSync(mathDir)) {
    await mkdir(mathDir, { recursive: true });
  }

  // Move todo/ to .math/todo/
  await rename(legacyDir, newTodoDir);

  console.log(
    `${colors.green}✓${colors.reset} Migrated ${colors.cyan}todo/${colors.reset} to ${colors.cyan}.math/todo/${colors.reset}`
  );
  console.log();
}

/**
 * Check if migration is needed and perform it if the user confirms.
 * This function is idempotent - safe to call multiple times.
 *
 * Returns true if migration was performed or not needed, false if user declined.
 */
export async function migrateIfNeeded(): Promise<boolean> {
  // Already migrated - nothing to do
  if (hasNewTodoDir()) {
    return true;
  }

  // No legacy directory - nothing to migrate
  if (!hasLegacyTodoDir()) {
    return true;
  }

  // Legacy directory exists, prompt for migration
  const shouldMigrate = await promptForMigration();

  if (!shouldMigrate) {
    console.log(
      `${colors.yellow}Migration skipped.${colors.reset} Some commands may not work correctly.`
    );
    return false;
  }

  await performMigration();
  return true;
}
