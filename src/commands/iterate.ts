import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { LEARNINGS_TEMPLATE } from "../templates";
import { runPlanningMode, askToRunPlanning } from "../plan";
import { getTodoDir, getBackupsDir } from "../paths";
import { migrateIfNeeded } from "../migration";
import { isDexAvailable, dexStatus, dexArchiveCompleted } from "../dex";

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

export async function iterate(
  options: { skipPlan?: boolean; model?: string } = {}
) {
  // Check for migration first
  const migrated = await migrateIfNeeded();
  if (!migrated) {
    throw new Error("Migration required but was declined.");
  }

  const todoDir = getTodoDir();

  if (!existsSync(todoDir)) {
    throw new Error(".math/todo/ directory not found. Run 'math init' first.");
  }

  // Check if dex is available
  const dexAvailable = await isDexAvailable();
  if (!dexAvailable) {
    throw new Error(
      "dex CLI not found. Install it with: cargo install dex-cli"
    );
  }

  console.log(`${colors.bold}Iterating to new sprint${colors.reset}\n`);

  // Step 1: Archive completed dex tasks
  console.log(
    `${colors.cyan}1.${colors.reset} Archiving completed dex tasks`
  );
  
  // Get current status to report
  const status = await dexStatus();
  const completedCount = status.stats.completed;
  
  if (completedCount > 0) {
    const archiveResult = await dexArchiveCompleted();
    console.log(
      `   ${colors.green}✓${colors.reset} Archived ${archiveResult.archivedCount} completed task(s)\n`
    );
  } else {
    console.log(
      `   ${colors.yellow}○${colors.reset} No completed tasks to archive\n`
    );
  }

  // Step 2: Backup and reset LEARNINGS.md
  const backupsDir = getBackupsDir();
  
  // Ensure .math/backups/ directory exists
  if (!existsSync(backupsDir)) {
    await mkdir(backupsDir, { recursive: true });
  }
  
  // Generate timestamped backup for learnings
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const learningsPath = join(todoDir, "LEARNINGS.md");
  
  console.log(`${colors.cyan}2.${colors.reset} Backing up and resetting LEARNINGS.md`);
  
  if (existsSync(learningsPath)) {
    const learningsBackupPath = join(backupsDir, `LEARNINGS-${timestamp}.md`);
    await Bun.$`cp ${learningsPath} ${learningsBackupPath}`;
    console.log(
      `   ${colors.green}✓${colors.reset} Backed up to .math/backups/LEARNINGS-${timestamp}.md`
    );
  }
  
  await Bun.write(learningsPath, LEARNINGS_TEMPLATE);
  console.log(
    `   ${colors.green}✓${colors.reset} LEARNINGS.md reset to template\n`
  );

  // Step 3: Keep PROMPT.md (signs are preserved)
  console.log(
    `${colors.cyan}3.${colors.reset} Preserving PROMPT.md (signs retained)\n`
  );

  console.log(`${colors.green}Done!${colors.reset} Ready for new sprint.`);

  // Ask to run planning mode unless --no-plan flag
  if (!options.skipPlan) {
    const shouldPlan = await askToRunPlanning();
    if (shouldPlan) {
      await runPlanningMode({ todoDir, options: { model: options.model } });
      return;
    }
  }

  console.log();
  console.log(`${colors.bold}Next steps:${colors.reset}`);
  console.log(
    `  1. Run ${colors.cyan}dex add "Your task description"${colors.reset} to add new tasks`
  );
  console.log(
    `  2. Run ${colors.cyan}math run${colors.reset} to start the agent loop`
  );
}
