/**
 * Supported model providers
 */
export const SUPPORTED_PROVIDERS = ["openai", "anthropic"] as const;

export type Provider = (typeof SUPPORTED_PROVIDERS)[number];

export type ValidationResult =
  | { valid: true; model: string }
  | { valid: false; error: string };

export type ParsedModel = {
  provider: Provider;
  modelName: string;
};

/**
 * Validate that a model string is in the correct format (provider/model-name)
 */
export function validateModel(model: string): ValidationResult {
  if (!model || typeof model !== "string") {
    return {
      valid: false,
      error: "Model must be a non-empty string",
    };
  }

  const parsed = parseModelProvider(model);

  if (!parsed) {
    return {
      valid: false,
      error: `Invalid model format "${model}". Expected format: provider/model-name (e.g., openai/gpt-4, anthropic/claude-3-opus). Supported providers: ${SUPPORTED_PROVIDERS.join(", ")}`,
    };
  }

  return { valid: true, model };
}

/**
 * Parse a model string into provider and model name components
 * Returns null if the model format is invalid or provider is not supported
 */
export function parseModelProvider(model: string): ParsedModel | null {
  if (!model || typeof model !== "string") {
    return null;
  }

  const slashIndex = model.indexOf("/");
  if (slashIndex === -1) {
    return null;
  }

  const provider = model.slice(0, slashIndex);
  const modelName = model.slice(slashIndex + 1);

  if (!modelName) {
    return null;
  }

  if (!SUPPORTED_PROVIDERS.includes(provider as Provider)) {
    return null;
  }

  return {
    provider: provider as Provider,
    modelName,
  };
}
