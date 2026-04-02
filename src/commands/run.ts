import { runLoop } from "../loop";
import { getTodoDir } from "../paths";
import { loadIterationConfig } from "../config";
import { DEFAULT_MODEL } from "../constants";

export type ModelSource = "flag" | "config" | "default";

export interface ResolvedModel {
  model: string;
  source: ModelSource;
}

/**
 * Resolve the model with priority: CLI --model flag > config.model > DEFAULT_MODEL
 */
export function resolveModel(cliModel: string | undefined): ResolvedModel {
  if (cliModel) {
    return { model: cliModel, source: "flag" };
  }

  const todoDir = getTodoDir();
  const config = loadIterationConfig(todoDir);
  if (config?.model) {
    return { model: config.model, source: "config" };
  }

  return { model: DEFAULT_MODEL, source: "default" };
}

export async function run(options: Record<string, string | boolean>) {
  const cliModel = typeof options.model === "string" ? options.model : undefined;
  const resolved = resolveModel(cliModel);

  await runLoop({
    model: resolved.model,
    modelSource: resolved.source,
    maxIterations:
      typeof options["max-iterations"] === "string"
        ? parseInt(options["max-iterations"], 10)
        : undefined,
    pauseSeconds:
      typeof options.pause === "string"
        ? parseInt(options.pause, 10)
        : undefined,
    ui: !!options.ui,
  });
}
