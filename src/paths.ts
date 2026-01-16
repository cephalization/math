import { join } from "node:path";

/**
 * Get the root math directory path (.math)
 */
export function getMathDir(): string {
  return join(process.cwd(), ".math");
}

/**
 * Get the todo directory path (.math/todo)
 */
export function getTodoDir(): string {
  return join(process.cwd(), ".math", "todo");
}

/**
 * Get the backups directory path (.math/backups)
 */
export function getBackupsDir(): string {
  return join(process.cwd(), ".math", "backups");
}
