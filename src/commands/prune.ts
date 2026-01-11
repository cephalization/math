import { basename } from "node:path";
import { findArtifacts, confirmPrune, deleteArtifacts } from "../prune";

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

export async function prune(options: { force?: boolean } = {}) {
  // Find all artifacts
  const artifacts = findArtifacts();

  if (artifacts.length === 0) {
    console.log(`${colors.dim}No artifacts found to clean up.${colors.reset}`);
    return;
  }

  console.log(
    `${colors.bold}Found ${artifacts.length} artifact${artifacts.length === 1 ? "" : "s"}:${colors.reset}`
  );

  // Ask for confirmation (skipped if --force)
  const { confirmed } = await confirmPrune(artifacts, { force: options.force });

  if (!confirmed) {
    console.log(`${colors.yellow}Aborted.${colors.reset}`);
    return;
  }

  // Delete the artifacts
  const result = deleteArtifacts(artifacts);

  // Report results
  if (result.deleted.length > 0) {
    console.log(
      `${colors.green}✓${colors.reset} Deleted ${result.deleted.length} artifact${result.deleted.length === 1 ? "" : "s"}:`
    );
    for (const path of result.deleted) {
      console.log(`  ${colors.dim}${basename(path)}/${colors.reset}`);
    }
  }

  if (result.failed.length > 0) {
    console.log();
    console.log(
      `${colors.red}✗${colors.reset} Failed to delete ${result.failed.length} artifact${result.failed.length === 1 ? "" : "s"}:`
    );
    for (const { path, error } of result.failed) {
      console.log(`  ${colors.red}${basename(path)}/${colors.reset}: ${error}`);
    }
  }

  // Summary
  if (result.deleted.length > 0 && result.failed.length === 0) {
    console.log();
    console.log(`${colors.green}All artifacts cleaned up.${colors.reset}`);
  }
}
