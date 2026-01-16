import { describe, it, expect } from "bun:test";
import { generatePlanSummary } from "./summary";

describe("generatePlanSummary", () => {
  it("should extract summary from phase name", () => {
    const content = `# Project Tasks

## Phase 1: Core Infrastructure

### add-paths-module
- content: Create paths module
- status: pending
- dependencies: none
`;
    expect(generatePlanSummary(content)).toBe("core-infrastructure");
  });

  it("should truncate phase name to max 5 words", () => {
    const content = `# Project Tasks

## Phase 1: Very Long Phase Name With Many Words Here

### task-1
- content: Some task
- status: pending
- dependencies: none
`;
    expect(generatePlanSummary(content)).toBe("very-long-phase-name-with");
  });

  it("should fall back to task ID when no phase name", () => {
    const content = `# Project Tasks

### auth-flow-setup
- content: Setup auth flow
- status: pending
- dependencies: none
`;
    expect(generatePlanSummary(content)).toBe("auth-flow-setup");
  });

  it("should handle task ID with special characters", () => {
    const content = `# Project Tasks

### add_user_auth!
- content: Add user auth
- status: pending
- dependencies: none
`;
    expect(generatePlanSummary(content)).toBe("adduserauth");
  });

  it("should return 'plan' as ultimate fallback", () => {
    const content = `# Project Tasks

Just some random content without tasks or phases.
`;
    expect(generatePlanSummary(content)).toBe("plan");
  });

  it("should handle empty content", () => {
    expect(generatePlanSummary("")).toBe("plan");
  });

  it("should handle multiple phases and use the first one", () => {
    const content = `# Project Tasks

## Phase 1: Setup

### task-1
- content: Task 1
- status: complete
- dependencies: none

## Phase 2: Implementation

### task-2
- content: Task 2
- status: pending
- dependencies: task-1
`;
    expect(generatePlanSummary(content)).toBe("setup");
  });

  it("should handle phase name with numbers", () => {
    const content = `# Project Tasks

## Phase 1: OAuth2 Integration

### oauth2-setup
- content: Setup OAuth2
- status: pending
- dependencies: none
`;
    expect(generatePlanSummary(content)).toBe("oauth2-integration");
  });
});
