import { dexStatus, dexListReady, type DexTask } from "../dex";

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

export async function status() {
  const dexState = await dexStatus();
  const { stats } = dexState;

  console.log(`${colors.bold}Task Status${colors.reset}\n`);

  // Progress bar
  const barWidth = 30;
  const completedWidth = stats.total > 0 
    ? Math.round((stats.completed / stats.total) * barWidth) 
    : 0;
  const inProgressWidth = stats.total > 0 
    ? Math.round((stats.inProgress / stats.total) * barWidth) 
    : 0;
  const pendingWidth = barWidth - completedWidth - inProgressWidth;

  const progressBar =
    colors.green + "█".repeat(completedWidth) +
    colors.yellow + "█".repeat(inProgressWidth) +
    colors.dim + "░".repeat(pendingWidth) +
    colors.reset;

  console.log(`  ${progressBar} ${stats.completed}/${stats.total}`);
  console.log();

  // Counts
  console.log(`  ${colors.green}✓ Complete:${colors.reset}    ${stats.completed}`);
  console.log(`  ${colors.yellow}◐ In Progress:${colors.reset} ${stats.inProgress}`);
  console.log(`  ${colors.dim}○ Pending:${colors.reset}     ${stats.pending}`);
  console.log();

  // Next task
  const readyTasks = await dexListReady();
  const nextTask = readyTasks[0];
  
  if (nextTask) {
    console.log(`${colors.bold}Next Task${colors.reset}`);
    console.log(`  ${colors.cyan}${nextTask.id}${colors.reset}`);
    console.log(`  ${colors.dim}${nextTask.name}${colors.reset}`);
  } else if (stats.completed === stats.total && stats.total > 0) {
    console.log(`${colors.green}All tasks complete!${colors.reset}`);
  } else if (stats.inProgress > 0) {
    const inProgressTask = dexState.inProgressTasks[0];
    console.log(`${colors.yellow}Task in progress:${colors.reset} ${inProgressTask?.id}`);
  } else {
    console.log(`${colors.yellow}No tasks ready (check dependencies)${colors.reset}`);
  }
}
