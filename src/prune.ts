import { readdirSync, statSync, rmSync } from "node:fs";
import { join, basename } from "node:path";
import { createInterface } from "node:readline/promises";
import { getBackupsDir } from "./paths.js";

/**
 * Finds all math artifacts (backup directories) in `.math/backups/`.
 *
 * Scans the `.math/backups/` directory and returns all subdirectories
 * as artifacts. These are created by `math iterate` with summary-based names.
 *
 * @returns Array of absolute paths to backup directories
 */
export function findArtifacts(): string[] {
  const artifacts: string[] = [];
  const backupsDir = getBackupsDir();

  try {
    const entries = readdirSync(backupsDir);

    for (const entry of entries) {
      const fullPath = join(backupsDir, entry);

      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          artifacts.push(fullPath);
        }
      } catch {
        // Skip entries we can't stat (permission issues, etc.)
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
