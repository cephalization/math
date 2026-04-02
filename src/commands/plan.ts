import { existsSync } from "node:fs";
import { runPlanningMode } from "../plan";
import { getTodoDir } from "../paths";
import { migrateIfNeeded } from "../migration";
import { loadIterationConfig } from "../config";
import { DEFAULT_MODEL } from "../constants";

export async function plan(options: { model?: string; quick?: boolean } = {}) {
  // Check for migration from legacy todo/ to .math/todo/
  await migrateIfNeeded();

  const todoDir = getTodoDir();

  if (!existsSync(todoDir)) {
    throw new Error(".math/todo/ directory not found. Run 'math init' first.");
  }

  // Resolve model with priority: CLI --model flag > config.model > DEFAULT_MODEL
  const config = loadIterationConfig(todoDir);
  const model = options.model ?? config?.model ?? DEFAULT_MODEL;

  await runPlanningMode({
    todoDir,
    options: { model, quick: options.quick },
  });
}
