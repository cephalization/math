import { existsSync } from "node:fs";
import { runPlanningMode } from "../plan";
import { getTodoDir } from "../paths";
import { migrateIfNeeded } from "../migration";

export async function plan(options: { model?: string; quick?: boolean } = {}) {
  // Check for migration from legacy todo/ to .math/todo/
  await migrateIfNeeded();

  const todoDir = getTodoDir();

  if (!existsSync(todoDir)) {
    throw new Error(".math/todo/ directory not found. Run 'math init' first.");
  }

  await runPlanningMode({
    todoDir,
    options: { model: options.model, quick: options.quick },
  });
}
