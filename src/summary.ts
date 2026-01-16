/**
 * Generate a short kebab-case summary from TASKS.md content
 * Used for naming backup directories
 */

/**
 * Extract task IDs from TASKS.md content
 */
function extractTaskIds(content: string): string[] {
  const taskIds: string[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    // Task IDs are defined as ### task-id
    const taskMatch = line.match(/^###\s+(.+)$/);
    if (taskMatch && taskMatch[1]) {
      taskIds.push(taskMatch[1].trim());
    }
  }

  return taskIds;
}

/**
 * Extract phase names from TASKS.md content
 */
function extractPhaseNames(content: string): string[] {
  const phases: string[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    // Phase names are defined as ## Phase N: Name
    const phaseMatch = line.match(/^##\s+Phase\s+\d+:\s*(.+)$/);
    if (phaseMatch && phaseMatch[1]) {
      phases.push(phaseMatch[1].trim());
    }
  }

  return phases;
}

/**
 * Convert a string to kebab-case
 */
function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Collapse multiple hyphens
    .replace(/^-|-$/g, ""); // Trim leading/trailing hyphens
}

/**
 * Generate a short kebab-case summary from TASKS.md content
 * Max 5 words, e.g., "auth-flow-setup"
 *
 * Strategy:
 * 1. Try to use the first phase name if available
 * 2. Fall back to combining first few task IDs
 * 3. Truncate to max 5 words
 */
export function generatePlanSummary(tasksContent: string): string {
  const MAX_WORDS = 5;

  // Try phase names first
  const phases = extractPhaseNames(tasksContent);
  if (phases.length > 0 && phases[0]) {
    const kebab = toKebabCase(phases[0]);
    const words = kebab.split("-").filter(Boolean);
    if (words.length > 0) {
      return words.slice(0, MAX_WORDS).join("-");
    }
  }

  // Fall back to task IDs
  const taskIds = extractTaskIds(tasksContent);
  if (taskIds.length > 0) {
    // Take the first task ID and use it as the summary
    const firstTaskId = taskIds[0];
    if (firstTaskId) {
      const kebab = toKebabCase(firstTaskId);
      const words = kebab.split("-").filter(Boolean);
      if (words.length > 0) {
        return words.slice(0, MAX_WORDS).join("-");
      }
    }
  }

  // Ultimate fallback
  return "plan";
}
