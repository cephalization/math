import { z } from "zod/v4";
import { join } from "node:path";

/**
 * Zod schema for iteration configuration
 */
export const IterationConfigSchema = z.object({
  model: z.string().optional(),
  createdAt: z.string().datetime(),
});

/**
 * TypeScript type inferred from the schema
 */
export type IterationConfig = z.infer<typeof IterationConfigSchema>;

/**
 * Load iteration config from .math/todo/config.json
 * @param todoDir - The path to the todo directory (e.g., .math/todo)
 * @returns The parsed config or null if missing/invalid
 */
export function loadIterationConfig(todoDir: string): IterationConfig | null {
  const configPath = join(todoDir, "config.json");

  const file = Bun.file(configPath);
  if (!file.size) {
    return null;
  }

  try {
    const content = JSON.parse(
      require("fs").readFileSync(configPath, "utf-8")
    );
    const result = IterationConfigSchema.safeParse(content);
    if (result.success) {
      return result.data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Save iteration config to .math/todo/config.json
 * @param todoDir - The path to the todo directory (e.g., .math/todo)
 * @param config - The config to save (will be validated)
 */
export function saveIterationConfig(
  todoDir: string,
  config: IterationConfig
): void {
  const configPath = join(todoDir, "config.json");

  // Validate before saving
  const validated = IterationConfigSchema.parse(config);

  require("fs").writeFileSync(configPath, JSON.stringify(validated, null, 2));
}
