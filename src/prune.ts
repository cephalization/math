import { readdirSync, statSync, rmSync } from "node:fs";
import { join, basename } from "node:path";
import { createInterface } from "node:readline/promises";

/**
 * Pattern for backup directories created by `math iterate`
 * Matches: todo-{M}-{D}-{Y} or todo-{M}-{D}-{Y}-{N}
 * Examples: todo-1-15-2025, todo-12-31-2024-1, todo-1-1-2026-42
 */
const BACKUP_DIR_PATTERN = /^todo-\d{1,2}-\d{1,2}-\d{4}(-\d+)?$/;

/**
 * Finds all math artifacts in a directory.
 *
 * Artifacts include:
 * - Backup directories matching pattern todo-{M}-{D}-{Y} or todo-{M}-{D}-{Y}-{N}
 *
 * @param directory - The directory to search in (defaults to cwd)
 * @returns Array of absolute paths to artifacts
 */
export function findArtifacts(directory: string = process.cwd()): string[] {
  const artifacts: string[] = [];

  try {
    const entries = readdirSync(directory);

    for (const entry of entries) {
      const fullPath = join(directory, entry);

      // Check if it's a backup directory
      if (BACKUP_DIR_PATTERN.test(entry)) {
        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            artifacts.push(fullPath);
          }
        } catch {
          // Skip entries we can't stat (permission issues, etc.)
        }
      }
    }
  } catch {
    // If we can't read the directory, return empty array
  }

  return artifacts;
}

/**
 * Result of a delete operation
 */
export interface DeleteResult {
  /** Paths that were successfully deleted */
  deleted: string[];
  /** Paths that failed to delete with their error messages */
  failed: { path: string; error: string }[];
}

/**
 * Deletes the provided artifact paths.
 *
 * Handles errors gracefully - if a path fails to delete (e.g., permission denied),
 * it continues with the remaining paths and reports the failure.
 *
 * @param paths - Array of absolute paths to delete
 * @returns Summary of deleted paths and any failures
 */
export function deleteArtifacts(paths: string[]): DeleteResult {
  const result: DeleteResult = {
    deleted: [],
    failed: [],
  };

  for (const path of paths) {
    try {
      rmSync(path, { recursive: true, force: true });
      result.deleted.push(path);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error";
      result.failed.push({ path, error: errorMessage });
    }
  }

  return result;
}

/**
 * Result of a confirmation prompt
 */
export interface ConfirmationResult {
  /** Whether the user confirmed the action */
  confirmed: boolean;
  /** The paths that were shown to the user */
  paths: string[];
}

/**
 * Shows an interactive confirmation prompt for pruning artifacts.
 *
 * Lists all artifacts that will be deleted and asks for user confirmation.
 * If `force` is true, skips the prompt and returns confirmed: true.
 *
 * @param paths - Array of absolute paths to be deleted
 * @param options - Configuration options
 * @param options.force - If true, skip confirmation and return confirmed: true
 * @returns Result indicating whether user confirmed and what paths were shown
 */
export async function confirmPrune(
  paths: string[],
  options: { force?: boolean } = {}
): Promise<ConfirmationResult> {
  // If force flag is set, skip confirmation
  if (options.force) {
    return { confirmed: true, paths };
  }

  // If no paths, nothing to confirm
  if (paths.length === 0) {
    return { confirmed: true, paths };
  }

  // Show what will be deleted
  console.log("\nThe following artifacts will be deleted:\n");
  for (const path of paths) {
    console.log(`  - ${basename(path)}/`);
  }
  console.log();

  // Ask for confirmation
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question("Delete these artifacts? (y/N) ");
    rl.close();

    const confirmed = answer.toLowerCase() === "y";
    return { confirmed, paths };
  } catch {
    rl.close();
    return { confirmed: false, paths };
  }
}
