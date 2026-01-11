import { runLoop } from "../loop";

export async function run(options: Record<string, string | boolean>) {
  await runLoop({
    model: typeof options.model === "string" ? options.model : undefined,
    maxIterations: typeof options["max-iterations"] === "string" 
      ? parseInt(options["max-iterations"], 10) 
      : undefined,
    pauseSeconds: typeof options.pause === "string" 
      ? parseInt(options.pause, 10) 
      : undefined,
    ui: !options["no-ui"],
  });
}
