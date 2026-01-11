import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

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
