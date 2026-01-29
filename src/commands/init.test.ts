import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { existsSync } from "node:fs";
import { rm, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const TEST_DIR = join(import.meta.dir, ".test-init");

// Store original cwd to restore after tests
let originalCwd: string;

// Track dex commands that were called
let dexInitCalled = false;
let mockDexAvailable = true;
let mockDexDirPath: string | null = null;

// Mock the dex module
mock.module("../dex", () => ({
  isDexAvailable: mock(() => Promise.resolve(mockDexAvailable)),
  getDexDir: mock(() => Promise.resolve(mockDexDirPath)),
}));

// Helper to create a mock shell that intercepts dex commands
function createMockShell(originalShell: typeof Bun.$) {
  const mockShell = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const cmd = strings.join("");
    if (cmd.includes("dex init")) {
      dexInitCalled = true;
      return { quiet: () => ({ exitCode: 0, text: () => "", stderr: { toString: () => "" } }) };
    }
    // For other commands, return a no-op result rather than calling the real shell
    // This prevents actual shell execution during tests
    return { quiet: () => ({ exitCode: 0, text: () => "", stderr: { toString: () => "" } }) };
  };
  return mockShell as unknown as typeof Bun.$;
}

beforeEach(async () => {
  originalCwd = process.cwd();

  // Clean up and create fresh test directory
  if (existsSync(TEST_DIR)) {
    await rm(TEST_DIR, { recursive: true });
  }
  await mkdir(TEST_DIR, { recursive: true });

  // Change to test directory so getTodoDir() resolves to test location
  process.chdir(TEST_DIR);

  // Reset mock state
  dexInitCalled = false;
  mockDexAvailable = true;
  mockDexDirPath = null;
});

afterEach(async () => {
  // Restore original working directory
  process.chdir(originalCwd);

  // Clean up test directory
  if (existsSync(TEST_DIR)) {
    await rm(TEST_DIR, { recursive: true });
  }
});

describe("init command", () => {
  test("creates .math/todo directory structure with PROMPT.md and LEARNINGS.md (no TASKS.md)", async () => {
    // Mock shell to track dex init call
    const originalShell = Bun.$;
    Bun.$ = createMockShell(originalShell);

    try {
      // Import fresh module to get mocked version
      const { init } = await import("./init");
      const { getTodoDir } = await import("../paths");
      
      // Run init with skipPlan to avoid interactive prompt
      await init({ skipPlan: true });

      const todoDir = getTodoDir();

      // Verify directory was created
      expect(existsSync(todoDir)).toBe(true);

      // Verify PROMPT.md and LEARNINGS.md were created
      expect(existsSync(join(todoDir, "PROMPT.md"))).toBe(true);
      expect(existsSync(join(todoDir, "LEARNINGS.md"))).toBe(true);

      // Verify TASKS.md was NOT created (dex manages tasks now)
      expect(existsSync(join(todoDir, "TASKS.md"))).toBe(false);
    } finally {
      Bun.$ = originalShell;
    }
  });

  test("calls dex init -y when no .dex/ exists", async () => {
    // Set mock state: dex is available but no .dex exists
    mockDexAvailable = true;
    mockDexDirPath = null;

    // Mock shell to track dex init call
    const originalShell = Bun.$;
    Bun.$ = createMockShell(originalShell);

    try {
      const { init } = await import("./init");
      await init({ skipPlan: true });

      // Verify dex init was called
      expect(dexInitCalled).toBe(true);
    } finally {
      Bun.$ = originalShell;
    }
  });

  test("reuses existing .dex/ directory (does not call dex init)", async () => {
    // Set mock state: dex is available AND .dex already exists
    mockDexAvailable = true;
    mockDexDirPath = join(TEST_DIR, ".dex");

    // Create actual .dex directory so the test reflects real behavior
    await mkdir(join(TEST_DIR, ".dex"), { recursive: true });

    // Mock shell to track dex init call
    const originalShell = Bun.$;
    Bun.$ = createMockShell(originalShell);

    try {
      const { init } = await import("./init");
      await init({ skipPlan: true });

      // Verify dex init was NOT called since .dex already exists
      expect(dexInitCalled).toBe(false);
    } finally {
      Bun.$ = originalShell;
    }
  });

  test("does not call dex init when dex is not available", async () => {
    // Set mock state: dex is NOT available
    mockDexAvailable = false;
    mockDexDirPath = null;

    // Mock shell to track dex init call
    const originalShell = Bun.$;
    Bun.$ = createMockShell(originalShell);

    try {
      const { init } = await import("./init");
      const { getTodoDir } = await import("../paths");

      await init({ skipPlan: true });

      // Verify dex init was NOT called since dex is not available
      expect(dexInitCalled).toBe(false);

      // But .math/todo directory should still be created with files
      const todoDir = getTodoDir();
      expect(existsSync(todoDir)).toBe(true);
      expect(existsSync(join(todoDir, "PROMPT.md"))).toBe(true);
      expect(existsSync(join(todoDir, "LEARNINGS.md"))).toBe(true);
    } finally {
      Bun.$ = originalShell;
    }
  });

  test("uses getTodoDir for path resolution", async () => {
    const { getTodoDir } = await import("../paths");

    // Verify getTodoDir returns the expected .math/todo path relative to cwd
    const todoDir = getTodoDir();
    expect(todoDir).toContain(".math");
    expect(todoDir).toContain("todo");
    expect(todoDir.endsWith(".math/todo")).toBe(true);
    // Should resolve relative to our test directory
    expect(todoDir.startsWith(TEST_DIR)).toBe(true);
  });

  test("does not overwrite if .math/todo directory already exists", async () => {
    // Mock shell for dex init
    const originalShell = Bun.$;
    Bun.$ = createMockShell(originalShell);

    try {
      const { init } = await import("./init");
      const { getTodoDir } = await import("../paths");

      // First init
      await init({ skipPlan: true });

      const todoDir = getTodoDir();
      const originalContent = await readFile(join(todoDir, "PROMPT.md"), "utf-8");

      // Modify a file
      await Bun.write(join(todoDir, "PROMPT.md"), "modified content");

      // Second init should not overwrite (early return because dir exists)
      await init({ skipPlan: true });

      // Verify content was not overwritten
      const newContent = await readFile(join(todoDir, "PROMPT.md"), "utf-8");
      expect(newContent).toBe("modified content");
    } finally {
      Bun.$ = originalShell;
    }
  });
});
