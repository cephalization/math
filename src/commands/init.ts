import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { $ } from "bun";
import { PROMPT_TEMPLATE, LEARNINGS_TEMPLATE } from "../templates";
import { runPlanningMode, askToRunPlanning } from "../plan";
import { getTodoDir } from "../paths";
import { getDexDir, isDexAvailable } from "../dex";
import { DEFAULT_MODEL } from "../constants";
import { validateModel, SUPPORTED_PROVIDERS } from "../model";
import { saveIterationConfig } from "../config";

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

/**
 * Prompt user for implementation model with validation and re-prompt on error.
 * Returns the validated model string or undefined if user skips.
 */
async function promptForModel(todoDir: string): Promise<string | undefined> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    while (true) {
      const answer = await rl.question(
        `Enter model (${colors.cyan}provider/model${colors.reset}), or press Enter for default [${DEFAULT_MODEL}]: `
      );

      const trimmed = answer.trim();

      // Empty input = use default, don't persist
      if (!trimmed) {
        console.log(
          `${colors.green}✓${colors.reset} Using default model: ${DEFAULT_MODEL}`
        );
        rl.close();
        return undefined;
      }

      // Validate the input
      const result = validateModel(trimmed);
      if (!result.valid) {
        console.log(`${colors.red}✗${colors.reset} ${result.error}`);
        console.log(
          `${colors.yellow}Supported providers: ${SUPPORTED_PROVIDERS.join(", ")}${colors.reset}`
        );
        // Re-prompt
        continue;
      }

      // Valid input - persist to config
      saveIterationConfig(todoDir, {
        model: trimmed,
        createdAt: new Date().toISOString(),
      });
      console.log(`${colors.green}✓${colors.reset} Model set to: ${trimmed}`);
      rl.close();
      return trimmed;
    }
  } catch {
    rl.close();
    return undefined;
  }
}

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
  console.log();

  // Model configuration
  let resolvedModel: string | undefined = options.model;

  if (options.model) {
    // If --model flag was provided, validate and persist if valid
    const result = validateModel(options.model);
    if (!result.valid) {
      throw new Error(result.error);
    }
    saveIterationConfig(todoDir, {
      model: options.model,
      createdAt: new Date().toISOString(),
    });
    console.log(
      `${colors.green}✓${colors.reset} Using model from --model flag: ${options.model}`
    );
  } else if (process.stdin.isTTY) {
    // Interactive mode: prompt for model
    resolvedModel = await promptForModel(todoDir);
  } else {
    // Non-interactive mode: use default, don't persist
    console.log(
      `${colors.green}✓${colors.reset} Using default model: ${DEFAULT_MODEL}`
    );
  }
  console.log();

  // Ask to run planning mode unless --no-plan flag
  if (!options.skipPlan) {
    const shouldPlan = await askToRunPlanning();
    if (shouldPlan) {
      await runPlanningMode({ todoDir, options: { model: resolvedModel } });
      return;
    }
  }

  console.log();
  console.log(`Next steps:`);
  console.log(
    `  1. Run ${colors.cyan}dex create "Your first task"${colors.reset} to add tasks`
  );
  console.log(
    `  2. Customize ${colors.cyan}.math/todo/PROMPT.md${colors.reset} for your project`
  );
  console.log(
    `  3. Run ${colors.cyan}math run${colors.reset} to start the agent loop`
  );
}
