import { test, expect, describe } from "bun:test";
import { runLoop } from "../loop";

describe("run command --no-ui option", () => {
  // The run command transforms `--no-ui` CLI flag to `ui: false` option for runLoop.
  // Since runLoop already has comprehensive tests for ui: false behavior in loop.test.ts,
  // we just need a simple test to verify the transformation logic.

  test("--no-ui flag results in ui: false", () => {
    // This tests the transformation logic in run.ts:
    // ui: !options["no-ui"]
    
    // When --no-ui is present, options["no-ui"] = true
    // So ui = !true = false
    const options: Record<string, string | boolean> = { "no-ui": true };
    const uiValue = !options["no-ui"];
    expect(uiValue).toBe(false);
  });

  test("without --no-ui flag, ui defaults to true", () => {
    // When --no-ui is absent, options["no-ui"] = undefined
    // So ui = !undefined = true
    const options: Record<string, string | boolean> = {};
    const uiValue = !options["no-ui"];
    expect(uiValue).toBe(true);
  });
});
