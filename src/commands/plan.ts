import { existsSync } from "node:fs";
import { join } from "node:path";
import { runPlanningMode } from "../plan";

export async function plan(options: { model?: string } = {}) {
  const todoDir = join(process.cwd(), "todo");

  if (!existsSync(todoDir)) {
    throw new Error("todo/ directory not found. Run 'math init' first.");
  }

  await runPlanningMode({ todoDir, options: { model: options.model } });
}
