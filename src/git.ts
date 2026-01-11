/**
 * Git helper functions for the math loop.
 * Extracted from loop.ts for modularity and testability.
 */

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
 * Create a new working branch from the default branch.
 * Fetches latest, checks out default branch, pulls, then creates new branch.
 *
 * @param loggers - Logger functions for status messages
 * @returns The name of the created branch
 */
export async function createWorkingBranch(loggers: Loggers): Promise<string> {
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
