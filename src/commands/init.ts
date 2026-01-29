import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { PROMPT_TEMPLATE, LEARNINGS_TEMPLATE } from "../templates";
import { runPlanningMode, askToRunPlanning } from "../plan";
import { getTodoDir } from "../paths";
import { getDexDir, isDexAvailable } from "../dex";

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

export async function init(
  options: { skipPlan?: boolean; model?: string } = {}
) {
  const todoDir = getTodoDir();

  if (existsSync(todoDir)) {
    console.log(
      `${colors.yellow}.math/todo/ directory already exists${colors.reset}`
    );
    return;
  }

  // Check if dex is available
  const dexAvailable = await isDexAvailable();
  if (!dexAvailable) {
    console.log(
      `${colors.yellow}Warning: dex CLI not found. Install from: https://dex.rip/${colors.reset}`
    );
    console.log(
      `${colors.yellow}Tasks will need to be managed manually until dex is installed.${colors.reset}`
    );
  }

  // Initialize dex if not already present
  const dexDir = await getDexDir();
  if (dexAvailable && !dexDir) {
    try {
      await $`dex init -y`.quiet();
      console.log(`${colors.green}✓${colors.reset} Initialized dex task tracker`);
    } catch (error) {
      console.log(
        `${colors.yellow}Warning: Failed to initialize dex: ${error}${colors.reset}`
      );
    }
  } else if (dexDir) {
    console.log(`${colors.green}✓${colors.reset} Using existing dex at ${dexDir}`);
  }

  // Create .math/todo directory (recursive creates .math too)
  await mkdir(todoDir, { recursive: true });

  // Write template files (PROMPT.md and LEARNINGS.md only, dex manages tasks)
  await Bun.write(join(todoDir, "PROMPT.md"), PROMPT_TEMPLATE);
  await Bun.write(join(todoDir, "LEARNINGS.md"), LEARNINGS_TEMPLATE);

  console.log(`${colors.green}✓${colors.reset} Created .math/todo/ directory with:`);
  console.log(
    `  ${colors.cyan}PROMPT.md${colors.reset}    - System prompt with guardrails`
  );
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
    `  1. Run ${colors.cyan}dex add "Your first task"${colors.reset} to add tasks`
  );
  console.log(
    `  2. Customize ${colors.cyan}.math/todo/PROMPT.md${colors.reset} for your project`
  );
  console.log(
    `  3. Run ${colors.cyan}math run${colors.reset} to start the agent loop`
  );
}
