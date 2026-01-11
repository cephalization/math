import { existsSync } from "node:fs";
import { join } from "node:path";
import { TASKS_TEMPLATE, LEARNINGS_TEMPLATE } from "../templates";
import { runPlanningMode, askToRunPlanning } from "../plan";

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

export async function iterate(options: { skipPlan?: boolean } = {}) {
  const todoDir = join(process.cwd(), "todo");

  if (!existsSync(todoDir)) {
    throw new Error("todo/ directory not found. Run 'math init' first.");
  }

  // Generate backup directory name: todo-{M}-{D}-{Y}
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const year = now.getFullYear();
  const backupDir = join(process.cwd(), `todo-${month}-${day}-${year}`);

  // Handle existing backup for same day
  let finalBackupDir = backupDir;
  let counter = 1;
  while (existsSync(finalBackupDir)) {
    finalBackupDir = `${backupDir}-${counter}`;
    counter++;
  }

  console.log(`${colors.bold}Iterating to new sprint${colors.reset}\n`);

  // Step 1: Backup current todo directory
  console.log(`${colors.cyan}1.${colors.reset} Backing up todo/ to ${finalBackupDir.split("/").pop()}/`);
  await Bun.$`cp -r ${todoDir} ${finalBackupDir}`;
  console.log(`   ${colors.green}✓${colors.reset} Backup complete\n`);

  // Step 2: Reset TASKS.md
  console.log(`${colors.cyan}2.${colors.reset} Resetting TASKS.md`);
  await Bun.write(join(todoDir, "TASKS.md"), TASKS_TEMPLATE);
  console.log(`   ${colors.green}✓${colors.reset} TASKS.md reset to template\n`);

  // Step 3: Reset LEARNINGS.md
  console.log(`${colors.cyan}3.${colors.reset} Resetting LEARNINGS.md`);
  await Bun.write(join(todoDir, "LEARNINGS.md"), LEARNINGS_TEMPLATE);
  console.log(`   ${colors.green}✓${colors.reset} LEARNINGS.md reset to template\n`);

  // Step 4: Keep PROMPT.md (signs are preserved)
  console.log(`${colors.cyan}4.${colors.reset} Preserving PROMPT.md (signs retained)\n`);

  console.log(`${colors.green}Done!${colors.reset} Ready for new sprint.`);
  console.log(`${colors.yellow}Previous sprint preserved at:${colors.reset} ${finalBackupDir.split("/").pop()}/`);

  // Ask to run planning mode unless --no-plan flag
  if (!options.skipPlan) {
    const shouldPlan = await askToRunPlanning();
    if (shouldPlan) {
      await runPlanningMode(todoDir);
      return;
    }
  }

  console.log();
  console.log(`${colors.bold}Next steps:${colors.reset}`);
  console.log(`  1. Edit ${colors.cyan}todo/TASKS.md${colors.reset} to add new tasks`);
  console.log(`  2. Run ${colors.cyan}math run${colors.reset} to start the agent loop`);
}
