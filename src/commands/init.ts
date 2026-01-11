import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  PROMPT_TEMPLATE,
  TASKS_TEMPLATE,
  LEARNINGS_TEMPLATE,
} from "../templates";
import { runPlanningMode, askToRunPlanning } from "../plan";

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

export async function init(
  options: { skipPlan?: boolean; model?: string } = {}
) {
  const todoDir = join(process.cwd(), "todo");

  if (existsSync(todoDir)) {
    console.log(
      `${colors.yellow}todo/ directory already exists${colors.reset}`
    );
    return;
  }

  // Create todo directory
  await mkdir(todoDir, { recursive: true });

  // Write template files
  await Bun.write(join(todoDir, "PROMPT.md"), PROMPT_TEMPLATE);
  await Bun.write(join(todoDir, "TASKS.md"), TASKS_TEMPLATE);
  await Bun.write(join(todoDir, "LEARNINGS.md"), LEARNINGS_TEMPLATE);

  console.log(`${colors.green}✓${colors.reset} Created todo/ directory with:`);
  console.log(
    `  ${colors.cyan}PROMPT.md${colors.reset}    - System prompt with guardrails`
  );
  console.log(`  ${colors.cyan}TASKS.md${colors.reset}     - Task tracker`);
  console.log(`  ${colors.cyan}LEARNINGS.md${colors.reset} - Knowledge log`);

  // Ask to run planning mode unless --no-plan flag
  if (!options.skipPlan) {
    const shouldPlan = await askToRunPlanning();
    if (shouldPlan) {
      await runPlanningMode({ todoDir, options: { model: options.model } });
      return;
    }
  }

  console.log();
  console.log(`Next steps:`);
  console.log(
    `  1. Edit ${colors.cyan}todo/TASKS.md${colors.reset} to add your tasks`
  );
  console.log(
    `  2. Customize ${colors.cyan}todo/PROMPT.md${colors.reset} for your project`
  );
  console.log(
    `  3. Run ${colors.cyan}math run${colors.reset} to start the agent loop`
  );
}
