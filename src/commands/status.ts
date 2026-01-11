import { readTasks, countTasks, findNextTask } from "../tasks";

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
  const { tasks } = await readTasks();
  const counts = countTasks(tasks);

  console.log(`${colors.bold}Task Status${colors.reset}\n`);

  // Progress bar
  const barWidth = 30;
  const completedWidth = Math.round((counts.complete / counts.total) * barWidth);
  const inProgressWidth = Math.round((counts.in_progress / counts.total) * barWidth);
  const pendingWidth = barWidth - completedWidth - inProgressWidth;

  const progressBar =
    colors.green + "█".repeat(completedWidth) +
    colors.yellow + "█".repeat(inProgressWidth) +
    colors.dim + "░".repeat(pendingWidth) +
    colors.reset;

  console.log(`  ${progressBar} ${counts.complete}/${counts.total}`);
  console.log();

  // Counts
  console.log(`  ${colors.green}✓ Complete:${colors.reset}    ${counts.complete}`);
  console.log(`  ${colors.yellow}◐ In Progress:${colors.reset} ${counts.in_progress}`);
  console.log(`  ${colors.dim}○ Pending:${colors.reset}     ${counts.pending}`);
  console.log();

  // Next task
  const nextTask = findNextTask(tasks);
  if (nextTask) {
    console.log(`${colors.bold}Next Task${colors.reset}`);
    console.log(`  ${colors.cyan}${nextTask.id}${colors.reset}`);
    console.log(`  ${colors.dim}${nextTask.content}${colors.reset}`);
  } else if (counts.complete === counts.total) {
    console.log(`${colors.green}All tasks complete!${colors.reset}`);
  } else if (counts.in_progress > 0) {
    const inProgressTask = tasks.find((t) => t.status === "in_progress");
    console.log(`${colors.yellow}Task in progress:${colors.reset} ${inProgressTask?.id}`);
  } else {
    console.log(`${colors.yellow}No tasks ready (check dependencies)${colors.reset}`);
  }
}
