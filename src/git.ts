/**
 * Git helper functions for the math loop.
 * Extracted from loop.ts for modularity and testability.
 */

/**
 * Generate a branch name from a task ID.
 * Format: math/<truncated-task-id>-<timestamp>
 *
 * @param taskId - The task identifier to base the branch name on
 * @returns A valid git branch name
 */
export function generateBranchName(taskId: string): string {
  // Truncate task ID to ~20 chars max
  const truncatedId = taskId.slice(0, 20);

  // Add short timestamp suffix for uniqueness (YYYYMMDDHHmmss)
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[-:T.]/g, "")
    .slice(0, 14); // YYYY-MM-DDTHH:mm:ss.sssZ -> YYYYMMDDHHmmss (14 chars)

  return `math/${truncatedId}-${timestamp}`;
}

/**
 * Logger interface for git operations.
 */
export interface Loggers {
  log: (message: string) => void;
  logSuccess: (message: string) => void;
  logWarning: (message: string) => void;
  logError: (message: string) => void;
}

/**
 * Detect the default branch (main or master) of the current repository.
 * @returns The name of the default branch
 * @throws Error if neither main nor master branch exists
 */
export async function getDefaultBranch(): Promise<string> {
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

/**
 * Create a new branch from the current HEAD.
 * This is the simplest branching mode - just creates a branch off wherever you are.
 *
 * @param branchName - The name for the new branch
 */
export async function createBranchFromCurrent(branchName: string): Promise<void> {
  await Bun.$`git checkout -b ${branchName}`.quiet();
}

/**
 * Create a new branch from the default branch (main/master).
 * Fetches latest, checks out default branch, pulls, then creates new branch.
 *
 * @param branchName - The name for the new branch
 * @param loggers - Logger functions for status messages
 */
export async function createBranchFromDefault(branchName: string, loggers: Loggers): Promise<void> {
  const { log, logWarning } = loggers;
  const defaultBranch = await getDefaultBranch();

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
}
